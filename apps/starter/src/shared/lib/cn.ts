// 파일 책임: className 조각을 이어 붙인다(거짓 값은 뺀다).
export function cn(...parts: readonly (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
