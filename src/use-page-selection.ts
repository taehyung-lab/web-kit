// 파일 책임: 현재 확정 검색의 선택을 관리하고 사라진 ID와 이전 검색의 선택을 폐기한다.
import { useState } from 'react';

/** 선택 가능한 ID의 현재 페이지를 관리한다. 출력은 선택 순서이며 표시 순서 변환은 소비자가 맡는다. */
export function usePageSelection({
  ids,
  resetKey,
  locked,
}: {
  readonly ids: readonly string[];
  readonly resetKey: string;
  readonly locked: boolean;
}) {
  const sourceKey = JSON.stringify(ids);
  const [state, setState] = useState(() => ({ resetKey, sourceKey, selected: new Set<string>() }));
  const allowed = new Set(ids);
  let selected = state.selected;
  if (state.resetKey !== resetKey) {
    selected = new Set();
    setState({ resetKey, sourceKey, selected });
  } else if (state.sourceKey !== sourceKey) {
    selected = new Set([...selected].filter((id) => allowed.has(id)));
    setState({ resetKey, sourceKey, selected });
  }
  const isAllChecked = allowed.size > 0 && selected.size === allowed.size;
  /** 선택 변경은 현재 페이지의 허용 ID에만 반영한다. */
  const toggle = (targets: readonly string[], checked: boolean) => {
    if (locked) return;
    const next = new Set(selected);
    for (const id of targets) {
      if (!allowed.has(id)) continue;
      if (checked) next.add(id);
      else next.delete(id);
    }
    setState({ resetKey, sourceKey, selected: next });
  };
  return {
    selectedIds: [...selected],
    isChecked: (id: string) => selected.has(id),
    isAllChecked,
    isMixed: selected.size > 0 && !isAllChecked,
    toggleRow: (id: string, checked: boolean) => toggle([id], checked),
    togglePage: (checked: boolean) => toggle(ids, checked),
    clear: () => setState({ resetKey, sourceKey, selected: new Set() }),
  };
}
