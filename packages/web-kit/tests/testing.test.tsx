// @vitest-environment jsdom
// 파일 책임: /testing 검사가 올바른 adapter는 통과시키고 깨진 adapter는 실제로 거절하는지 확인한다.
import { useEffect, useState, type ReactElement } from 'react';
import { afterEach, expect, it } from 'vitest';
import { FieldFrame } from '../src/form/field';
import {
  checkConfirmDialogAdapter,
  checkFieldAdapter,
  checkRetryFocusAdapter,
  type ConfirmDialogAdapterProps,
  type FieldAdapterCase,
  type RetryAdapterProps,
} from '../src/testing';

afterEach(() => {
  document.body.innerHTML = '';
});

const classes = { root: '', label: '', required: '', description: '', error: '' };

/** 키트 FieldFrame을 그대로 쓰는 올바른 adapter. */
function GoodField(field: FieldAdapterCase): ReactElement {
  return (
    <FieldFrame
      id={field.id}
      label={field.label}
      required={false}
      description={field.description}
      message={field.message}
      classes={classes}
    >
      {(control) => <input {...control} />}
    </FieldFrame>
  );
}

it('Field: 키트 FieldFrame adapter는 통과한다', async () => {
  await expect(checkFieldAdapter(GoodField)).resolves.toBeUndefined();
});

it('Field: 라벨이 control에 연결되지 않으면 거절한다', async () => {
  const Broken = (field: FieldAdapterCase) => (
    <div>
      <span>{field.label}</span>
      <input id={field.id} />
    </div>
  );
  await expect(checkFieldAdapter(Broken)).rejects.toThrow(/label/);
});

it('Field: 키트 id 규칙을 쓰지 않으면 거절한다', async () => {
  const Broken = (field: FieldAdapterCase) => <GoodField {...field} id={`x-${field.name}`} />;
  await expect(checkFieldAdapter(Broken)).rejects.toThrow(/control/);
});

it('Field: 없는 요소를 aria-describedby로 가리키면 거절한다', async () => {
  const Broken = (field: FieldAdapterCase) => (
    <div>
      <label htmlFor={field.id}>{field.label}</label>
      <input id={field.id} aria-describedby={`${field.id}-description ${field.id}-error`} />
      {field.message === undefined ? null : <p id={`${field.id}-error`}>{field.message}</p>}
    </div>
  );
  await expect(checkFieldAdapter(Broken)).rejects.toThrow(/describedby/);
});

it('Field: 오류가 사라진 뒤에도 오류 참조가 남으면 거절한다', async () => {
  const Broken = (field: FieldAdapterCase) => (
    <div>
      <label htmlFor={field.id}>{field.label}</label>
      <input
        id={field.id}
        aria-invalid={field.message !== undefined}
        aria-describedby={`${field.id}-description ${field.id}-error`}
      />
      <p id={`${field.id}-description`}>{field.description}</p>
      <p id={`${field.id}-error`}>{field.message ?? ''}</p>
    </div>
  );
  await expect(checkFieldAdapter(Broken)).rejects.toThrow(/error/);
});

/** 열림을 stage에만 따르는 올바른 확인창 adapter. 닫기 요청은 onCancel로만 전달한다. */
function GoodDialog({ open, pending, onConfirm, onCancel, children }: ConfirmDialogAdapterProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    const onOutside = (event: Event) => {
      if (!(event.target as Element).closest('[role="dialog"]')) onCancel();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div role="dialog">
      {children}
      <button type="button" disabled={pending} onClick={onCancel}>
        취소
      </button>
      <button type="button" disabled={pending} onClick={onConfirm}>
        확인
      </button>
    </div>
  );
}

const dialogLabels = { confirm: '확인', cancel: '취소' };

it('확인창: stage를 따르는 adapter는 통과한다', async () => {
  await expect(checkConfirmDialogAdapter(GoodDialog, dialogLabels)).resolves.toBeUndefined();
});

it('확인창: 저장 중 Escape로 스스로 닫히는 adapter는 거절한다', async () => {
  function SelfClosing(props: ConfirmDialogAdapterProps) {
    const [closed, setClosed] = useState(false);
    useEffect(() => {
      if (!props.open) setClosed(false);
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setClosed(true);
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [props.open]);
    return closed ? null : <GoodDialog {...props} />;
  }
  await expect(checkConfirmDialogAdapter(SelfClosing, dialogLabels)).rejects.toThrow(/Escape/);
});

it('확인창: 보여 준 값을 그리지 않는 adapter는 거절한다', async () => {
  const Blind = (props: ConfirmDialogAdapterProps) => <GoodDialog {...props}>{null}</GoodDialog>;
  await expect(checkConfirmDialogAdapter(Blind, dialogLabels)).rejects.toThrow(/snapshot/);
});

it('확인창: 확인 없이 취소가 닫지 못하면 거절한다', async () => {
  const Stuck = (props: ConfirmDialogAdapterProps) => <GoodDialog {...props} onCancel={() => undefined} />;
  await expect(checkConfirmDialogAdapter(Stuck, dialogLabels)).rejects.toThrow(/cancel/);
});

/** 다시 시도 버튼에 focus가 있다가 버튼이 사라질 때만 control로 옮기는 올바른 adapter. */
function GoodRetry({ failed, onRetry, controlId }: RetryAdapterProps) {
  const [moveFocus, setMoveFocus] = useState(false);
  useEffect(() => {
    if (!failed && moveFocus) {
      document.getElementById(controlId)?.focus();
      setMoveFocus(false);
    }
  }, [failed, moveFocus, controlId]);
  if (failed)
    return (
      <button
        type="button"
        onClick={(event) => {
          setMoveFocus(document.activeElement === event.currentTarget);
          onRetry();
        }}
      >
        retry
      </button>
    );
  return <select id={controlId} aria-label="options" />;
}

it('재시도 focus: 규칙을 지키는 adapter는 통과한다', async () => {
  await expect(checkRetryFocusAdapter(GoodRetry)).resolves.toBeUndefined();
});

it('재시도 focus: 버튼이 사라져도 focus를 옮기지 않으면 거절한다', async () => {
  const Lost = ({ failed, onRetry, controlId }: RetryAdapterProps) =>
    failed ? (
      <button type="button" onClick={onRetry}>
        retry
      </button>
    ) : (
      <select id={controlId} aria-label="options" />
    );
  await expect(checkRetryFocusAdapter(Lost)).rejects.toThrow(/control/);
});

it('재시도 focus: 다른 곳에 있던 focus를 빼앗으면 거절한다', async () => {
  function Grabby({ failed, onRetry, controlId }: RetryAdapterProps) {
    useEffect(() => {
      if (!failed) document.getElementById(controlId)?.focus();
    }, [failed, controlId]);
    return failed ? (
      <button type="button" onClick={onRetry}>
        retry
      </button>
    ) : (
      <select id={controlId} aria-label="options" />
    );
  }
  await expect(checkRetryFocusAdapter(Grabby)).rejects.toThrow(/moved/);
});
