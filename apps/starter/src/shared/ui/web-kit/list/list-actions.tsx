// 파일 책임: 선택 기반 작업·일괄 확인·값 선택 일괄 작업·다운로드를 연결한다.
import { useBulkConfirmation, useListDownloadBinding, type DownloadControl, type DownloadKind, type ListModel } from '@boosterlab/web-kit/list';
import { useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { SelectBox } from '../select-box';
import { ConfirmDialog } from '../ui/dialog';
import { Pending } from '../ui/pending';
import { useListContext, defaultMessages, OptionSelect, type Context, type RenderFailure } from './list-context';


/** 선택 기반 쓰기 액션 자리. 이전 조건 결과를 보이는 동안 통째로 잠근다. */
function Actions({ model: explicitModel, children, className }: { readonly children: ReactNode; readonly className?: string } & { readonly model?: ListModel }) {
  const { model } = useListContext(explicitModel);
  return (
    <fieldset disabled={!model.isCurrent || model.selection.isRunning || model.selection.failure !== undefined} className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      {children}
    </fieldset>
  );
}

/** 일괄 작업 실패 문구. 업무 거절(string)은 그대로, 그 밖의 실패는 renderFailure → 기본 문구 순이다. null이면 그리지 않는다. */
function bulkErrorText(error: unknown, copy: Context['copy'], renderFailure: RenderFailure): ReactNode | null {
  if (error === undefined) return null;
  if (typeof error === 'string') return error;
  const custom = renderFailure(error, 'action');
  return custom === undefined ? copy.actionFailed : custom;
}

/** 일괄 작업 확인창과 확인창 밖 실패 줄. BulkAction·BulkSelectAction이 같은 모양을 쓴다. */
function BulkConfirm({
  open,
  title,
  running,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  body,
  errorText,
  recovery,
  reloadLabel,
  unknownMessage,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly running: boolean;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly body: ReactNode;
  readonly errorText: ReactNode | null;
  readonly recovery?: { readonly pending: boolean; readonly run: () => Promise<void> };
  readonly reloadLabel: string;
  readonly unknownMessage: string;
}) {
  return (
    <>
      <ConfirmDialog open={open} title={title} pending={running || recovery?.pending} confirmLabel={recovery ? reloadLabel : confirmLabel} cancelLabel={cancelLabel} onConfirm={recovery ? () => void recovery.run() : onConfirm} onCancel={onCancel}>
        {recovery ? <p>{unknownMessage}</p> : open ? body : null}
        {errorText !== null && (
          <p role="alert" className="text-sm text-destructive">
            {errorText}
          </p>
        )}
      </ConfirmDialog>
      {!open && recovery && (
        <div role="alert">
          <p>{unknownMessage}</p>
          <Button type="button" disabled={recovery.pending} onClick={() => void recovery.run()}>{reloadLabel}</Button>
          {recovery.pending ? <Pending label={reloadLabel} /> : null}
        </div>
      )}
      {!open && errorText !== null && (
        <p role="alert" className="text-sm text-destructive">
          {errorText}
        </p>
      )}
    </>
  );
}

/** 확인창을 거치는 일괄 작업. 확인 당시 결과와 선택이 바뀌면 실행하지 않고, 실패는 확인창에 남기며 선택은 유지한다. */
function BulkAction<T>({
  model: explicitModel,
  label,
  run,
  check,
  title = label,
  confirmLabel,
  cancelLabel,
  describe,
}: {
  readonly label: string;
  readonly run: (ids: readonly string[]) => Promise<{ completedIds: readonly string[]; value?: T }>;
  /** 업무상 거절 사유. 있으면 실행하지 않고 보인다. */
  readonly check?: (ids: readonly string[]) => string | undefined;
  readonly title?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly describe?: (ids: readonly string[]) => ReactNode;
} & { readonly model?: ListModel }) {
  const { model, copy, renderFailure } = useListContext(explicitModel);
  const { pending, error, confirm, locked, open, cancel, recovery } = useBulkConfirmation({ model, run, check });
  return (
    <>
      <Button type="button" variant="outline" disabled={locked} onClick={open}>
        {label}
      </Button>
      <BulkConfirm
        open={pending !== undefined}
        title={title}
        running={model.selection.isRunning}
        confirmLabel={confirmLabel ?? copy.confirm}
        cancelLabel={cancelLabel ?? copy.cancel}
        onConfirm={() => void confirm()}
        onCancel={cancel}
        body={pending === undefined ? null : (describe?.(pending.ids) ?? `${pending.ids.length}${copy.items}`)}
        errorText={bulkErrorText(error, copy, renderFailure)}
        recovery={recovery}
        reloadLabel={copy.reload ?? defaultMessages.reload}
        unknownMessage={copy.resultUnknown ?? defaultMessages.resultUnknown}
      />
    </>
  );
}

/**
 * 고른 값 하나로 선택 행을 바꾸는 일괄 작업(상태 변경 등). 선택 칸 + 실행 버튼 + 확인창을 한 묶음(fieldset)으로 그린다.
 * 확인창을 여는 순간의 행 id와 값을 함께 고정해 업무 확인·실행·문구에 쓴다(열린 뒤 선택 칸이 바뀌어도 확인한 값으로 실행한다).
 * 값을 고르지 않고 누르면 실행하지 않고 requiredMessage(없으면 messages.chooseValue)를 보인다. 성공 뒤에도 고른 값은 그대로 둔다.
 * 이전 조건 결과를 보이는 동안 묶음 전체가 잠긴다. 확인 당시 결과·선택이 바뀌면 실행하지 않는 것, 실패 선택 유지, 중복 실행 방지는 BulkAction과 같다.
 */
function BulkSelectAction<V extends string, T = unknown>({
  model: explicitModel,
  label,
  options,
  placeholder,
  selectLabel,
  selectClassName,
  requiredMessage,
  defaultValue,
  run,
  check,
  title = label,
  confirmLabel,
  cancelLabel,
  describe,
  className,
}: {
  /** 실행 버튼 문구. */
  readonly label: string;
  readonly options: readonly { readonly value: V; readonly label: string; readonly disabled?: boolean }[];
  /** 값을 고르기 전 선택 칸에 보이는 문구. */
  readonly placeholder?: string;
  /** 선택 칸의 접근성 이름. 생략하면 label. */
  readonly selectLabel?: string;
  /** 선택 칸의 크기·모양(기본 min-w-32 뒤에 합친다). */
  readonly selectClassName?: string;
  /** 값을 고르지 않고 눌렀을 때의 안내. 생략하면 messages.chooseValue. */
  readonly requiredMessage?: string;
  readonly defaultValue?: V;
  readonly run: (ids: readonly string[], value: V) => Promise<{ completedIds: readonly string[]; value?: T }>;
  /** 업무상 거절 사유. 있으면 실행하지 않고 보인다. 여는 순간은 지금 고른 값, 실행 직전은 확인창에 고정한 값으로 묻는다. */
  readonly check?: (ids: readonly string[], value: V) => string | undefined;
  readonly title?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly describe?: (ids: readonly string[], value: V) => ReactNode;
  /** 묶음(fieldset)의 배치. */
  readonly className?: string;
} & { readonly model?: ListModel }) {
  const { model, copy, renderFailure } = useListContext(explicitModel);
  const [chosen, setChosen] = useState<V | null>(defaultValue ?? null);
  // 선택지가 바뀌어 고른 값이 사라졌거나 막혔으면 고르지 않은 것으로 본다.
  const value = chosen !== null && options.some((option) => option.value === chosen && option.disabled !== true) ? chosen : null;
  const { pending, error, confirm, locked, open, cancel, recovery } = useBulkConfirmation<T, V>({
    model,
    value: value ?? undefined,
    run: (ids, target) => target === undefined
      ? Promise.reject(requiredMessage ?? copy.chooseValue)
      : run(ids, target),
    check: (ids, target) => target === undefined || !options.some(option => option.value === target && option.disabled !== true)
      ? (requiredMessage || copy.chooseValue || defaultMessages.chooseValue)
      : check?.(ids, target),
  });
  const fixed = pending?.value;
  const optionLabel = options.find((option) => option.value === fixed)?.label ?? fixed;
  return (
    <fieldset disabled={!model.isCurrent} className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      <SelectBox
        aria-label={selectLabel ?? label}
        className={cn('min-w-32', selectClassName)}
        options={options}
        placeholder={placeholder}
        value={value}
        disabled={!model.isCurrent || model.selection.isRunning}
        onValueChange={(next) => setChosen(next as V | null)}
      />
      <Button type="button" variant="outline" disabled={locked} onClick={open}>
        {label}
      </Button>
      <BulkConfirm
        open={pending !== undefined}
        title={title}
        running={model.selection.isRunning}
        confirmLabel={confirmLabel ?? copy.confirm}
        cancelLabel={cancelLabel ?? copy.cancel}
        onConfirm={() => void confirm()}
        onCancel={cancel}
        body={pending === undefined || fixed === undefined ? null : (describe?.(pending.ids, fixed) ?? `${optionLabel}: ${pending.ids.length}${copy.items}`)}
        errorText={bulkErrorText(error, copy, renderFailure)}
        recovery={recovery}
        reloadLabel={copy.reload ?? defaultMessages.reload}
        unknownMessage={copy.resultUnknown ?? defaultMessages.resultUnknown}
      />
    </fieldset>
  );
}

/** 다운로드 종류 선택과 실행 버튼. 진행 중에는 잠기고 실패는 원인과 함께 남는다. kinds 순서대로 보인다. */
function Download({
  model: explicitModel,
  control,
  kinds = ['all', 'selected'],
  label,
}: {
  readonly control: DownloadControl;
  readonly kinds?: readonly DownloadKind[];
  readonly label?: string;
} & { readonly model?: ListModel }) {
  const { copy, renderFailure } = useListContext(explicitModel);
  const { kind, blocked, change, start } = useListDownloadBinding(control, kinds);
  const kindLabel = (value: DownloadKind) => (value === 'all' ? copy.downloadAll : copy.downloadSelected);
  const custom = control.state.kind === 'failed' ? renderFailure(control.state.failure, 'download') : null;
  const failure = control.state.kind !== 'failed' ? null : custom === undefined ? copy.downloadFailed : custom;
  const running = control.state.kind === 'running';
  return (
    <span className="inline-flex flex-wrap items-center gap-2" aria-busy={running || undefined}>
      <OptionSelect
        aria-label={copy.downloadKind}
        disabled={running}
        value={kind}
        onValueChange={(next) => change(next)}
        options={[{ value: '', label: copy.downloadChoose }, ...kinds.map((value) => ({ value, label: kindLabel(value) }))]}
      />
      <Button type="button" variant="outline" disabled={blocked} onClick={start}>
        {label ?? copy.download}
      </Button>
      {/* 진행 중에는 종류·버튼을 잠그고 옆에 로딩 표시만 둔다. 문구는 화면 낭독기에만 읽힌다. */}
      {running && <Pending label={copy.downloading} />}
      {failure !== null && (
        <span role="alert" className="text-sm text-destructive">
          {failure}
        </span>
      )}
    </span>
  );
}

export { Actions, BulkAction, BulkSelectAction, Download };
