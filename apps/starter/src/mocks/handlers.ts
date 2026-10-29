// 파일 책임: openapi/sample.json 계약을 흉내 내는 msw handler. Spring 봉투, 401 → 재발급, 필드 오류, 없음, HTTP 200 업무 거절을 낸다.
import { draftSchema, publishSchema } from '@/features/form-workflows/model/form';
import type { Product, ProductUpsertRequest } from '@/api/generated/models';
import { delay, http, HttpResponse, type DefaultBodyType } from 'msw';
import { mockDb, type MockTerms } from './db';
import { MEMBERS } from './members';

const API = '*/api';
/** 일괄 작업 한도(mock 업무 규칙). 넘으면 HTTP 200 봉투에 업무 거절 코드를 준다. */
const BULK_LIMIT = 5;

/** 브라우저 mock에서만 응답을 조금 늦춰 대기 상태를 볼 수 있게 한다. */
async function latency() {
  if (typeof window !== 'undefined' && import.meta.env.MODE === 'mock') await delay(mockDb.latencyMs);
}

function envelope(status: number, resultCode: number, resultMessage: string, data: DefaultBodyType) {
  return HttpResponse.json({ header: { resultCode, resultMessage }, data }, { status });
}
const ok = (data: DefaultBodyType) => envelope(200, 200, 'OK', data);

function bearer(request: Request): string | undefined {
  return request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? undefined;
}

/** 보호 경로 공통: 토큰이 없거나 만료면 401. */
function unauthorized(request: Request) {
  return mockDb.isValidToken(bearer(request)) ? undefined : envelope(401, 4010, 'Access token expired', null);
}

function findProduct(id: string | readonly string[] | undefined): Product | undefined {
  return mockDb.products.find((product) => product.productId === id);
}

/** 코드 중복이면 Spring 형식의 필드 오류(400, data 배열)를 돌려준다. */
function duplicateCode(body: ProductUpsertRequest, selfId?: string) {
  const taken = mockDb.products.some((product) => product.code === body.code && product.productId !== selfId);
  return taken ? envelope(400, 4000, 'Invalid input', [{ field: 'code', validCode: 'DUPLICATE' }]) : undefined;
}

/** 공연 예시 mock: 올린 파일 수(파일 id). 새로 고침 뒤 기억할 필요가 없는 예시 값이다. */
let uploadedFiles = 0;

export const handlers = [
  // 작성 예제 전용 계약: 임시 저장과 게시의 검증을 구분하고 끊긴 참조는 둘 다 거절한다.
  http.post(`${API}/form-workflows`, async ({ request }) => {
    const denied = unauthorized(request);
    if (denied) return denied;
    await latency();
    const body = (await request.json()) as { mode?: string; values?: unknown };
    if (body.mode !== 'draft' && body.mode !== 'publish') return envelope(400, 4000, 'Invalid mode', null);
    const parsed = (body.mode === 'draft' ? draftSchema : publishSchema).safeParse(body.values);
    if (!parsed.success) return envelope(400, 4000, 'Invalid values', null);
    if (parsed.data.selected !== '' && !parsed.data.items.some((item) => item.id === parsed.data.selected))
      return envelope(400, 4000, 'Invalid reference', null);
    return ok({ saved: parsed.data });
  }),
  // 공연 예시: 파일 업로드(multipart) → 파일 id.
  http.post(`${API}/files`, async ({ request }) => {
    const denied = unauthorized(request);
    if (denied) return denied;
    await latency();
    // 본문은 읽지 않는다(jsdom의 File을 Node multipart 해석기가 받지 못한다). multipart로 왔는지만 본다.
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data'))
      return envelope(400, 4000, 'Invalid input', [{ field: 'file', validCode: 'REQUIRED' }]);
    uploadedFiles += 1;
    return ok({ fileId: `f-${uploadedFiles}` });
  }),
  // 공연 예시 등록: 시작 일시가 앞 회차와 같은 회차는 Spring 형식 필드 오류(400, rounds[i].startAt). 제목이 E2E-실패로 시작하면 500.
  http.post(`${API}/shows`, async ({ request }) => {
    const denied = unauthorized(request);
    if (denied) return denied;
    await latency();
    const body = (await request.json()) as { title: string; rounds: { startAt: string }[]; seatFileId?: string };
    if (body.title.startsWith('E2E-실패')) return envelope(500, 5000, 'Server error', null);
    const seen = new Set<string>();
    const duplicates = body.rounds.flatMap((round, index) => {
      if (seen.has(round.startAt)) return [{ field: `rounds[${index}].startAt`, validCode: 'DUPLICATE' }];
      seen.add(round.startAt);
      return [];
    });
    if (duplicates.length > 0) return envelope(400, 4000, 'Invalid input', duplicates);
    return ok({ showId: `s-${Date.now()}` });
  }),
  // 약관 등록: 같은 버전이 있으면 Spring 형식 필드 오류(400). 등록 응답은 새 약관이다.
  http.post(`${API}/terms`, async ({ request }) => {
    const denied = unauthorized(request);
    if (denied) return denied;
    await latency();
    const body = (await request.json()) as Omit<MockTerms, 'termsId'>;
    if (mockDb.terms.some((terms) => terms.version === body.version))
      return envelope(400, 4000, 'Invalid input', [{ field: 'version', validCode: 'DUPLICATE' }]);
    const created: MockTerms = { ...body, termsId: `t-${String(mockDb.terms.length + 1).padStart(3, '0')}` };
    mockDb.terms.push(created);
    return ok(created);
  }),
  http.get(`${API}/terms/:termsId`, async ({ request, params }) => {
    const denied = unauthorized(request);
    if (denied) return denied;
    await latency();
    const found = mockDb.terms.find((terms) => terms.termsId === params.termsId);
    return found === undefined ? envelope(404, 4040, 'Not found', null) : ok(found);
  }),
  http.post(`${API}/auth/sign-in`, async ({ request }) => {
    await latency();
    const body = (await request.json()) as { loginId?: string; password?: string };
    if (body.loginId !== 'admin' || body.password !== 'password') return envelope(401, 4011, 'Bad credentials', null);
    return ok({ accessToken: mockDb.issueToken() });
  }),

  http.post(`${API}/auth/reissue`, async () => {
    await latency();
    if (!mockDb.refreshValid) return envelope(401, 4013, 'Refresh token expired', null);
    return ok({ accessToken: mockDb.issueToken() });
  }),

  http.post(`${API}/auth/sign-out`, ({ request }) => {
    const token = bearer(request);
    if (token !== undefined) mockDb.revokeToken(token);
    mockDb.refreshValid = false;
    return ok(null);
  }),

  http.get(`${API}/categories`, async ({ request }) => {
    await latency();
    const denied = unauthorized(request);
    if (denied) return denied;
    return ok([...mockDb.categories]);
  }),

  http.get(`${API}/products`, async ({ request }) => {
    await latency();
    const denied = unauthorized(request);
    if (denied) return denied;
    const query = new URL(request.url).searchParams;
    const keyword = query.get('keyword')?.toLowerCase();
    const statuses = query.getAll('status');
    const categoryId = query.get('categoryId');
    const from = query.get('createdFrom');
    const to = query.get('createdTo');
    const [sortKey = 'createdAt', direction = 'desc'] = (query.get('sort') ?? '').split(',');
    const page = Number(query.get('page') ?? 0);
    const size = Number(query.get('size') ?? 20);
    const rows = mockDb.products
      .filter(
        (product) => keyword === undefined || product.name.toLowerCase().includes(keyword) || product.code.toLowerCase().includes(keyword),
      )
      .filter((product) => statuses.length === 0 || statuses.includes(product.status))
      .filter((product) => categoryId === null || product.categoryId === categoryId)
      .filter((product) => from === null || product.createdAt.slice(0, 10) >= from)
      .filter((product) => to === null || product.createdAt.slice(0, 10) <= to)
      .sort((a, b) => {
        const left = a[sortKey as keyof Product] ?? '';
        const right = b[sortKey as keyof Product] ?? '';
        const order = left < right ? -1 : left > right ? 1 : 0;
        return direction === 'asc' ? order : -order;
      });
    const content = rows
      .slice(page * size, page * size + size)
      .map(({ stock: _stock, description: _description, options: _options, updatedAt: _updatedAt, ...summary }) => summary);
    return ok({ content, totalElements: rows.length });
  }),

  http.get(`${API}/members`, async ({ request }) => {
    await latency();
    const denied = unauthorized(request);
    if (denied) return denied;
    const query = new URL(request.url).searchParams;
    const keywords = query.getAll('keyword').map((item) => item.split(':') as [keyof (typeof MEMBERS)[number], string]);
    const methods = query.getAll('signupMethod');
    const statuses = query.getAll('accountStatus');
    const periodType = (query.get('periodType') ?? 'joinedAt') as 'joinedAt' | 'lastLoginAt';
    const from = query.get('from');
    const to = query.get('to');
    const [sortKey = 'joinedAt', direction = 'desc'] = (query.get('sort') ?? '').split(',');
    const page = Number(query.get('page') ?? 0);
    const size = Number(query.get('size') ?? 100);
    const rows = MEMBERS.filter((member) =>
      keywords.every(([field, value]) => String(member[field]).toLowerCase().includes(value.toLowerCase())),
    )
      .filter((member) => methods.length === 0 || methods.includes(member.signupMethod))
      .filter((member) => statuses.length === 0 || statuses.includes(member.accountStatus))
      .filter((member) => from === null || member[periodType].slice(0, 10) >= from)
      .filter((member) => to === null || member[periodType].slice(0, 10) <= to)
      .sort((a, b) => {
        const left = a[sortKey as keyof (typeof MEMBERS)[number]];
        const right = b[sortKey as keyof (typeof MEMBERS)[number]];
        const order = left < right ? -1 : left > right ? 1 : 0;
        return direction === 'asc' ? order : -order;
      });
    return ok({ content: rows.slice(page * size, page * size + size), totalElements: rows.length });
  }),

  http.post(`${API}/products`, async ({ request }) => {
    await latency();
    const denied = unauthorized(request);
    if (denied) return denied;
    const body = (await request.json()) as ProductUpsertRequest;
    const duplicate = duplicateCode(body);
    if (duplicate) return duplicate;
    const now = new Date().toISOString();
    const created: Product = {
      ...body,
      description: body.description ?? null,
      productId: `p-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    mockDb.products = [created, ...mockDb.products];
    return ok(created);
  }),

  http.post(`${API}/products/deactivate`, async ({ request }) => {
    await latency();
    const denied = unauthorized(request);
    if (denied) return denied;
    const { productIds } = (await request.json()) as { productIds: string[] };
    if (productIds.length > BULK_LIMIT) return envelope(200, 3001, 'Too many items at once', null);
    mockDb.products = mockDb.products.map((product) =>
      productIds.includes(product.productId) ? { ...product, status: 'INACTIVE' } : product,
    );
    return ok({ deactivatedCount: productIds.length });
  }),

  http.get(`${API}/products/:productId`, async ({ request, params }) => {
    await latency();
    const denied = unauthorized(request);
    if (denied) return denied;
    const product = findProduct(params.productId);
    return product === undefined ? envelope(404, 4040, 'Not exist', null) : ok(product);
  }),

  http.put(`${API}/products/:productId`, async ({ request, params }) => {
    await latency();
    const denied = unauthorized(request);
    if (denied) return denied;
    const product = findProduct(params.productId);
    if (product === undefined) return envelope(404, 4040, 'Not exist', null);
    const body = (await request.json()) as ProductUpsertRequest;
    const duplicate = duplicateCode(body, product.productId);
    if (duplicate) return duplicate;
    const updated: Product = { ...product, ...body, description: body.description ?? null, updatedAt: new Date().toISOString() };
    mockDb.products = mockDb.products.map((item) => (item.productId === product.productId ? updated : item));
    return ok(updated);
  }),
];
