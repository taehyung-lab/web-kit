// 파일 책임: 상품 화면의 금액·날짜 표시 형식(현재 언어 기준).
/** 원화 금액. */
export function formatPrice(value: number, language: string): string {
  return new Intl.NumberFormat(language, { style: 'currency', currency: 'KRW' }).format(value);
}

/** 날짜(시각 제외). */
export function formatDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(iso));
}
