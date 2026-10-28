// 파일 책임: 배열 줄 작업(추가·삭제·이동)과, 그 작업이 칸 오류·서버 오류 위치를 줄과 함께 옮기는 규칙을 소유한다(UI 없음).
// 줄 작업은 폼 인스턴스별 기록에 "이 배열의 번호 i → j(또는 없음)"를 남긴다. useSaveForm은 제출 뒤 작업을 이 기록으로 따라가
// 늦게 온 서버 오류를 제출한 그 줄의 지금 위치에 붙인다. 줄 정체성을 값 안의 key로 추측하지 않는다.
// TanStack Form의 removeValue·moveValue는 중첩 배열에서 경로의 첫 번호(바깥 줄)를 바꿔 다른 줄의 오류를 옮기고, 줄 key가 고정된 화면에서는
// 다시 마운트되는 칸이 옮긴 오류를 지우므로 쓰지 않는다. 줄 작업은 이벤트 처리 안에서 부른다(값 반영을 동기로 끝낸다).
import type { AnyFormApi } from '@tanstack/react-form';
import { flushSync } from 'react-dom';

/** 줄 작업 하나: 배열 경로와 이전 번호 → 새 번호(지워졌으면 undefined). */
interface RowOp {
  readonly path: string;
  readonly map: (index: number) => number | undefined;
}

const logs = new WeakMap<object, RowOp[]>();

/**
 * 이 폼의 줄 작업 기록. useForm이 돌려준 값과 칸이 받는 form은 다른 객체일 수 있어 둘이 함께 쓰는 store로 찾는다.
 */
function logOf(form: object): RowOp[] {
  const key = (form as { readonly store: object }).store;
  let log = logs.get(key);
  if (log === undefined) {
    log = [];
    logs.set(key, log);
  }
  return log;
}

/** 지금까지 기록된 줄 작업 수. 제출 값을 고정할 때 함께 들고, 나중에 그 뒤 작업만 따라간다. */
export function rowMark(form: object): number {
  return logOf(form).length;
}

/** `path` 바로 뒤의 `[n]`만 바꾼다. 그 배열 아래가 아니면 그대로, 줄이 지워졌으면 undefined. */
function shift(field: string, op: RowOp): string | undefined {
  const head = `${op.path}[`;
  if (!field.startsWith(head)) return field;
  const close = field.indexOf(']', head.length);
  const index = Number(field.slice(head.length, close));
  if (close < 0 || !Number.isInteger(index)) return field;
  const next = op.map(index);
  return next === undefined ? undefined : `${head}${next}${field.slice(close)}`;
}

/** 제출 때 경로를 그 뒤 줄 작업을 차례로 따라 지금 경로로 옮긴다. 그 줄(또는 바깥 줄)이 지워졌으면 undefined. */
export function followRows(form: object, field: string, since: number): string | undefined {
  let current: string | undefined = field;
  for (const op of logOf(form).slice(since)) {
    if (current === undefined) return undefined;
    current = shift(current, op);
  }
  return current;
}

type FieldMeta = NonNullable<ReturnType<AnyFormApi['getFieldMeta']>>;

/** 값을 바꾸고, 그 배열 아래 칸 meta(오류 포함)를 줄과 함께 옮기고, 기록한 뒤 배열 칸을 다시 검증한다. */
function apply(form: AnyFormApi, path: string, next: unknown[], map: (index: number) => number | undefined): Promise<void> {
  const op: RowOp = { path, map };
  const head = `${path}[`;
  const before = new Map<string, FieldMeta>();
  for (const field of Object.keys(form.fieldInfo)) {
    if (!field.startsWith(head)) continue;
    const meta = form.getFieldMeta(field);
    if (meta !== undefined) before.set(field, meta);
  }
  // 값을 먼저 화면에 반영한다. 줄 key가 고정된 화면은 칸 부품이 새 이름으로 다시 마운트되며, 그때 TanStack이 이전 이름의 meta를
  // 처음 상태로 되돌린다. 그 정리가 끝난 뒤에 옮긴 meta를 써야 오류가 사라지지 않는다.
  flushSync(() => form.setFieldValue(path, next as never, { dontValidate: true }));
  const moved = new Map<string, FieldMeta>();
  for (const [field, meta] of before) {
    const target = shift(field, op);
    if (target !== undefined) moved.set(target, meta);
  }
  for (const field of before.keys()) {
    if (moved.has(field)) continue;
    const index = Number(field.slice(head.length, field.indexOf(']', head.length)));
    // 줄이 사라진 칸은 지우고, 새로 생긴 줄 자리의 칸은 오류 없는 처음 상태로 둔다.
    if (index >= next.length) form.deleteField(field);
    else form.setFieldMeta(field, (meta) => ({ ...meta, errorMap: {}, errorSourceMap: {}, isTouched: false, isBlurred: false, isDirty: false }));
  }
  for (const [field, meta] of moved) form.setFieldMeta(field, meta);
  logOf(form).push(op);
  // 제출 전에는 검증 시점 규칙(revalidateLogic)에 따라 조용하고, 제출 뒤에는 줄이 바뀐 결과로 오류를 다시 계산한다.
  return Promise.resolve(form.validateField(path, 'change')).then(() => undefined);
}

/** 배열 끝에 줄 하나를 더한다. */
export function appendRow(form: AnyFormApi, path: string, value: unknown): Promise<void> {
  const rows = (form.getFieldValue(path) as unknown[] | undefined) ?? [];
  return apply(form, path, [...rows, value], (index) => index);
}

/** 줄 하나를 지운다. 뒤 줄의 오류는 한 칸씩 당겨져 같은 줄에 남는다. */
export function removeRow(form: AnyFormApi, path: string, index: number): Promise<void> {
  const rows = (form.getFieldValue(path) as unknown[] | undefined) ?? [];
  if (index < 0 || index >= rows.length) return Promise.resolve();
  return apply(
    form,
    path,
    rows.filter((_, i) => i !== index),
    (i) => (i === index ? undefined : i > index ? i - 1 : i),
  );
}

/** 줄 하나를 from에서 to로 옮긴다. 사이 줄은 한 칸씩 밀리고, 오류는 각자 줄을 따라간다. */
export function moveRow(form: AnyFormApi, path: string, from: number, to: number): Promise<void> {
  const rows = (form.getFieldValue(path) as unknown[] | undefined) ?? [];
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return Promise.resolve();
  const next = [...rows];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return apply(form, path, next, (i) => {
    if (i === from) return to;
    if (from < to && i > from && i <= to) return i - 1;
    if (from > to && i >= to && i < from) return i + 1;
    return i;
  });
}
