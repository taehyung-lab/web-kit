// 파일 책임: 화면 전체 진행 덮개. 등록소를 제공하고, 진행이 있으면 본문을 막고(inert·aria-busy) 가운데 진행 표시와 문구를 띄운다.
// 무엇이 진행 중인지는 등록(폼 저장·페이지 첫 조회)이, 문구는 프로젝트가 정한다. 덮개가 닫힐 때 잃은 포커스를 본문으로 돌린다
// (본문 DOM 안에서 마지막으로 포커스한 요소 → 사라졌으면 본문 첫 h1 → 그것도 없으면 본문 영역).
import type { ReactNode } from 'react';
import { BlockingRegistryContext, useBlockingProgressBinding } from '../progress';
import { Spinner } from './pending';

/** 종류별 주 문구와 보조 문구(없으면 그리지 않음). */
export interface BlockingProgressMessages {
  readonly loading: string;
  readonly create: string;
  readonly edit: string;
  readonly delete: string;
  readonly wait?: string;
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
  const { registry, kind, open, contentRef, contentProps } = useBlockingProgressBinding();
  return (
    <BlockingRegistryContext.Provider value={registry}>
      <div
        ref={contentRef}
        className="wk-blocking-root"
        {...contentProps}
      >
        {children}
      </div>
      {open ? (
        <div className="wk-blocking" aria-hidden="true">
          <div className="wk-blocking-box">
            {indicator === undefined ? <Spinner large /> : indicator}
            <div className="wk-blocking-text">
              <p>{messages[kind!]}</p>
              {messages.wait === undefined ? null : <p>{messages.wait}</p>}
            </div>
          </div>
        </div>
      ) : null}
      <div role="status" aria-live="polite" aria-atomic="true" className="wk-blocking-status wk-visually-hidden">
        {open ? [messages[kind!], messages.wait].filter((text) => text !== undefined).join(' ') : ''}
      </div>
    </BlockingRegistryContext.Provider>
  );
}
