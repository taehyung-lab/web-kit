// 파일 책임: 선택 검색 수명과 leaf 선택·이름 보존·잠금 연결을 제공한다.
import { useEffect, useRef, useState, useId } from 'react';
import { checkboxTreeSelection, treeLeafNodes, type CheckboxTreeNode } from './checkbox-tree';
export type ChoiceNode = CheckboxTreeNode;
export type ChoiceValue = string | readonly string[] | undefined;
export interface ChoiceBindingOptions {
  readonly nodes: readonly ChoiceNode[];
  readonly value: ChoiceValue;
  readonly onValueChange: (value: ChoiceValue) => void;
  readonly multiple?: boolean;
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

/** 전체 선택지에서 찾을 수 있는 값만 표시·제출에 사용한다. 서버 검색 결과에는 적용하지 않는다. */
export function normalizeChoiceValue(value: ChoiceValue, nodes: readonly ChoiceNode[]): ChoiceValue {
  const allowed = new Set(treeLeafNodes(nodes).map((node) => node.value));
  return Array.isArray(value) ? value.filter((id) => allowed.has(id)) : typeof value === 'string' && (value === '' || allowed.has(value)) ? value : undefined;
}

/** 입력 정지 뒤 검색하고 취소를 무시하는 서버의 늦은 응답도 버린다. */
function useChoiceSearch(props: ChoiceBindingOptions, text: string) {
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

/** 모든 선택 표현이 같은 값·검색·요약·삼상태 연결을 사용한다. */
export function useChoiceBinding(props: ChoiceBindingOptions) {
  const { nodes, value, onValueChange, disabled, label } = props;
  const fallbackId = useId();
  const id = props.id ?? fallbackId;
  const [text, setText] = useState('');
  const result = useChoiceSearch(props, text);
  const effective = props.search === undefined ? normalizeChoiceValue(value, nodes) : value;
  const selected = Array.isArray(effective) ? effective : typeof effective === 'string' ? [effective] : [];
  const names = useRef(new Map<string, string>());
  for (const item of [...treeLeafNodes(nodes), ...treeLeafNodes(result.nodes)]) names.current.set(item.value, item.label);
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
  const selection = checkboxTreeSelection(nodes, selected);
  /** 선택 변경은 잠금 여부와 leaf 순서를 공통 계산으로 적용한다. */
  function select(next: ChoiceValue) { if (!disabled) onValueChange(next); }
  /** 부모의 일부 선택은 전체 선택으로 바꾼다. */
  function toggle(targets: readonly string[]) {
    const next = selection.set(targets, !selection.checked(targets));
    select(props.search === undefined ? next : [...next, ...selected.filter((id) => !selection.all.includes(id))]);
  }
  return { id, text, setText, result, selected, names, summary, control, selection, toggle, select };
}
