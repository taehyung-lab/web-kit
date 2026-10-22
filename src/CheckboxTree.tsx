// 파일 책임: 부모/자식 선택을 표시하는 공통 트리. checkbox 표현·번역·스타일은 프로젝트 adapter에서 받는다.
import type { ReactNode } from 'react';
import { checkboxTreeSelection, treeLeaves, type CheckboxTreeNode } from './checkbox-tree';
export interface TreeStyles {
  readonly root?: string;
  readonly list?: string;
  readonly item?: string;
  readonly children?: string;
  readonly label?: string;
  readonly separator?: string;
}
export interface TreeControl {
  readonly label: string;
  readonly checked: boolean;
  readonly toggle: () => void;
}
/** 명시적인 leaf 선택을 렌더한다. 부모는 하나라도 선택되면 체크, 전체는 모든 leaf가 선택되어야 체크다. */
export function CheckboxTree<T extends string>({
  nodes,
  values,
  onValueChange,
  selectAllLabel,
  renderCheckbox,
  styles = {},
  id,
  labelledBy,
  describedBy,
  invalid,
  onBlur,
}: {
  readonly nodes: readonly CheckboxTreeNode<T>[];
  readonly values: readonly T[];
  readonly onValueChange: (values: T[]) => void;
  readonly selectAllLabel?: string;
  readonly renderCheckbox: (control: TreeControl) => ReactNode;
  readonly styles?: TreeStyles;
  readonly id?: string;
  readonly labelledBy?: string;
  readonly describedBy?: string;
  readonly invalid?: boolean;
  readonly onBlur?: () => void;
}) {
  const selection = checkboxTreeSelection(nodes, values);
  /** 하나의 부모 또는 leaf를 체크박스와 라벨로 연결한다. */
  const control = (label: string, descendants: readonly T[], requireAll = false) => {
    const checked = selection.checked(descendants, requireAll);
    return (
      <label className={styles.label}>
        {renderCheckbox({
          label,
          checked,
          toggle: () => onValueChange(selection.set(descendants, !checked)),
        })}
        <span aria-hidden="true">{label}</span>
      </label>
    );
  };
  /** 노드를 재귀적으로 표시한다. 동일 라벨도 경로별 위치로 구분한다. */
  const branch = (node: CheckboxTreeNode<T>, index: number): ReactNode => (
    <li key={node.value ?? index} className={styles.item}>
      {control(node.label, node.children ? treeLeaves(node.children) : [node.value])}
      {node.children ? <ul className={styles.children}>{node.children.map(branch)}</ul> : null}
    </li>
  );
  return (
    <div
      role="group"
      id={id}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      onBlur={onBlur}
      className={styles.root}
    >
      {selectAllLabel !== undefined ? control(selectAllLabel, selection.all, true) : null}
      {selectAllLabel !== undefined && styles.separator ? (
        <span aria-hidden="true" className={styles.separator} />
      ) : null}
      <ul className={styles.list}>{nodes.map(branch)}</ul>
    </div>
  );
}
