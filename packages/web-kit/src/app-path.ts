// 파일 책임: 외부에서 받은 이동 주소(로그인 뒤 돌아갈 곳·목록 복귀 등)가 같은 앱 안의 경로인지 판정한다.

export interface AppPathOptions {
  /**
   * 돌아갈 곳으로 받지 않을 경로(예: 로그인 화면). 경로가 같거나 그 아래(`/login/...`)이면 거절한다.
   * `/login-help`처럼 이름만 이어진 경로는 거절하지 않는다. 검색어·hash는 비교하지 않는다.
   */
  readonly exclude?: readonly string[];
}

const BASE = 'https://web-kit.invalid';
/** 제어 문자. 브라우저는 주소의 탭·줄바꿈을 지우므로 `/\t/evil.com`이 `//evil.com`이 된다. */
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/u;
/** 원문 주소에는 공백 문자도 받지 않는다. 정상 주소의 공백은 `%20`처럼 인코딩되어 온다. */
const WHITESPACE = /\s/u;

/** 한 형태(원문 또는 인코딩을 한 번 푼 값)가 앱 밖으로 나갈 수 있는 모양인지 본다. */
function unsafeForm(value: string): boolean {
  // 브라우저는 `/\`를 `//`처럼 다른 호스트로 읽는다. 역슬래시는 위치와 관계없이 받지 않는다.
  return !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || CONTROL_CHARACTER.test(value);
}

/**
 * 같은 앱 안의 경로(`/`로 시작)면 그대로 돌려주고, 아니면 undefined다.
 * 절대 주소·`//host`·역슬래시·제어 문자·원문 공백을 거절한다. 인코딩을 한 번 푼 값에도 `//` 시작·역슬래시·제어 문자
 * 규칙을 적용한다(`%5C`·`%2F%2F`·`%09` 거절, `%20` 허용).
 * 잘못된 퍼센트 인코딩도 거절한다. 반환값은 입력 원문이며 정규화하지 않는다.
 */
export function safeAppPath(value: unknown, options: AppPathOptions = {}): string | undefined {
  if (typeof value !== 'string' || WHITESPACE.test(value) || unsafeForm(value)) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return undefined;
  }
  if (unsafeForm(decoded)) return undefined;
  const url = new URL(value, BASE);
  if (url.origin !== BASE) return undefined;
  for (const path of options.exclude ?? []) {
    const excluded = new URL(path, BASE).pathname.replace(/\/+$/, '') || '/';
    if (url.pathname === excluded || url.pathname.startsWith(excluded === '/' ? '/' : `${excluded}/`)) return undefined;
  }
  return value;
}
