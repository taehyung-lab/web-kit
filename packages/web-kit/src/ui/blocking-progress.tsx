// 파일 책임: 화면 전체 진행 덮개. 등록소를 제공하고, 진행이 있으면 본문을 막고(inert·aria-busy) 가운데 진행 표시와 문구를 띄운다.
// 무엇이 진행 중인지는 등록(폼 저장·페이지 첫 조회)이, 문구는 프로젝트가 정한다. 덮개가 닫힐 때 잃은 포커스를 본문으로 돌린다.
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BlockingRegistryContext, type BlockingKind, type BlockingRegistry } from '../progress';
import { Spinner } from './pending';

/** 종류별 주 문구와 보조 문구(없으면 그리지 않음). */
export interface BlockingProgressMessages {
  readonly loading: string;
  readonly create: string;
  readonly edit: string;
  readonly delete: string;
  readonly wait?: string;
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

/**
 * 앱 셸에 한 번 두는 덮개. children(앱 본문)은 진행 중 inert·aria-busy가 되어 클릭·포커스·낭독에서 빠진다.
 * 대화창(portal)은 children 밖이라 덮개 위에서 조작된다. 덮개 층은 CSS 변수 `--wk-blocking-layer`(기본은 키트 대화창 아래).
 * 상태 문구 영역(role=status)은 늘 있고 열릴 때 문구가 들어가 낭독기가 바뀜을 읽는다. 최소 표시 시간·지연은 없다.
 * `indicator`는 가운데 진행 표시를 프로젝트 모양으로 바꾼다(없으면 키트 원형 회전 표시). 덮개 전체가 낭독기에 숨겨져 있어(문구는 상태 영역이 읽는다) 표시는 그림만 맡고,
 * 움직임 줄이기 설정은 그 표시를 준 프로젝트가 맞춘다.
 */
export function BlockingProgress({
  messages,
  indicator,
  children,
}: {
  readonly messages: BlockingProgressMessages;
  readonly indicator?: ReactNode;
  readonly children: ReactNode;
}) {
  const [store] = useState(createRegistry);
  const kind = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const open = kind !== undefined;
  const lastFocused = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  // 닫히는 커밋에서: inert가 밀어낸 포커스(문서 본문)만 본문의 마지막 포커스로 돌린다. 완료 창·오류 칸이 가져간 포커스는 건드리지 않는다.
  useLayoutEffect(() => {
    if (wasOpen.current && !open) {
      const active = document.activeElement;
      const target = lastFocused.current;
      if ((active === null || active === document.body) && target !== null && target.isConnected) target.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <BlockingRegistryContext.Provider value={store.registry}>
      <div
        className="wk-blocking-root"
        inert={open || undefined}
        aria-busy={open || undefined}
        onFocus={(event) => {
          lastFocused.current = event.target instanceof HTMLElement ? event.target : null;
        }}
      >
        {children}
      </div>
      {open ? (
        <div className="wk-blocking" aria-hidden="true">
          <div className="wk-blocking-box">
            {indicator === undefined ? <Spinner large /> : indicator}
            <div className="wk-blocking-text">
              <p>{messages[kind]}</p>
              {messages.wait === undefined ? null : <p>{messages.wait}</p>}
            </div>
          </div>
        </div>
      ) : null}
      <div role="status" aria-live="polite" aria-atomic="true" className="wk-blocking-status wk-visually-hidden">
        {open ? [messages[kind], messages.wait].filter((text) => text !== undefined).join(' ') : ''}
      </div>
    </BlockingRegistryContext.Provider>
  );
}
