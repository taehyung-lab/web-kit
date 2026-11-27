// 파일 책임: mock 서버의 인증 상태(발급한 access 토큰·refresh 쿠키 유효 여부)와 브라우저 응답 지연. 브라우저 mock과 테스트가 같은 규칙을 쓴다.
// 업무 화면의 mock 데이터는 각 업무 mock 상태가 들고 있고 feature-mocks가 잇는다.

/** mock access 토큰 수명. 지나면 401 → 재발급 흐름이 일어난다. */
const TOKEN_TTL_MS = 2 * 60 * 1000;

interface State {
  tokens: Map<string, number>;
  refreshValid: boolean;
  issued: number;
}

const state: State = { tokens: new Map(), refreshValid: true, issued: 0 };

/** 인증 상태를 JSON으로 옮길 수 있는 모양. 브라우저 mock이 새로 고침 뒤에도 같은 서버로 보이게 저장·복원한다. */
export interface MockAuthSnapshot {
  readonly tokens: [string, number][];
  readonly refreshValid: boolean;
  readonly issued: number;
}

export const mockDb = {
  /** 브라우저 mock 응답 지연(ms). 실제 브라우저 검사가 진행 중 화면(덮개 등)을 오래 붙잡아 볼 때만 늘린다. */
  latencyMs: 250,
  /** 처음 상태로 되돌린다(테스트마다). */
  reset() {
    state.tokens = new Map();
    state.refreshValid = true;
    state.issued = 0;
  },
  snapshot(): MockAuthSnapshot {
    return { ...state, tokens: [...state.tokens] };
  },
  restore(snapshot: MockAuthSnapshot) {
    Object.assign(state, { ...snapshot, tokens: new Map(snapshot.tokens) });
  },
  /** 새 access 토큰을 발급하고 refresh 쿠키를 유효로 둔다. */
  issueToken(): string {
    state.issued += 1;
    const token = `mock-access-${state.issued}`;
    state.tokens.set(token, Date.now());
    state.refreshValid = true;
    return token;
  },
  isValidToken(token: string | undefined): boolean {
    const issuedAt = token === undefined ? undefined : state.tokens.get(token);
    return issuedAt !== undefined && Date.now() - issuedAt < TOKEN_TTL_MS;
  },
  revokeToken(token: string) {
    state.tokens.delete(token);
  },
  /** 지금까지 발급한 access 토큰을 모두 만료시킨다(401 → 재발급 시험용). */
  expireAccessTokens() {
    state.tokens.clear();
  },
  get refreshValid() {
    return state.refreshValid;
  },
  set refreshValid(value: boolean) {
    state.refreshValid = value;
  },
};
