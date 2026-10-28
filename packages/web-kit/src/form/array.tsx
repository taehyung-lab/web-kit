// 파일 책임: 줄을 늘리고 줄이고 옮기는 배열 입력의 규칙(삭제 가능 여부, Enter = 추가 버튼)을 한 곳에 둔다. 줄의 모양과 문구는 프로젝트가 그린다.
// 줄 작업은 rows.ts가 맡아 칸 오류·서버 오류가 줄을 따라간다(중첩 배열 포함).
import { useStore, type AnyFieldApi, type DeepKeysOfType, type DeepValue, type FieldComponent } from '@tanstack/react-form';
import type { KeyboardEvent, ReactNode } from 'react';
import { appendRow, moveRow, removeRow } from './rows';

type ArrayItem<TValues, TName extends DeepKeysOfType<TValues, unknown[]>> =
  DeepValue<TValues, TName> extends (infer TItem)[] ? TItem : never;

/** useSaveForm의 form처럼 배열 필드를 그릴 수 있는 폼. 검증기 인자는 의도적으로 지운다. */
export interface ArrayForm<TValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly Field: FieldComponent<TValues, any, any, any, any, any, any, any, any, any, any, any>;
}

export interface FormArrayRows<TItem> {
  readonly items: readonly TItem[];
  readonly errors: readonly unknown[];
  /** 지금 줄을 더할 수 있는지(최대 줄 수 미만). */
  readonly canAdd: boolean;
  /** 지금 줄을 지울 수 있는지(최소 줄 수 초과). 거짓이면 삭제 버튼을 그리지 않는다. */
  readonly canRemove: boolean;
  readonly append: (value: TItem) => void;
  readonly remove: (index: number) => void;
  /** 줄 하나를 from에서 to로 옮긴다. 칸 오류는 각자 줄을 따라간다. */
  readonly move: (from: number, to: number) => void;
  /**
   * 줄 안 입력의 onKeyDown. Enter가 `add`(추가 버튼이 하는 일)를 그대로 부르게 한다.
   * 폼 제출은 막고, 한글 조합 중이거나 수정키가 함께 눌렸으면 아무것도 하지 않는다.
   * 최대 줄 수에서는 추가하지 않으며 제출도 하지 않는다.
   */
  readonly enterAdds: (add: () => void) => (event: KeyboardEvent) => void;
}

export function FormArrayField<TValues, const TName extends DeepKeysOfType<TValues, unknown[]>>({
  form,
  name,
  minItems = 0,
  maxItems = Number.POSITIVE_INFINITY,
  children,
}: {
  readonly form: ArrayForm<TValues>;
  readonly name: TName;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly children: (rows: FormArrayRows<ArrayItem<TValues, TName>>) => ReactNode;
}) {
  return (
    <form.Field name={name} mode="array">
      {(field) => (
        <Rows field={field} name={name} minItems={minItems} maxItems={maxItems}>
          {children}
        </Rows>
      )}
    </form.Field>
  );
}

/**
 * TanStack Form의 배열 필드는 줄 안의 값만 바뀌면 다시 그려지지 않는다. 추가 버튼이 읽는 items가 낡은 값이 되지 않도록
 * 폼 저장소를 직접 구독해 값과 오류가 바뀔 때마다 새로 그린다.
 */
function Rows<TItem>({
  field,
  name,
  minItems,
  maxItems,
  children,
}: {
  readonly field: AnyFieldApi;
  readonly name: string;
  readonly minItems: number;
  readonly maxItems: number;
  readonly children: (rows: FormArrayRows<TItem>) => ReactNode;
}) {
  const items = useStore(field.form.store, () => field.form.getFieldValue(name as never) as TItem[]);
  const errors = useStore(field.store, (state) => state.meta.errors);
  const canAdd = items.length < maxItems;
  const canRemove = items.length > minItems;
  return children({
    items,
    errors,
    canAdd,
    canRemove,
    append: (value) => {
      if (canAdd) void appendRow(field.form, name, value);
    },
    remove: (index) => {
      if (canRemove) void removeRow(field.form, name, index);
    },
    move: (from, to) => {
      void moveRow(field.form, name, from, to);
    },
    enterAdds: (add) => (event) => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      if (canAdd) add();
    },
  });
}
