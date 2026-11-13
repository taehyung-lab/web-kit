// 정책 값은 의미 이름 파일에 둔다.
export const ORDER_LIMIT = 10;
export function isOrderOpen(status: string): boolean { return status === 'OPEN'; }
