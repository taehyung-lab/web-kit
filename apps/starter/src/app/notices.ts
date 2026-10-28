// 파일 책임: 화면 밖 전역 안내(QueryClient notify·세션 종료 안내)를 잠시 보관하는 작은 store. 문구는 번역 키로만 받는다.
import { useSyncExternalStore } from 'react';

export interface Notice {
  readonly id: number;
  readonly messageKey: string;
}

let items: readonly Notice[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const notices = {
  /** 안내 하나를 띄운다. 같은 문구가 이미 떠 있으면 겹치지 않는다. */
  push(messageKey: string) {
    if (items.some((item) => item.messageKey === messageKey)) return;
    items = [...items, { id: nextId++, messageKey }];
    emit();
  },
  dismiss(id: number) {
    items = items.filter((item) => item.id !== id);
    emit();
  },
  clear() {
    items = [];
    emit();
  },
};

/** 현재 안내 목록을 구독한다. */
export function useNotices(): readonly Notice[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => items,
  );
}
