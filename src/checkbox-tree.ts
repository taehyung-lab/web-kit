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
  return nodes.flatMap((node) => (node.children ? treeLeaves(node.children) : [node.value]));
}
/** 일부 선택도 부모 체크로 표시하고 해당 부모를 누르면 후손만 모두 해제한다. */
export function checkboxTreeSelection<T extends string>(
  nodes: readonly CheckboxTreeNode<T>[],
  values: readonly T[]
) {
  const all = treeLeaves(nodes);
  const selected = new Set(values);
  return {
    all,
    checked: (targets: readonly T[], requireAll = false) => {
      const count = targets.filter((value) => selected.has(value)).length;
      return requireAll ? count > 0 && count === targets.length : count > 0;
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
