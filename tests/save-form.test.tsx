// @vitest-environment jsdom
// 파일 책임: useSaveForm의 제출·확인·성공 기준선·실패·늦은 결과·원본 재도착을 실제 입력 DOM으로 검사한다.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { StandardSchemaV1 } from '@tanstack/react-form';
import { afterEach, expect, it, vi } from 'vitest';
import { RequestFailure } from '../src/failure';
import { useSaveForm, type SaveFormOptions } from '../src/form/save-form';

interface Values {
  readonly name: string;
  readonly email: string;
}
interface Output {
  readonly name: string;
  readonly email: string;
}

/** 이름 필수·앞뒤 공백 제거. zod 대신 Standard Schema를 직접 구현해 의존성을 늘리지 않는다. */
const schema: StandardSchemaV1<Values, Output> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) => {
      const values = value as Values;
      return values.name.trim() === ''
        ? { issues: [{ message: 'required', path: ['name'] }] }
        : { value: { name: values.name.trim(), email: values.email } };
    },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function errorText(errors: readonly unknown[]): string {
  return errors
    .map((error) => (typeof error === 'string' ? error : (error as { message?: string } | undefined)?.message))
    .filter(Boolean)
    .join(',');
}

function Screen(props: SaveFormOptions<Values, Output>) {
  const save = useSaveForm(props);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save.submit();
      }}
    >
      {(['name', 'email'] as const).map((name) => (
        <save.form.Field key={name} name={name}>
          {(field) => (
            <>
              <input
                id={save.fieldId(name)}
                aria-label={name}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <span data-testid={`${name}-error`}>{errorText(field.state.meta.errors)}</span>
            </>
          )}
        </save.form.Field>
      ))}
      <button type="submit">save</button>
      {save.stage.kind === 'confirming' && (
        <div role="dialog">
          <span data-testid="confirm-name">{save.stage.values.name}</span>
          <button type="button" onClick={() => void save.confirm()}>ok</button>
          <button type="button" onClick={save.cancel}>cancel</button>
        </div>
      )}
      <output data-testid="state">
        {JSON.stringify({
          dirty: save.isDirty,
          stage: save.stage.kind,
          failure: save.failure instanceof Error ? save.failure.message : save.failure,
          unattached: save.unattachedFieldErrors.map((error) => error.field),
        })}
      </output>
    </form>
  );
}

function state() {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}') as {
    dirty: boolean;
    stage: string;
    failure?: string;
    unattached: string[];
  };
}

function type(name: 'name' | 'email', value: string) {
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByText('save'));
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const original = { id: 1, values: { name: 'A', email: 'a@x' } };

afterEach(cleanup);

it('S1 잘못된 제출은 저장·확인 0건이고 화면 순서의 첫 오류 입력으로 focus한다', async () => {
  const save = vi.fn(async () => undefined);
  render(<Screen schema={schema} source={original} save={save} confirm />);
  type('name', ' ');
  await submit();
  await flush();
  expect(save).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByTestId('name-error').textContent).toBe('required');
  expect(document.activeElement).toBe(screen.getByLabelText('name'));
});

it('S2 저장 중 다시 제출해도 요청은 한 번이고, 검증한 값(출력)으로 저장한다', async () => {
  const pending = deferred<undefined>();
  const save = vi.fn(() => pending.promise);
  render(<Screen schema={schema} source={original} save={save} />);
  type('name', ' B ');
  await submit();
  await submit();
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith({ name: 'B', email: 'a@x' }, { name: ' B ', email: 'a@x' });
  expect(state().stage).toBe('saving');
  await act(async () => pending.resolve(undefined));
  expect(state().stage).toBe('idle');
});

it('S3 확인 관문: 보여 준 S로 실행하고, 취소하면 저장하지 않는다', async () => {
  const save = vi.fn(async () => undefined);
  render(<Screen schema={schema} source={original} save={save} confirm />);
  type('name', 'B');
  await submit();
  expect(screen.getByTestId('confirm-name').textContent).toBe('B');
  fireEvent.click(screen.getByText('cancel'));
  expect(save).not.toHaveBeenCalled();
  expect(state().stage).toBe('idle');

  await submit();
  type('name', 'C');
  await act(async () => {
    fireEvent.click(screen.getByText('ok'));
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith({ name: 'B', email: 'a@x' }, { name: 'B', email: 'a@x' });
  expect(state().dirty).toBe(true);
});

it('S4 저장 결과가 있으면 그것이 기준선이고, 저장 중 입력은 지우지 않는다', async () => {
  const pending = deferred<{ saved: Values }>();
  const onSaved = vi.fn();
  render(<Screen schema={schema} source={original} save={() => pending.promise} onSaved={onSaved} />);
  type('name', 'A2');
  await submit();
  type('name', 'B');
  await act(async () => pending.resolve({ saved: { name: 'A2-saved', email: 'a@x' } }));
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('B');
  expect(state().dirty).toBe(true);
  expect(onSaved).toHaveBeenCalledTimes(1);
  type('name', 'A2');
  expect(state().dirty).toBe(true);
  type('name', 'A2-saved');
  expect(state().dirty).toBe(false);
});

it('S4b 저장 중 입력이 그대로면 저장 결과가 기준선과 입력에 함께 들어가 clean이다', async () => {
  render(
    <Screen schema={schema} source={original} save={async (values) => ({ saved: { ...values } })} />,
  );
  type('name', ' 홍길동 ');
  await submit();
  await flush();
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('홍길동');
  expect(state().dirty).toBe(false);
});

it('S5 저장 결과가 없으면 제출한 폼 값 S가 기준선이다', async () => {
  render(<Screen schema={schema} source={original} save={async () => undefined} />);
  type('name', ' B ');
  expect(state().dirty).toBe(true);
  await submit();
  await flush();
  expect(state().dirty).toBe(false);
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe(' B ');
});

it('S6 실패: 입력·기준선 유지, 실패는 그대로 노출, 필드 오류는 제출 값이 그대로인 필드에만 붙는다', async () => {
  const pending = deferred<undefined>();
  render(
    <Screen
      schema={schema}
      source={original}
      save={() => pending.promise}
      fieldError={(error) => ({ field: error.field as 'name' | 'email', message: `server:${error.code}` })}
    />,
  );
  type('name', 'B');
  type('email', 'b@x');
  await submit();
  type('name', 'C');
  await act(async () =>
    pending.reject(
      new RequestFailure({
        kind: 'validation',
        status: 400,
        fieldErrors: [
          { field: 'name', code: 'Dup' },
          { field: 'email', code: 'Email' },
        ],
      }),
    ),
  );
  await flush();
  expect(screen.getByTestId('name-error').textContent).toBe('');
  expect(screen.getByTestId('email-error').textContent).toBe('server:Email');
  expect(document.activeElement).toBe(screen.getByLabelText('email'));
  expect(state()).toMatchObject({ dirty: true, stage: 'idle', failure: 'validation (http 400)', unattached: ['name'] });
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('C');
});

it('S7 다음 제출은 지난 서버 필드 오류와 실패를 지운다', async () => {
  let fail = true;
  render(
    <Screen
      schema={schema}
      source={original}
      save={async () => {
        if (fail) throw new RequestFailure({ kind: 'validation', status: 400, fieldErrors: [{ field: 'email', code: 'Email' }] });
      }}
      fieldError={(error) => ({ field: error.field as 'email', message: `server:${error.code}` })}
    />,
  );
  await submit();
  await flush();
  expect(screen.getByTestId('email-error').textContent).toBe('server:Email');
  fail = false;
  await submit();
  await flush();
  expect(screen.getByTestId('email-error').textContent).toBe('');
  expect(state().failure).toBeUndefined();
  expect(state().unattached).toEqual([]);
});

it('S8 취소된 저장은 실패로 보이지 않는다', async () => {
  render(
    <Screen schema={schema} source={original} save={async () => { throw new RequestFailure({ kind: 'cancelled' }); }} />,
  );
  type('name', 'B');
  await submit();
  await flush();
  expect(state()).toMatchObject({ stage: 'idle', dirty: true });
  expect(state().failure).toBeUndefined();
});

it('S9 저장 중 레코드가 바뀌면 이전 저장 결과를 새 폼에 적용하지 않는다', async () => {
  const pending = deferred<{ saved: Values }>();
  const onSaved = vi.fn();
  const props = { schema, save: () => pending.promise, onSaved };
  const view = render(<Screen {...props} source={original} />);
  type('name', 'B');
  await submit();
  view.rerender(<Screen {...props} source={{ id: 2, values: { name: 'Z', email: 'z@x' } }} />);
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('Z');
  await act(async () => pending.resolve({ saved: { name: 'B', email: 'a@x' } }));
  expect(onSaved).not.toHaveBeenCalled();
  expect(state()).toMatchObject({ dirty: false, stage: 'idle' });
});

it('S10 같은 레코드 원본 재도착: 손대지 않았으면 교체, 고쳤으면 입력 유지, 저장 중이면 교체하지 않음', async () => {
  const pending = deferred<undefined>();
  const props = { schema, save: () => pending.promise };
  const view = render(<Screen {...props} source={original} />);
  view.rerender(<Screen {...props} source={{ id: 1, values: { name: 'A-new', email: 'a@x' } }} />);
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('A-new');
  expect(state().dirty).toBe(false);

  type('email', 'mine');
  view.rerender(<Screen {...props} source={{ id: 1, values: { name: 'A-newer', email: 'a@x' } }} />);
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('A-new');
  expect((screen.getByLabelText('email') as HTMLInputElement).value).toBe('mine');

  type('email', 'a@x');
  view.rerender(<Screen {...props} source={{ id: 1, values: { name: 'A-new', email: 'a@x' } }} />);
  await submit();
  view.rerender(<Screen {...props} source={{ id: 1, values: { name: 'server', email: 'a@x' } }} />);
  expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('A-new');
  await act(async () => pending.resolve(undefined));
});

it('S11 화면을 떠난 뒤 끝난 저장은 성공 후 할 일을 실행하지 않는다', async () => {
  const pending = deferred<undefined>();
  const onSaved = vi.fn();
  const view = render(<Screen schema={schema} source={original} save={() => pending.promise} onSaved={onSaved} />);
  await submit();
  view.unmount();
  await act(async () => pending.resolve(undefined));
  expect(onSaved).not.toHaveBeenCalled();
});

it('S12 A 저장 중 B로 바뀌면 B는 바로 저장할 수 있고, 늦게 끝난 A는 B의 잠금·오류·focus를 건드리지 않는다', async () => {
  const saves: { name: string; pending: ReturnType<typeof deferred<undefined>> }[] = [];
  const props = {
    schema,
    save: (values: Output) => {
      const pending = deferred<undefined>();
      saves.push({ name: values.name, pending });
      return pending.promise;
    },
    fieldError: (error: { field: string; code: string }) => ({ field: error.field as 'name', message: `server:${error.code}` }),
  };
  const view = render(<Screen {...props} source={original} />);
  await submit();
  expect(saves.map((save) => save.name)).toEqual(['A']);

  view.rerender(<Screen {...props} source={{ id: 2, values: { name: 'B', email: 'b@x' } }} />);
  await submit();
  expect(saves.map((save) => save.name)).toEqual(['A', 'B']);

  await act(async () =>
    saves[0]!.pending.reject(
      new RequestFailure({ kind: 'validation', status: 400, fieldErrors: [{ field: 'name', code: 'Dup' }] }),
    ),
  );
  await flush();
  expect(state()).toMatchObject({ stage: 'saving' });
  expect(state().failure).toBeUndefined();
  expect(screen.getByTestId('name-error').textContent).toBe('');
  expect(document.activeElement).not.toBe(screen.getByLabelText('name'));
  await submit();
  expect(saves).toHaveLength(2);
  await act(async () => saves[1]!.pending.resolve(undefined));
  expect(state()).toMatchObject({ stage: 'idle', dirty: false });
});

it('S13 File 같은 값은 복사하지 않고 같은 객체로 저장 함수에 전달한다', async () => {
  interface WithFile {
    readonly name: string;
    readonly email: string;
    readonly file?: File;
  }
  const file = new File(['x'], 'seat.png', { type: 'image/png' });
  const fileSchema: StandardSchemaV1<WithFile, WithFile> = {
    '~standard': { version: 1, vendor: 'test', validate: (value) => ({ value: value as WithFile }) },
  };
  const save = vi.fn(async (_values: WithFile, _submitted: WithFile) => undefined);
  function FileScreen() {
    const form = useSaveForm({ schema: fileSchema, source: { id: 1, values: { name: 'A', email: 'a@x', file } }, save });
    return <button onClick={() => void form.submit()}>save</button>;
  }
  render(<FileScreen />);
  await submit();
  await flush();
  expect(save).toHaveBeenCalledTimes(1);
  const [values, submitted] = save.mock.calls[0]!;
  expect(values.file).toBe(file);
  expect(submitted.file).toBeInstanceOf(File);
});

it('S14 필드 blur 오류가 떠 있어도 제출은 전체 검증을 돌려 다른 필드 오류도 보이고 저장하지 않는다', async () => {
  const save = vi.fn(async () => undefined);
  function BlurScreen() {
    const form = useSaveForm({ schema, source: { id: 1, values: { name: '', email: '' } }, save });
    return (
      <form onSubmit={(event) => { event.preventDefault(); void form.submit(); }}>
        <form.form.Field name="name">
          {(field) => (
            <>
              <input id={form.fieldId('name')} aria-label="name" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
              <span data-testid="name-error">{errorText(field.state.meta.errors)}</span>
            </>
          )}
        </form.form.Field>
        <form.form.Field name="email" validators={{ onBlur: ({ value }) => (value.includes('@') ? undefined : 'email') }}>
          {(field) => (
            <>
              <input id={form.fieldId('email')} aria-label="email" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
              <span data-testid="email-error">{errorText(field.state.meta.errors)}</span>
            </>
          )}
        </form.form.Field>
        <button type="submit">save</button>
      </form>
    );
  }
  render(<BlurScreen />);
  fireEvent.change(screen.getByLabelText('email'), { target: { value: 'x' } });
  fireEvent.blur(screen.getByLabelText('email'));
  await flush();
  expect(screen.getByTestId('email-error').textContent).toBe('email');
  await submit();
  await flush();
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByTestId('name-error').textContent).toBe('required');
  expect(document.activeElement).toBe(screen.getByLabelText('name'));
});

it('S15 기준선을 읽기 전용으로 노출한다: 처음엔 원본, 저장 뒤엔 저장 결과', async () => {
  let latestBaseline: Values | undefined;
  function BaselineScreen() {
    const form = useSaveForm({ schema, source: original, save: async () => ({ saved: { name: 'A-saved', email: 'a@x' } }) });
    latestBaseline = form.baseline;
    return <button onClick={() => void form.submit()}>save</button>;
  }
  render(<BaselineScreen />);
  expect(latestBaseline).toEqual(original.values);
  await submit();
  await flush();
  expect(latestBaseline).toEqual({ name: 'A-saved', email: 'a@x' });
});

it('S14b 필드 blur 오류를 고친 뒤 칸을 떠나지 않고 제출(Enter)해도 다시 판정해 저장한다', async () => {
  const save = vi.fn(async () => undefined);
  function EnterScreen() {
    const form = useSaveForm({ schema, source: { id: 1, values: { name: 'A', email: '' } }, save });
    return (
      <form data-testid="enter-form" onSubmit={(event) => { event.preventDefault(); void form.submit(); }}>
        <form.form.Field name="email" validators={{ onBlur: ({ value }) => (value.includes('@') ? undefined : 'email') }}>
          {(field) => (
            <>
              <input id={form.fieldId('email')} aria-label="email" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} />
              <span data-testid="email-error">{errorText(field.state.meta.errors)}</span>
            </>
          )}
        </form.form.Field>
      </form>
    );
  }
  render(<EnterScreen />);
  fireEvent.change(screen.getByLabelText('email'), { target: { value: 'x' } });
  fireEvent.blur(screen.getByLabelText('email'));
  await flush();
  expect(screen.getByTestId('email-error').textContent).toBe('email');
  fireEvent.change(screen.getByLabelText('email'), { target: { value: 'x@y' } });
  await act(async () => {
    fireEvent.submit(screen.getByTestId('enter-form'));
  });
  await flush();
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('email-error').textContent).toBe('');
});

it('S16 onSaved는 저장 함수가 돌려준 결과를 받는다(등록 뒤 새 id로 이동 등)', async () => {
  const onSaved = vi.fn();
  function CreateScreen() {
    const form = useSaveForm({
      schema,
      source: original,
      save: async () => ({ id: 42 }),
      onSaved: (result) => onSaved(result.id),
    });
    return <button onClick={() => void form.submit()}>save</button>;
  }
  render(<CreateScreen />);
  await submit();
  await flush();
  expect(onSaved).toHaveBeenCalledWith(42);
});

it('S17 onSaved가 불리는 순간 화면은 이미 저장 결과를 반영해 clean이다(저장 직후 이동에서 이탈 보호가 열리지 않는다)', async () => {
  const seen: { dirty: boolean; stage: string }[] = [];
  render(
    <Screen
      schema={schema}
      source={original}
      save={async (values) => ({ saved: { ...values } })}
      onSaved={() => seen.push({ dirty: state().dirty, stage: state().stage })}
    />,
  );
  type('name', 'A2');
  await submit();
  await flush();
  expect(seen).toEqual([{ dirty: false, stage: 'idle' }]);
});

it('S17b 저장 중 입력이 바뀌었다면 onSaved가 불리는 순간에도 dirty로 남는다(바뀐 입력은 이동 때 보호된다)', async () => {
  const pending = deferred<{ saved: Values }>();
  const seen: { dirty: boolean; stage: string }[] = [];
  render(
    <Screen
      schema={schema}
      source={original}
      save={() => pending.promise}
      onSaved={() => seen.push({ dirty: state().dirty, stage: state().stage })}
    />,
  );
  type('name', 'A2');
  await submit();
  type('name', 'B');
  await act(async () => pending.resolve({ saved: { name: 'A2', email: 'a@x' } }));
  expect(seen).toEqual([{ dirty: true, stage: 'idle' }]);
});
