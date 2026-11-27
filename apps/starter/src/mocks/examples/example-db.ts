// 파일 책임: 키트 예시 업무(분류·상품·회원·약관·작성 예제)의 mock 서버 메모리 상태. 브라우저 mock과 테스트가 같은 규칙을 쓴다.
// 인증 상태는 mocks/db.ts가 갖는다. pnpm starter:create로 만든 새 프로젝트에는 이 폴더가 없다.
import type { WorkflowValues } from '@/features/form-workflows/model/form/workflow-form';
import type { Category, Product, ProductStatus } from '@/api/generated/models';
import type { MemberSummary } from '@/features/members/model/member';
import { seedMembers } from './members';

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
  members: MemberSummary[];
  terms: MockTerms[];
  workflows: { id: string; saved: WorkflowValues }[];
}

const state: State = { products: seed(), members: seedMembers(), terms: [], workflows: [] };

/** 예시 업무 상태를 JSON으로 옮길 수 있는 모양. 브라우저 mock이 새로 고침 뒤에도 같은 서버로 보이게 저장·복원한다. */
export interface ExampleSnapshot {
  readonly products: Product[];
  readonly members: MemberSummary[];
  readonly terms: MockTerms[];
  readonly workflows: { id: string; saved: WorkflowValues }[];
}

export const exampleDb = {
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
  /** 회원(목록 예시와 일괄 상태 변경). */
  get members() {
    return state.members;
  },
  set members(next: MemberSummary[]) {
    state.members = next;
  },
  /** 처음 상태로 되돌린다(테스트마다). */
  reset() {
    state.products = seed();
    state.members = seedMembers();
    state.terms = [];
    state.workflows = [];
  },
  snapshot(): ExampleSnapshot {
    return { ...state };
  },
  restore(snapshot: ExampleSnapshot) {
    // 저장 모양에 다른 값(나누기 전 인증 값 등)이 섞여 있어도 예시 업무 값만 가져온다.
    const { products, members, terms, workflows } = snapshot;
    Object.assign(state, { products, members, terms, workflows });
  },
};
