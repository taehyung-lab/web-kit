// 파일 책임: 트리의 leaf 순서로 선택 상태와 다음 선택값을 계산한다.
export type CheckboxTreeNode<T extends string = string> =
  | { readonly value: T; readonly label: string; readonly children?: undefined }
  | {
      readonly label: string;
      readonly children: readonly CheckboxTreeNode<T>[];
      readonly value?: undefined;
    };
/** 트리 순서로 leaf 값을 얻는다. */
export function treeLeaves<T extends string>(nodes: readonly CheckboxTreeNode<T>[]): T[] {
  return treeLeafNodes(nodes).map((node) => node.value);
}
/** 표시 이름을 보존하면서 트리의 leaf를 한 순서로 펼친다. */
export function treeLeafNodes<T extends string>(nodes: readonly CheckboxTreeNode<T>[]): { readonly value: T; readonly label: string }[] {
  return nodes.flatMap((node) => node.children ? treeLeafNodes(node.children) : [{ value: node.value, label: node.label }]);
}
/** 모두 선택은 체크, 일부 선택은 mixed이며 일부 선택을 누르면 후손 모두 선택한다. */
export function checkboxTreeSelection<T extends string>(
  nodes: readonly CheckboxTreeNode<T>[],
  values: readonly T[]
) {
  const all = treeLeaves(nodes);
  const selected = new Set(values);
  return {
    all,
    checked: (targets: readonly T[]) => {
      const count = targets.filter((value) => selected.has(value)).length;
      return count > 0 && count === targets.length;
    },
    mixed: (targets: readonly T[]) => {
      const count = targets.filter((value) => selected.has(value)).length;
      return count > 0 && count < targets.length;
    },
    set: (targets: readonly T[], checked: boolean): T[] => {
      const next = new Set(selected);
      for (const value of targets) {
        if (checked) next.add(value);
        else next.delete(value);
      }
      return all.filter((value) => next.has(value));
    },
  };
}

/**
 * 선택지 전체가 아니라 일부(서버 검색 결과의 한 그룹 등)만 보일 때의 토글: 대상이 모두 선택돼 있으면 끄고, 아니면 켠다.
 * 대상 밖에서 이미 고른 값은 그대로 둔다.
 */
export function toggleWithin<T extends string>(selected: readonly T[], targets: readonly T[]): T[] {
  const every = targets.length > 0 && targets.every((value) => selected.includes(value));
  return every ? selected.filter((value) => !targets.includes(value)) : [...selected, ...targets.filter((value) => !selected.includes(value))];
}
