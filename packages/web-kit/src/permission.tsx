// 파일 책임: 권한 틀 — 경로 진입 거부, 메뉴 숨김, 버튼 비활성의 공통 판정. 권한이 준비되지 않았거나(불러오는 중·실패)
// 판정이 없으면 닫힌다. 권한 목록과 서버 자원·동작 대응, 판정 함수는 프로젝트가 넘긴다. 목록·폼은 이 module을 import하지 않는다.
import { createContext, useContext, type ReactNode } from 'react';

/** 프로젝트가 연결하는 권한 상태. allows는 ready일 때만 쓰인다. */
export interface Access<C> {
  readonly status: 'loading' | 'failed' | 'ready';
  readonly allows: (check: C) => boolean;
}

/** 진입이 거부된 경로. route errorComponent가 이 오류로 거부 화면을 고른다. reason은 권한이 없음/아직 모름을 구분한다. */
export class AccessDeniedError<C = unknown> extends Error {
  readonly check: C | undefined;
  readonly reason: 'denied' | 'not-ready';
  constructor(check: C | undefined, reason: 'denied' | 'not-ready') {
    super(reason === 'denied' ? 'Access denied' : 'Access not ready');
    this.name = 'AccessDeniedError';
    this.check = check;
    this.reason = reason;
  }
}

/** 판정 하나. ready가 아니거나 판정 대상이 없거나 판정이 던지면 거짓이다. */
export function isAllowed<C>(access: Access<C> | undefined, check: C | undefined): boolean {
  if (access === undefined || access.status !== 'ready' || check === undefined) return false;
  try {
    return access.allows(check) === true;
  } catch {
    return false;
  }
}

/** route beforeLoad에서 부른다. 허용이 아니면 AccessDeniedError를 던져 화면·loader 실행을 막는다. */
export function assertAllowed<C>(access: Access<C> | undefined, check: C | undefined): void {
  if (isAllowed(access, check)) return;
  throw new AccessDeniedError(check, access?.status === 'ready' && check !== undefined ? 'denied' : 'not-ready');
}

/** 메뉴 트리에서 보이지 않는 항목과 자식이 모두 빠진 묶음을 뺀다. 순서는 유지한다. checks가 없으면 늘 보인다. */
export function filterAllowed<T extends { readonly checks?: readonly C[]; readonly children?: readonly T[] }, C>(
  items: readonly T[],
  access: Access<C> | undefined,
): T[] {
  const visible: T[] = [];
  for (const item of items) {
    if (item.checks !== undefined && !item.checks.some((check) => isAllowed(access, check))) continue;
    if (item.children === undefined || item.children.length === 0) {
      visible.push(item);
      continue;
    }
    const children = filterAllowed(item.children, access);
    if (children.length > 0) visible.push({ ...item, children });
  }
  return visible;
}

const AccessContext = createContext<Access<unknown> | undefined>(undefined);

/** 화면 아래에 권한 상태를 연결한다. Provider가 없으면 모든 판정이 거짓이다. */
export function PermissionProvider<C>({ access, children }: { readonly access: Access<C>; readonly children: ReactNode }) {
  return <AccessContext.Provider value={access as Access<unknown>}>{children}</AccessContext.Provider>;
}

/** 지금 연결된 권한 상태. 없으면 undefined(닫힘). */
export function useAccess<C>(): Access<C> | undefined {
  return useContext(AccessContext) as Access<C> | undefined;
}

/** 버튼 비활성 등에 쓰는 판정. 불러오는 중·실패·Provider 없음은 거짓이다. */
export function useAllowed<C>(check: C | undefined): boolean {
  return isAllowed(useAccess<C>(), check);
}

/** 허용될 때만 children을 그린다(메뉴 항목·액션 숨김). 아니면 fallback. */
export function Allowed<C>({ check, children, fallback = null }: { readonly check: C; readonly children: ReactNode; readonly fallback?: ReactNode }) {
  return useAllowed(check) ? children : fallback;
}
