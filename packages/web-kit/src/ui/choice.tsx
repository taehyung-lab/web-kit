// 파일 책임: 공유하는 선택 값과 트리를 여러 입력 모양 및 서버 검색에 연결한다.
// 파일 책임: 목록·폼이 공유하는 선택 값과 트리·드롭다운·계층 메뉴·자동완성 표현을 연결한다.
import { Checkbox } from '@base-ui/react/checkbox';
import { Combobox } from '@base-ui/react/combobox';
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import type { ReactNode } from 'react';
import { useChoiceBinding } from '../choice-binding';
import { treeLeaves, treeLeafNodes, type CheckboxTreeNode } from '../checkbox-tree';

export type ChoiceNode = CheckboxTreeNode;
export type ChoiceValue = string | readonly string[] | undefined;
export interface ChoiceProps {
  readonly nodes: readonly ChoiceNode[];
  readonly value: ChoiceValue;
  readonly onValueChange: (value: ChoiceValue) => void;
  readonly multiple?: boolean;
  readonly appearance?: 'vertical' | 'horizontal' | 'dropdown' | 'menu' | 'search';
  readonly label: string;
  readonly allLabel?: string;
  readonly placeholder?: string;
  /** 이 이름을 주면 단일 선택을 비우는 동작을 제공한다. placeholder와는 별개다. */
  readonly clearLabel?: string;
  /** 서버 검색의 상위 조건·언어 등. 함수 identity 대신 이 값이 바뀔 때 다시 조회한다. */
  readonly searchKey?: readonly (string | number | boolean | null | undefined)[];
  readonly disabled?: boolean;
  readonly id?: string;
  readonly 'aria-describedby'?: string;
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-required'?: boolean;
  readonly onBlur?: () => void;
  /** 서버 검색은 요청 취소 신호를 받고 트리를 반환한다. 검색 결과와 선택 값은 따로 유지한다. */
  readonly search?: (text: string, signal: AbortSignal) => Promise<readonly ChoiceNode[]>;
  readonly debounceMs?: number;
  readonly messages?: { readonly loading?: string; readonly failed?: string; readonly retry?: string; readonly empty?: string };
}

/** 같은 leaf 값 모델을 모든 모양에서 사용한다. 가지 ID는 저장하지 않는다. */
export function Choice(props: ChoiceProps) {
  const { nodes, multiple = false, appearance = 'dropdown', disabled, label } = props;
  const { id, text, setText, result, selected, names, summary, control, selection, toggle, select } = useChoiceBinding(props);
  /** 다중 가지는 삼상태, 단일 가지는 제목으로만 보여 준다. */
  function branch(node: ChoiceNode, key: number): ReactNode {
    const targets = node.children === undefined ? [node.value] : treeLeaves(node.children);

    return (
      <li key={node.value ?? key}>
        {multiple ? (
          <label className="wk-inline">
            <Checkbox.Root
              className="wk-check"
              disabled={disabled}
              checked={selection.checked(targets)}
              indeterminate={selection.mixed(targets)}
              onCheckedChange={() => toggle(targets)}
            >
              <Checkbox.Indicator aria-hidden="true">{selection.checked(targets) ? '✓' : '−'}</Checkbox.Indicator>
            </Checkbox.Root>
            {node.label}
          </label>
        ) : node.children !== undefined ? (
          <span>{node.label}</span>
        ) : (
          <label className="wk-inline">
            <input
              type="radio"
              name={id}
              disabled={disabled}
              checked={selected.includes(node.value)}
              onChange={() => select(node.value)}
            />
            {node.label}
          </label>
        )}
        {node.children !== undefined && <ul>{node.children.map(branch)}</ul>}
      </li>
    );
  }
  const clear =
    !multiple && props.clearLabel !== undefined && selected.length > 0 ? (
      <button type="button" className="wk-button wk-button-ghost" disabled={disabled} onClick={() => select(undefined)}>
        {props.clearLabel}
      </button>
    ) : null;
  const tree = (
    <>
      <div>{clear}</div>
      <ul className={appearance === 'horizontal' ? 'wk-inline' : undefined}>
        {(props.allLabel === undefined || !multiple ? nodes : [{ label: props.allLabel, children: nodes }]).map(branch)}
      </ul>
    </>
  );
  /** 단일 계층 메뉴는 가지를 열고 맨 아래 값만 선택한다. */
  function menu(node: ChoiceNode, key: number): ReactNode {
    return node.children === undefined ? (
      <Menu.Item disabled={disabled} key={node.value} onClick={() => select(node.value)}>
        {node.label}
      </Menu.Item>
    ) : (
      <Menu.SubmenuRoot key={key}>
        <Menu.SubmenuTrigger disabled={disabled}>{node.label}</Menu.SubmenuTrigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup className="wk-choice-popup">{node.children.map(menu)}</Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.SubmenuRoot>
    );
  }
  if (appearance === 'search') {
    const items = treeLeafNodes(result.nodes);
    const selectedItems = selected.map((id) => ({ value: id, label: names.current.get(id) ?? id }));
    const common = {
      disabled,
      items,
      inputValue: text,
      onInputValueChange: setText,
      filter: props.search === undefined ? undefined : null,
      isItemEqualToValue: (a: { value: string }, b: { value: string }) => a.value === b.value,
    };
    const parts = (
      <>
        <Combobox.Input {...control} className="wk-input" />
        <Combobox.Trigger aria-label={label} disabled={disabled}>
          ▾
        </Combobox.Trigger>
        <span aria-live="polite">{summary}</span>
        {clear}
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup className="wk-choice-popup">
              {result.pending && <p role="status">{props.messages?.loading ?? '불러오는 중입니다.'}</p>}
              {result.failed && (
                <div role="alert">
                  {props.messages?.failed ?? '선택지를 불러오지 못했습니다.'}
                  <button type="button" onClick={result.retry}>
                    {props.messages?.retry ?? '다시 시도'}
                  </button>
                </div>
              )}
              <Combobox.Empty>{props.messages?.empty ?? '선택지가 없습니다.'}</Combobox.Empty>
              <Combobox.List>
                {(item: { value: string; label: string }) => (
                  <Combobox.Item key={item.value} value={item}>
                    {item.label}
                    <Combobox.ItemIndicator aria-hidden="true">✓</Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </>
    );
    return multiple ? (
      <Combobox.Root {...common} multiple value={selectedItems} onValueChange={(items) => select(items.map((item) => item.value))}>
        {parts}
      </Combobox.Root>
    ) : (
      <Combobox.Root {...common} value={selectedItems[0] ?? null} onValueChange={(item) => select(item?.value)}>
        {parts}
      </Combobox.Root>
    );
  }
  if (appearance === 'menu' && !multiple)
    return (
      <Menu.Root>
        <Menu.Trigger {...control} className="wk-input">
          {summary}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup className="wk-choice-popup">
              {!multiple && props.clearLabel !== undefined && selected.length > 0 && (
                <Menu.Item disabled={disabled} onClick={() => select(undefined)}>
                  {props.clearLabel}
                </Menu.Item>
              )}
              {nodes.map(menu)}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    );
  if (appearance === 'dropdown' || appearance === 'menu')
    return (
      <Popover.Root>
        <Popover.Trigger {...control} className="wk-input">
          {summary}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup className="wk-choice-popup" aria-label={label}>
              {tree}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  return (
    <div {...control} role="group" tabIndex={-1}>
      {tree}
    </div>
  );
}
