// 파일 책임: 화면 전체 진행 덮개의 상태(지금 무엇이 진행 중인가)를 모은다. 폼 저장(등록·수정)·삭제 실행과 페이지 첫 조회가 여기에 등록하고,
// `/ui`의 BlockingProgress가 이 등록소를 제공·표시한다. UI를 import하지 않는다(동작 경로가 이 파일만 끌어온다).
import { createElement, createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type ReactNode } from 'react';

/** 덮개 종류. loading은 페이지 첫 조회, create·edit은 등록·수정 저장, delete는 확인창을 거친 삭제 실행이다. 문구는 프로젝트가 종류별로 준다. */
export type BlockingKind = 'loading' | 'create' | 'edit' | 'delete';

/** 등록소. 진행 하나를 더하고 돌려준 함수로 뺀다. */
export interface BlockingRegistry {
  readonly add: (kind: BlockingKind) => () => void;
}

const BlockingRegistryContext = createContext<BlockingRegistry | undefined>(undefined);

/**
 * active인 동안 이 진행을 덮개에 등록한다. 덮개(BlockingProgress) 밖이면 아무 일도 하지 않는다.
 * 키트 폼·목록·단건은 선언(progress)만 받으면 스스로 부르고, 화면 고유의 진입 대기(예: 수정 전 보조 조회)만 화면이 직접 부른다.
 */
export function useBlockingProgress(kind: BlockingKind, active: boolean): void {
  const registry = useContext(BlockingRegistryContext);
  useLayoutEffect(() => (active && registry !== undefined ? registry.add(kind) : undefined), [registry, kind, active]);
}

/** 등록된 진행 목록을 들고, 바뀌면 구독자에게 알린다. 쓰기(create·edit·delete)가 조회보다 앞서고, 쓰기끼리는 나중 등록이 이긴다. */
function createRegistry() {
  const entries: { readonly kind: BlockingKind }[] = [];
  const listeners = new Set<() => void>();
  let current: BlockingKind | undefined;
  const recompute = () => {
    const saving = [...entries].reverse().find((entry) => entry.kind !== 'loading');
    const next = saving?.kind ?? entries[0]?.kind;
    if (next === current) return;
    current = next;
    for (const listener of listeners) listener();
  };
  const registry: BlockingRegistry = {
    add: (kind) => {
      const entry = { kind };
      entries.push(entry);
      recompute();
      return () => {
        const index = entries.indexOf(entry);
        if (index >= 0) entries.splice(index, 1);
        recompute();
      };
    },
  };
  return {
    registry,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => current,
  };
}

/** 본문으로 포커스를 돌린다: 기록한 요소가 남아 있으면 그 요소, 사라졌으면 본문 첫 h1, 그것도 없으면 본문 영역. 문서 본문에 두지 않는다. */
function restoreFocus(root: HTMLElement, last: HTMLElement) {
  if (last.isConnected && root.contains(last)) {
    last.focus();
    if (document.activeElement === last) return;
  }
  const fallback = root.querySelector<HTMLElement>('h1') ?? root;
  // 포커스를 받는 동안만 tabindex를 붙인다(떠나면 떼어 클릭·Tab 순서에 남지 않게).
  if (!fallback.hasAttribute('tabindex')) {
    fallback.setAttribute('tabindex', '-1');
    fallback.addEventListener('blur', () => fallback.removeAttribute('tabindex'), { once: true });
  }
  fallback.focus();
}

/** 본문 잠금 속성과 포커스 복원을 같은 진행 등록소에 연결한다. */
export function useBlockingProgressBinding() {
  const [store] = useState(createRegistry);
  const kind = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const open = kind !== undefined;
  const root = useRef<HTMLDivElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  // 닫히는 커밋에서: inert가 밀어낸 포커스(문서 본문)만 본문으로 돌린다. 완료 창·오류 칸·대화창이 가져간 포커스는 건드리지 않는다.
  // 본문에 포커스한 적이 없으면(첫 진입) 옮기지 않는다.
  useLayoutEffect(() => {
    if (wasOpen.current && !open) {
      const active = document.activeElement;
      if ((active === null || active === document.body) && lastFocused.current !== null && root.current !== null) {
        restoreFocus(root.current, lastFocused.current);
      }
    }
    wasOpen.current = open;
  }, [open]);

  return { registry: store.registry, kind, open, contentRef: root,
    contentProps: { inert: open || undefined, 'aria-busy': open || undefined,
      onFocus: (event: FocusEvent<HTMLDivElement>) => {
        if (event.target instanceof HTMLElement && event.currentTarget.contains(event.target)) lastFocused.current = event.target;
      },
    },
  };
}

/** 진행 hook의 등록소를 배치 없이 본문과 포털 자식에 전달한다. */
export function BlockingProgressProvider({ binding, children }: {
  readonly binding: ReturnType<typeof useBlockingProgressBinding>;
  readonly children: ReactNode;
}) {
  return createElement(BlockingRegistryContext.Provider, { value: binding.registry }, children);
}
