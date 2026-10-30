// 파일 책임: 스타터 합성 서버의 상품·약관·작성 예제와 인증 시험 상태를 관리한다.
// 파일 책임: mock 서버의 메모리 상태(분류·상품·토큰·refresh 쿠키 유효 여부). 브라우저 mock과 테스트가 같은 규칙을 쓴다.
import type { WorkflowValues } from '@/features/form-workflows/model/form';
import type { Category, Product, ProductStatus } from '@/api/generated/models';

/** mock access 토큰 수명. 지나면 401 → 재발급 흐름이 일어난다. */
const TOKEN_TTL_MS = 2 * 60 * 1000;

const NAMES = [
  'Notebook A5', 'Desk Lamp', 'Ceramic Mug', 'Wireless Mouse', 'Water Bottle', 'Canvas Tote', 'Pencil Set', 'Wall Clock',
  'Phone Stand', 'Cotton Towel', 'Glass Vase', 'Travel Pouch', 'Sticky Notes', 'USB-C Cable', 'Plant Pot', 'Keyboard Cover',
  'Bookend Pair', 'Lunch Box', 'Coaster Set', 'Mini Speaker', 'Umbrella', 'Photo Frame', 'Desk Mat', 'Scented Candle',
  'Hand Cream', 'Sketchbook', 'Tumbler', 'Key Ring', 'Cable Clip', 'Note Holder', 'Shoe Bag', 'Mouse Pad',
];
const STATUSES: readonly ProductStatus[] = ['ACTIVE', 'ACTIVE', 'DRAFT', 'ACTIVE', 'INACTIVE'];
const CATEGORIES: readonly Category[] = [
  { categoryId: 'c-stationery', name: 'Stationery' },
  { categoryId: 'c-living', name: 'Living' },
  { categoryId: 'c-digital', name: 'Digital' },
  { categoryId: 'c-kitchen', name: 'Kitchen' },
];

function seed(): Product[] {
  const base = Date.UTC(2026, 0, 5);
  return NAMES.map((name, index) => {
    const created = new Date(base + index * 5 * 86_400_000).toISOString();
    return {
      productId: `p-${String(index + 1).padStart(3, '0')}`,
      name,
      code: `SKU-${String(1001 + index)}`,
      status: STATUSES[index % STATUSES.length]!,
      categoryId: CATEGORIES[index % CATEGORIES.length]!.categoryId,
      price: 3_000 + ((index * 1_700) % 40_000),
      stock: (index * 7) % 60,
      description: index % 3 === 0 ? null : `${name} for everyday use.`,
      options: [{ name: 'Default', extraPrice: 0 }],
      createdAt: created,
      updatedAt: created,
    };
  });
}

/** 약관 한 건(약관 등록 예시용 mock). */
export interface MockTerms {
  readonly termsId: string;
  readonly version: string;
  readonly effectiveAt: string;
  readonly status: 'PUBLISHED' | 'UNPUBLISHED';
  readonly publishedAt: string;
  readonly body: string;
}

interface State {
  products: Product[];
  terms: MockTerms[];
  workflows: { id: string; saved: WorkflowValues }[];
  tokens: Map<string, number>;
  refreshValid: boolean;
  issued: number;
}

const state: State = { products: seed(), terms: [], workflows: [], tokens: new Map(), refreshValid: true, issued: 0 };

/** 서버 상태를 JSON으로 옮길 수 있는 모양. 브라우저 mock이 새로 고침 뒤에도 같은 서버로 보이게 저장·복원한다. */
export interface MockSnapshot {
  readonly products: Product[];
  readonly terms: MockTerms[];
  readonly workflows: { id: string; saved: WorkflowValues }[];
  readonly tokens: [string, number][];
  readonly refreshValid: boolean;
  readonly issued: number;
}

export const mockDb = {
  /** 브라우저 mock 응답 지연(ms). 실제 브라우저 검사가 진행 중 화면(덮개 등)을 오래 붙잡아 볼 때만 늘린다. */
  latencyMs: 250,
  /** 분류 선택지(고정). */
  get categories(): readonly Category[] {
    return CATEGORIES;
  },
  get products() {
    return state.products;
  },
  /** 저장한 작성 예제를 후속 조회에 돌려준다. */
  get workflows() {
    return state.workflows;
  },
  get terms() {
    return state.terms;
  },
  set products(next: Product[]) {
    state.products = next;
  },
  /** 처음 상태로 되돌린다(테스트마다). */
  reset() {
    state.products = seed();
    state.terms = [];
    state.workflows = [];
    state.tokens = new Map();
    state.refreshValid = true;
    state.issued = 0;
  },
  snapshot(): MockSnapshot {
    return { ...state, tokens: [...state.tokens] };
  },
  restore(snapshot: MockSnapshot) {
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
