// 파일 책임: 공유하는 선택 값과 트리를 여러 입력 모양 및 서버 검색에 연결한다.
// 파일 책임: 목록·폼이 공유하는 선택 값과 트리·드롭다운·계층 메뉴·자동완성 표현을 연결한다.
import { Checkbox } from '@base-ui/react/checkbox';
import { Combobox } from '@base-ui/react/combobox';
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import { useEffect, useRef, useState, useId, type ReactNode } from 'react';
import { treeLeaves, type CheckboxTreeNode } from '../checkbox-tree';

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

/** 트리를 단일 선택·검색이 쓰는 맨 아래 항목으로 펼친다. */
function leaves(nodes: readonly ChoiceNode[]): { value: string; label: string }[] {
  return nodes.flatMap((node) => (node.children === undefined ? [{ value: node.value, label: node.label }] : leaves(node.children)));
}

/** 입력 정지 뒤 검색하고 취소를 무시하는 서버의 늦은 응답도 버린다. */
function useChoiceSearch(props: ChoiceProps, text: string) {
  const [state, setState] = useState<{ nodes: readonly ChoiceNode[]; pending: boolean; failed: boolean }>({
    nodes: props.nodes,
    pending: false,
    failed: false,
  });
  const [attempt, retry] = useState(0);
  const searchRef = useRef(props.search);
  searchRef.current = props.search;
  const hasSearch = props.search !== undefined;
  const scope = JSON.stringify(props.searchKey ?? []);
  useEffect(() => {
    if (!hasSearch) return;
    const controller = new AbortController();
    let current = true;
    setState((old) => ({ ...old, pending: true, failed: false }));
    const timer = setTimeout(() => {
      const search = searchRef.current;
      if (search === undefined) return;
      void Promise.resolve()
        .then(() => search(text, controller.signal))
        .then(
          (nodes) => {
            if (current) setState({ nodes, pending: false, failed: false });
          },
          () => {
            if (current) setState((old) => ({ ...old, pending: false, failed: true }));
          },
        );
    }, props.debounceMs ?? 250);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [hasSearch, scope, text, props.debounceMs, attempt]);
  return { ...state, nodes: hasSearch ? state.nodes : props.nodes, retry: () => retry((value) => value + 1) };
}

/** 같은 leaf 값 모델을 모든 모양에서 사용한다. 가지 ID는 저장하지 않는다. */
export function Choice(props: ChoiceProps) {
  const { nodes, value, onValueChange, multiple = false, appearance = 'dropdown', disabled, label } = props;
  const fallbackId = useId();
  const id = props.id ?? fallbackId;
  const [text, setText] = useState('');
  const result = useChoiceSearch(props, text);
  const selected = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const names = useRef(new Map<string, string>());
  for (const item of [...leaves(nodes), ...leaves(result.nodes)]) names.current.set(item.value, item.label);
  const summary = selected.length === 0 ? (props.placeholder ?? label) : selected.map((id) => names.current.get(id) ?? id).join(', ');
  const control = {
    id,
    'aria-label': label,
    'aria-describedby': props['aria-describedby'],
    'aria-invalid': props['aria-invalid'],
    'aria-required': props['aria-required'],
    disabled,
    onBlur: props.onBlur,
  };
  /** 한 가지 아래의 모든 leaf를 켜거나 끄고 트리 순서로 저장한다. */
  function toggle(targets: readonly string[]) {
    const all = targets.length > 0 && targets.every((id) => selected.includes(id));
    const next = new Set(selected);
    for (const id of targets) {
      if (all) next.delete(id);
      else next.add(id);
    }
    onValueChange(treeLeaves(nodes).filter((id) => next.has(id)));
  }
  /** 다중 가지는 삼상태, 단일 가지는 제목으로만 보여 준다. */
  function branch(node: ChoiceNode, key: number): ReactNode {
    const targets = node.children === undefined ? [node.value] : treeLeaves(node.children);
    const count = targets.filter((id) => selected.includes(id)).length;
    return (
      <li key={node.value ?? key}>
        {multiple ? (
          <label className="wk-inline">
            <Checkbox.Root
              className="wk-check"
              disabled={disabled}
              checked={targets.length > 0 && count === targets.length}
              indeterminate={count > 0 && count < targets.length}
              onCheckedChange={() => toggle(targets)}
            >
              <Checkbox.Indicator aria-hidden="true">{count === targets.length ? '✓' : '−'}</Checkbox.Indicator>
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
              onChange={() => onValueChange(node.value)}
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
      <button type="button" className="wk-button wk-button-ghost" disabled={disabled} onClick={() => onValueChange(undefined)}>
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
      <Menu.Item disabled={disabled} key={node.value} onClick={() => onValueChange(node.value)}>
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
    const items = leaves(result.nodes);
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
      <Combobox.Root {...common} multiple value={selectedItems} onValueChange={(items) => onValueChange(items.map((item) => item.value))}>
        {parts}
      </Combobox.Root>
    ) : (
      <Combobox.Root {...common} value={selectedItems[0] ?? null} onValueChange={(item) => onValueChange(item?.value)}>
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
                <Menu.Item disabled={disabled} onClick={() => onValueChange(undefined)}>
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
