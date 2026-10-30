// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
import type { ReactNode } from 'react';
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
export declare function BlockingProgress({ messages, indicator, children, }: {
    readonly messages: BlockingProgressMessages;
    readonly indicator?: ReactNode;
    readonly children: ReactNode;
}): import("react").JSX.Element;
