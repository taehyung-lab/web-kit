// 파일 책임: 검증 오류 문자열에 번역 참조를 저장하고 렌더 시 해소한다.
type MessageValues = Readonly<Record<string, string | number>>;
/** 기존 프로젝트의 marker를 유지하면서 번역 참조의 인코딩·해석 구현을 공유한다. */
export function createFormMessages(prefix: string) {
  /** schema와 서버 필드 오류에 저장할 번역 참조를 만든다. */
  function encode(key: string, values: MessageValues = {}): string {
    return prefix + JSON.stringify({ key, values });
  }
  /** 문자열 또는 message 객체를 읽고 이 marker의 참조만 번역한다. */
  function resolve(error: unknown, translate: (key: string, values: MessageValues) => string): string | undefined {
    const message = typeof error === 'string' ? error : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : undefined;
    if (message === undefined || !message.startsWith(prefix)) return message;
    const { key, values } = JSON.parse(message.slice(prefix.length)) as { key: string; values: MessageValues };
    return translate(key, values);
  }
  return { encode, resolve };
}
