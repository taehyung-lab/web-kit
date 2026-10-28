/** 노출 범위를 추측하지 않고 소비자가 선언한 문자 수로 마스킹한다. */
export function maskText(
  value: string,
  policy: { readonly visibleStart: number; readonly visibleEnd: number; readonly replacement?: string },
): string {
  const chars = Array.from(value);
  const { visibleStart, visibleEnd } = policy;
  if (!Number.isInteger(visibleStart) || !Number.isInteger(visibleEnd) || visibleStart < 0 || visibleEnd < 0)
    throw new Error('visible counts must be non-negative integers');
  const start = Math.min(visibleStart, chars.length);
  const end = Math.min(visibleEnd, chars.length - start);
  return (
    chars.slice(0, start).join('') +
    (policy.replacement ?? '*').repeat(chars.length - start - end) +
    (end === 0 ? '' : chars.slice(-end).join(''))
  );
}
