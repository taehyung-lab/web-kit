// 파일 책임: 상품 API 연결. 생성 endpoint를 queryOptions·mutation으로 감싸고 서버 DTO를 앱 모델로 바꾼다. query key와 쓰기 뒤 무효화도 여기서 선언한다.
import type { ListProductsParams, Product as ProductDto, ProductSummary as ProductSummaryDto, ProductUpsertRequest } from '@/api/generated/models';
import { createProduct, deactivateProducts, getProduct, listProducts, updateProduct } from '@/api/generated/products/products';
import { serializeFlatListParams } from '@boosterlab/web-kit/api';
import type { ListPage } from '@boosterlab/web-kit/list';
import type { WriteMeta } from '@boosterlab/web-kit/query';
import { queryOptions, useMutation } from '@tanstack/react-query';
import type { Product, ProductSummary } from '../model/product';

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (params: ListProductsParams) => [...productKeys.lists(), params] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
};

function toSummary(dto: ProductSummaryDto): ProductSummary {
  return { id: dto.productId, name: dto.name, code: dto.code, status: dto.status, categoryId: dto.categoryId, price: dto.price, createdAt: dto.createdAt };
}

function toProduct(dto: ProductDto): Product {
  return { ...toSummary(dto), stock: dto.stock, options: dto.options, description: dto.description ?? '', updatedAt: dto.updatedAt };
}

/** 목록 조회. 상태 배열은 서버 계약대로 반복 키(status=A&status=B)로 보낸다. */
export function productListQuery(params: ListProductsParams) {
  return queryOptions({
    queryKey: productKeys.list(params),
    queryFn: async ({ signal }): Promise<ListPage<ProductSummary>> => {
      const page = await listProducts(params, { signal, paramsSerializer: { serialize: serializeFlatListParams } });
      return { rows: page.content.map(toSummary), total: page.totalElements };
    },
  });
}

/** 단건 조회. 상세와 수정 원본이 같은 것을 쓴다. */
export function productQuery(id: string) {
  return queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: async ({ signal }) => toProduct(await getProduct(id, { signal })),
  });
}

/** 등록. 성공하면 목록을 다시 읽는다. */
export function useCreateProduct() {
  return useMutation({
    mutationFn: async (request: ProductUpsertRequest) => toProduct(await createProduct(request)),
    meta: { invalidates: [productKeys.lists()] } satisfies WriteMeta,
  });
}

/** 수정. 성공(또는 반영 여부 미확정)이면 목록과 상세를 다시 읽는다. */
export function useUpdateProduct(id: string) {
  return useMutation({
    mutationFn: async (request: ProductUpsertRequest) => toProduct(await updateProduct(id, request)),
    meta: { invalidates: [productKeys.all] } satisfies WriteMeta,
  });
}

/** 선택한 상품 일괄 비활성화. */
export function useDeactivateProducts() {
  return useMutation({
    mutationFn: async (ids: readonly string[]) => (await deactivateProducts({ productIds: [...ids] })).deactivatedCount,
    meta: { invalidates: [productKeys.all] } satisfies WriteMeta,
  });
}
