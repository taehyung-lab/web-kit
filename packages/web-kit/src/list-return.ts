/** 목록 복귀 주소를 보존하되 소비자가 정한 목록 경로 밖으로 돌아가지 않는다. */
export interface ListReturnContext {
  readonly href: string;
}
/** 같은 앱 안의 주소만 복귀 문맥으로 만든다. */
export function captureListReturn(href: string): ListReturnContext {
  if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\')) throw new Error('list return must be an app-relative path');
  return { href };
}
/** 출처 없는 state 또는 다른 경로의 주소는 제품이 정한 fallback을 쓴다. */
export function resolveListReturn(context: unknown, fallback: string): string {
  const fallbackContext = captureListReturn(fallback);
  const base = 'https://web-kit.invalid';
  if (typeof context !== 'object' || context === null || !('href' in context) || typeof context.href !== 'string')
    return fallbackContext.href;
  try {
    const candidate = captureListReturn(context.href);
    return new URL(candidate.href, base).pathname === new URL(fallback, base).pathname ? candidate.href : fallback;
  } catch {
    return fallback;
  }
}
