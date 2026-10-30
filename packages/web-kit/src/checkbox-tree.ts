// 파일 책임: leaf 선택값으로 전체·부모 상태와 다음 선택값을 계산한다. 빈 값=전체 변환은 adapter 책임이다.
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
    checked: (targets: readonly T[], _requireAll = false) => {
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
