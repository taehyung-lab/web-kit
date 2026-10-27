/** 저장 module과 기본 필드·확인·이탈 UI를 연결한다. 업무 검증과 서버 의미는 소비자가 제공한다. */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { useBlocker, useRouter, type NavigateOptions } from '@tanstack/react-router';
import { useSelector, type DeepKeys, type DeepKeysOfType, type DeepValue } from '@tanstack/react-form';
import { useSaveForm, type SaveFormOptions } from './save-form';
import { createFormNavigation } from './navigation';
import { FormArrayField, type FormArrayRows } from './array';
import { FieldFrame, type FieldControlProps } from './field';
import { ConfirmDialog, KitDialog } from '../ui/dialog';

const NavigationContext = createContext<ReturnType<typeof createFormNavigation> | undefined>(undefined);
const ScopeContext = createContext<{ id: object; close: () => void } | undefined>(undefined);
const EditorContext = createContext<unknown>(undefined);
const MessagesContext = createContext({
  leaveTitle: '입력을 버리고 이동할까요?',
  leaveDescription: '저장하지 않은 변경이 있습니다.',
  leaveConfirm: '이동',
  keep: '계속 편집',
  saveTitle: '저장할까요?',
  saveConfirm: '저장',
  cancel: '취소',
  navigationFailed: '이동하지 못했습니다. 다시 시도해 주세요.',
  saveFailed: '저장하지 못했습니다. 입력을 확인해 주세요.',
  unattached: '입력에 연결하지 못한 서버 오류가 있습니다. 저장 내용을 확인해 주세요.',
  completionFailed: '저장은 완료됐지만 다음 작업을 진행하지 못했습니다.',
});
export type FormMessages = React.ContextType<typeof MessagesContext>;
export type FormIntent =
  { readonly kind: 'close' } | { readonly kind: 'navigate'; readonly destination: Omit<NavigateOptions, 'ignoreBlocker'> };

/** 보호를 설치하지 않은 기본 폼은 조용히 보호 없이 실행하지 않는다. */
function useNavigationOwner() {
  const owner = useContext(NavigationContext);
  if (owner === undefined) throw new Error('SaveForm requires FormNavigation inside the router');
  return owner;
}

/** 앱에 한 번 설치하는 Router·브라우저 이탈 연결과 단일 확인 UI다. */
export function FormNavigation({ children, messages }: { readonly children: ReactNode; readonly messages?: Partial<FormMessages> }) {
  const [owner] = useState(createFormNavigation);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const defaults = useContext(MessagesContext);
  const copy = { ...defaults, ...messages };
  const blocker = useBlocker({ shouldBlockFn: () => owner.blocked(), withResolver: true, enableBeforeUnload: () => owner.blocked() });
  const proceed = blocker.status === 'blocked' ? blocker.proceed : undefined;
  const reset = blocker.status === 'blocked' ? blocker.reset : undefined;
  useEffect(() => {
    if (proceed === undefined) return;
    const result = owner.request(proceed, undefined, reset);
    if (result === 'blocked') reset?.();
  }, [owner, proceed, reset]);
  return (
    <NavigationContext.Provider value={owner}>
      <MessagesContext.Provider value={copy}>
        {children}
        <ConfirmDialog
          open={owner.pending}
          title={copy.leaveTitle}
          confirmLabel={copy.leaveConfirm}
          cancelLabel={copy.keep}
          onConfirm={owner.confirm}
          onCancel={owner.cancel}
        >
          {copy.leaveDescription}
        </ConfirmDialog>
        {owner.failure !== undefined && <p role="alert">{copy.navigationFailed}</p>}
      </MessagesContext.Provider>
    </NavigationContext.Provider>
  );
}

/** 닫히는 다이얼로그 안 모든 폼을 같은 범위로 묶는다. */
export function FormDialog({
  open,
  onClosed,
  title,
  children,
}: {
  readonly open: boolean;
  readonly onClosed: () => void;
  readonly title: string;
  readonly children: ReactNode;
}) {
  const owner = useNavigationOwner();
  const parent = useContext(ScopeContext);
  const [id] = useState(() => ({}));
  useLayoutEffect(() => (open ? owner.registerScope(id, parent?.id) : undefined), [owner, id, parent?.id, open]);
  if (!open) return null;
  return (
    <ScopeContext.Provider value={{ id, close: onClosed }}>
      <KitDialog
        open
        title={title}
        onClose={() => {
          owner.request(onClosed, id);
        }}
      >
        {children}
      </KitDialog>
    </ScopeContext.Provider>
  );
}

type Model<T> = ReturnType<typeof useSaveForm<T, unknown, unknown>> & {
  readonly formatError?: (errors: readonly unknown[]) => string | undefined;
};
type Required<T> = boolean | ((values: T) => boolean);
type KeysOf<T, V> = { [K in DeepKeys<T>]: DeepValue<T, K> extends V ? K : never }[DeepKeys<T>];
interface CommonField<T, K extends DeepKeys<T>> {
  readonly name: K;
  readonly label: string;
  readonly description?: string;
  readonly required?: Required<T>;
  readonly disabled?: boolean;
}
export interface FormControl<T> extends FieldControlProps {
  readonly value: T;
  readonly change: (value: T) => void;
  readonly blur: () => void;
  readonly 'aria-required': boolean;
}
export interface FormFields<T> {
  Text: <K extends KeysOf<T, string>>(
    props: CommonField<T, K> & {
      readonly type?: 'text' | 'email' | 'password' | 'tel' | 'date' | 'number' | 'url' | 'search';
      readonly autoComplete?: string;
      readonly autoFocus?: boolean;
      readonly inputMode?: 'numeric' | 'decimal' | 'text';
      readonly onKeyDown?: (event: KeyboardEvent) => void;
    },
  ) => ReactNode;
  TextArea: <K extends KeysOf<T, string>>(props: CommonField<T, K>) => ReactNode;
  Array: <K extends DeepKeysOfType<T, unknown[]>>(props: {
    readonly name: K;
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly children: (rows: FormArrayRows<DeepValue<T, K> extends (infer Item)[] ? Item : never>) => ReactNode;
  }) => ReactNode;
  Checkbox: <K extends KeysOf<T, boolean>>(props: CommonField<T, K>) => ReactNode;
  Select: <K extends KeysOf<T, string>>(
    props: CommonField<T, K> & { readonly options: readonly { value: DeepValue<T, K>; label: string }[] },
  ) => ReactNode;
  Field: <K extends DeepKeys<T>>(
    props: CommonField<T, K> & { readonly children: (control: FormControl<DeepValue<T, K>>) => ReactNode },
  ) => ReactNode;
  Actions: (props: { readonly submitLabel?: string; readonly cancelLabel?: string; readonly cancel?: FormIntent }) => ReactNode;
}

/** 타입이 연결된 필드 묶음을 한 번 만들어 입력 중 재마운트를 막는다. */
function createFields<T>(): FormFields<T> {
  /** 같은 컨텍스트에서 현재 저장 상태를 읽는다. */
  function useEditor() {
    const value = useContext(EditorContext);
    if (value === undefined) throw new Error('Form field requires SaveForm');
    return value as Model<T>;
  }
  /** 오류 표시 문구를 고르고 원시 응답 객체는 노출하지 않는다. */
  function message(errors: readonly unknown[]) {
    for (const error of errors) {
      if (typeof error === 'string') return error;
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
    }
    return undefined;
  }
  /** 필드 등록·라벨·필수·오류·입력 이벤트를 연결한다. */
  function Field<K extends DeepKeys<T>>({
    name,
    label,
    description,
    required = false,
    children,
  }: CommonField<T, K> & { children: (control: FormControl<DeepValue<T, K>>) => ReactNode }) {
    const editor = useEditor();
    const values = useSelector(editor.form.store, (state) => state.values);
    const isRequired = typeof required === 'function' ? required(values) : required;
    return (
      <editor.form.Field name={name}>
        {(field) => (
          <FieldFrame
            id={editor.fieldId(name)}
            label={label}
            description={description}
            required={isRequired}
            message={editor.formatError?.(field.state.meta.errors) ?? message(field.state.meta.errors)}
            classes={{ root: 'wk-field', label: 'wk-label', required: 'wk-required', description: 'wk-description', error: 'wk-error' }}
          >
            {(control) =>
              children({
                ...control,
                value: field.state.value,
                change: (value) => field.handleChange(value),
                blur: field.handleBlur,
                'aria-required': isRequired,
              })
            }
          </FieldFrame>
        )}
      </editor.form.Field>
    );
  }
  /** 문자열 필드를 기본 입력에 연결한다. */
  function Text<K extends KeysOf<T, string>>(
    props: CommonField<T, K> & {
      type?: 'text' | 'email' | 'password' | 'tel' | 'date' | 'number' | 'url' | 'search';
      autoComplete?: string;
      autoFocus?: boolean;
      inputMode?: 'numeric' | 'decimal' | 'text';
      onKeyDown?: (event: KeyboardEvent) => void;
    },
  ) {
    return (
      <Field {...props}>
        {({ value, change, blur, ...control }) => (
          <input
            {...control}
            className="wk-input"
            type={props.type ?? 'text'}
            autoComplete={props.autoComplete}
            autoFocus={props.autoFocus}
            inputMode={props.inputMode}
            onKeyDown={props.onKeyDown}
            disabled={props.disabled}
            value={value as string}
            onChange={(event) => change(event.target.value as DeepValue<T, K>)}
            onBlur={blur}
          />
        )}
      </Field>
    );
  }
  /** boolean 필드를 체크박스에 연결한다. */
  function Checkbox<K extends KeysOf<T, boolean>>(props: CommonField<T, K>) {
    return (
      <Field {...props}>
        {({ value, change, blur, ...control }) => (
          <input
            {...control}
            type="checkbox"
            disabled={props.disabled}
            checked={value as boolean}
            onChange={(event) => change(event.target.checked as DeepValue<T, K>)}
            onBlur={blur}
          />
        )}
      </Field>
    );
  }
  /** 선언한 문자열 선택지를 입력에 연결한다. */
  function Select<K extends KeysOf<T, string>>(
    props: CommonField<T, K> & { options: readonly { value: DeepValue<T, K>; label: string }[] },
  ) {
    return (
      <Field {...props}>
        {({ value, change, blur, ...control }) => (
          <select
            {...control}
            className="wk-input"
            disabled={props.disabled}
            value={value as string}
            onChange={(event) => change(event.target.value as DeepValue<T, K>)}
            onBlur={blur}
          >
            {props.options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  }
  /** 저장과 명시적인 이동·닫기 의도를 연결한다. */
  function Actions({
    submitLabel = '저장',
    cancelLabel = '취소',
    cancel,
  }: {
    submitLabel?: string;
    cancelLabel?: string;
    cancel?: FormIntent;
  }) {
    const editor = useEditor();
    const act = useIntent();
    return (
      <div className="wk-actions">
        <button type="submit" className="wk-button" disabled={editor.stage.kind !== 'idle'}>
          {submitLabel}
        </button>
        {cancel !== undefined && (
          <button type="button" className="wk-button" disabled={editor.isSaving} onClick={() => act(cancel)}>
            {cancelLabel}
          </button>
        )}
      </div>
    );
  }
  /** 여러 줄 문자열을 같은 필드 계약에 연결한다. */
  function TextArea<K extends KeysOf<T, string>>(props: CommonField<T, K>) {
    return (
      <Field {...props}>
        {({ value, change, blur, ...control }) => (
          <textarea
            {...control}
            className="wk-input"
            disabled={props.disabled}
            value={value as string}
            onChange={(event) => change(event.target.value as DeepValue<T, K>)}
            onBlur={blur}
          />
        )}
      </Field>
    );
  }
  /** 기존 배열 수명을 기본 폼 타입에 연결한다. */
  function ArrayField<K extends DeepKeysOfType<T, unknown[]>>(props: {
    name: K;
    minItems?: number;
    maxItems?: number;
    children: (rows: FormArrayRows<DeepValue<T, K> extends (infer Item)[] ? Item : never>) => ReactNode;
  }) {
    const editor = useEditor();
    return <FormArrayField form={editor.form} {...props} />;
  }
  return { Text, TextArea, Array: ArrayField, Checkbox, Select, Field, Actions };
}

/** Router 이동은 일반 차단 경로로 보내고 지역 닫기는 해당 범위를 검사한다. */
function useIntent() {
  const router = useRouter();
  const owner = useNavigationOwner();
  const scope = useContext(ScopeContext);
  return (intent: FormIntent) => {
    if (intent.kind === 'navigate') return router.navigate({ ...intent.destination, ignoreBlocker: false });
    if (scope === undefined) throw new Error('close intent requires FormDialog');
    owner.request(scope.close, scope.id);
  };
}

export type SaveFormProps<T, O, R> = Omit<SaveFormOptions<T, O, R>, 'onSaved'> & {
  /** 명시적인 제품 예외만 기본 이탈 보호를 해제한다(예: 로그인). */
  readonly protect?: boolean;
  readonly children: (fields: FormFields<T>) => ReactNode;
  readonly completion?: (result: R) => FormIntent | void;
  readonly confirmation?: (submitted: T) => ReactNode;
  readonly formatError?: (errors: readonly unknown[]) => string | undefined;
  readonly renderFailure?: (failure: unknown) => ReactNode;
};

/** 일반 폼의 입력·저장·확인·이탈 연결을 한 번 선언한다. */
export function SaveForm<T, O, R>({
  children,
  completion,
  confirmation,
  renderFailure,
  formatError,
  protect = true,
  ...options
}: SaveFormProps<T, O, R>) {
  const owner = useNavigationOwner();
  const scope = useContext(ScopeContext);
  const intent = useIntent();
  const copy = useContext(MessagesContext);
  const editor = useSaveForm({
    ...options,
    onSaved: (result) => {
      const next = completion?.(result);
      if (next !== undefined) return intent(next);
    },
  });
  const submitOrigin = useRef<HTMLElement | null>(null);
  const current = useRef(editor);
  current.current = editor;
  const identity = useRef(options.source.id);
  identity.current = options.source.id;
  const [id] = useState(() => ({}));
  const [fields] = useState(() => createFields<T>());
  useLayoutEffect(
    () =>
      owner.register(id, {
        scope: scope?.id,
        read: () => ({
          dirty: protect && current.current.getState().isDirty,
          busy: protect && current.current.getState().isSaving,
          identity: identity.current,
        }),
      }),
    [owner, id, scope?.id, protect],
  );
  useLayoutEffect(() => {
    owner.changed();
  }, [owner, editor.isDirty, editor.isSaving, options.source.id]);
  useLayoutEffect(() => {
    if (editor.stage.kind === 'idle') owner.releaseConfirmation(id);
  }, [owner, id, editor.stage.kind]);
  useLayoutEffect(() => () => owner.releaseConfirmation(id), [owner, id]);
  useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  return (
    <EditorContext.Provider value={{ ...editor, formatError }}>
      <form
        className="wk-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // 저장 버튼이 비활성화되기 전에 실제 제출 위치를 보존한다.
          submitOrigin.current =
            (event.nativeEvent as SubmitEvent).submitter ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
          if (!options.confirm || owner.claimConfirmation(id))
            void editor.submit().finally(() => {
              if (current.current.getState().stage === 'idle') owner.releaseConfirmation(id);
            });
        }}
      >
        {children(fields)}
        {editor.failure !== undefined && <div role="alert">{renderFailure?.(editor.failure) ?? copy.saveFailed}</div>}
        {editor.unattachedFieldErrors.length > 0 && <p role="alert">{copy.unattached}</p>}
        {editor.completionFailure !== undefined && <p role="alert">{copy.completionFailed}</p>}
      </form>
      <ConfirmDialog
        open={editor.stage.kind !== 'idle' && owner.confirmationOwner === id && !owner.pending}
        pending={editor.isSaving}
        returnFocus={submitOrigin}
        title={copy.saveTitle}
        confirmLabel={copy.saveConfirm}
        cancelLabel={copy.cancel}
        onConfirm={() => {
          void editor.confirm();
        }}
        onCancel={editor.cancel}
      >
        {editor.stage.kind !== 'idle' && confirmation?.(editor.stage.values)}
      </ConfirmDialog>
    </EditorContext.Provider>
  );
}

export * from './field';

export { Button, Field, TextInput, TextArea, SelectInput } from '../ui/inputs';
export { ConfirmDialog } from '../ui/dialog';
