// 파일 책임: Spring query의 반복 키·객체 배열 인덱스와 목록 scalar 계약을 직렬화한다.
type Primitive = string | number | boolean;
/** 서버 query에서 직접 표현할 수 있는 값인지 확인한다. */
function isPrimitive(value: unknown): value is Primitive {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
/** 중첩 객체와 배열을 Spring 경로로 펼치며 지원하지 않는 값은 생략한다. */
function append(query: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (isPrimitive(value)) { query.append(key, String(value)); return; }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (isPrimitive(item)) query.append(key, String(item));
      else append(query, `${key}[${index}]`, item);
    });
    return;
  }
  if (typeof value === 'object') {
    for (const [child, childValue] of Object.entries(value)) append(query, `${key}.${child}`, childValue);
  }
}
/** 재귀 Spring 객체를 요청 query 문자열로 만든다. */
export function serializeSpringParams(params: Readonly<Record<string, unknown>>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) append(query, key, value);
  return query.toString();
}
/** 목록에서 지원하지 않는 값이 문자열로 새지 않도록 거절한다. */
function appendScalar(query: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (!isPrimitive(value)) throw new TypeError(`List query value for "${key}" must be a scalar`);
  query.append(key, String(value));
}
/** 단일 깊이 목록 객체를 읽고 중첩 객체 등 미지원 모양은 거절한다. */
export function serializeFlatListParams(params: Readonly<Record<string, unknown>>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item: unknown, index: number) => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          for (const [field, fieldValue] of Object.entries(item)) {
            appendScalar(query, `${key}[${index}].${field}`, fieldValue);
          }
        } else appendScalar(query, key, item);
      });
    } else appendScalar(query, key, value);
  }
  return query.toString();
}
