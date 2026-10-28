// 파일 책임: 화면 전체 진행 덮개의 상태(지금 무엇이 진행 중인가)를 모은다. 폼 저장(등록·수정)·삭제 실행과 페이지 첫 조회가 여기에 등록하고,
// `/ui`의 BlockingProgress가 이 등록소를 제공·표시한다. UI를 import하지 않는다(동작 경로가 이 파일만 끌어온다).
import { createContext, useContext, useLayoutEffect } from 'react';

/** 덮개 종류. loading은 페이지 첫 조회, create·edit은 등록·수정 저장, delete는 확인창을 거친 삭제 실행이다. 문구는 프로젝트가 종류별로 준다. */
export type BlockingKind = 'loading' | 'create' | 'edit' | 'delete';

/** 등록소. 진행 하나를 더하고 돌려준 함수로 뺀다. */
export interface BlockingRegistry {
  readonly add: (kind: BlockingKind) => () => void;
}

export const BlockingRegistryContext = createContext<BlockingRegistry | undefined>(undefined);

/**
 * active인 동안 이 진행을 덮개에 등록한다. 덮개(BlockingProgress) 밖이면 아무 일도 하지 않는다.
 * 키트 폼·목록·단건은 선언(progress)만 받으면 스스로 부르고, 화면 고유의 진입 대기(예: 수정 전 보조 조회)만 화면이 직접 부른다.
 */
export function useBlockingProgress(kind: BlockingKind, active: boolean): void {
  const registry = useContext(BlockingRegistryContext);
  useLayoutEffect(() => (active && registry !== undefined ? registry.add(kind) : undefined), [registry, kind, active]);
}
