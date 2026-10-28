// 파일 책임: openapi/sample.json 계약을 흉내 내는 msw handler. Spring 봉투, 401 → 재발급, 필드 오류, 없음, HTTP 200 업무 거절을 낸다.
import type { Product, ProductUpsertRequest } from '@/api/generated/models';
import { delay, http, HttpResponse, type DefaultBodyType } from 'msw';
import { mockDb, type MockTerms } from './db';
import { MEMBERS } from './members';

const API = '*/api';
/** 일괄 작업 한도(mock 업무 규칙). 넘으면 HTTP 200 봉투에 업무 거절 코드를 준다. */
const BULK_LIMIT = 5;

/** 브라우저 mock에서만 응답을 조금 늦춰 대기 상태를 볼 수 있게 한다. */
async function latency() {
  if (typeof window !== 'undefined' && import.meta.env.MODE === 'mock') await delay(250);
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

export const handlers = [
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
      .filter((product) => keyword === undefined || product.name.toLowerCase().includes(keyword) || product.code.toLowerCase().includes(keyword))
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
    const content = rows.slice(page * size, page * size + size).map(({ stock: _stock, description: _description, options: _options, updatedAt: _updatedAt, ...summary }) => summary);
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
    const rows = MEMBERS.filter((member) => keywords.every(([field, value]) => String(member[field]).toLowerCase().includes(value.toLowerCase())))
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
    const created: Product = { ...body, description: body.description ?? null, productId: `p-${Date.now()}`, createdAt: now, updatedAt: now };
    mockDb.products = [created, ...mockDb.products];
    return ok(created);
  }),

  http.post(`${API}/products/deactivate`, async ({ request }) => {
    await latency();
    const denied = unauthorized(request);
    if (denied) return denied;
    const { productIds } = (await request.json()) as { productIds: string[] };
    if (productIds.length > BULK_LIMIT) return envelope(200, 3001, 'Too many items at once', null);
    mockDb.products = mockDb.products.map((product) => (productIds.includes(product.productId) ? { ...product, status: 'INACTIVE' } : product));
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
