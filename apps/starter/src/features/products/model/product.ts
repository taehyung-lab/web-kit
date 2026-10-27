// 파일 책임: 상품 화면이 쓰는 앱 모델(서버 DTO와 분리)과 상태 값 목록. 분류는 서버 선택지다.
import { ProductStatus } from '@/api/generated/models';

export { ProductStatus };
/** 서버 enum 순서 그대로. URL·필터 표시 순서도 이것을 따른다. */
export const PRODUCT_STATUSES = Object.values(ProductStatus);

/** 상품 분류 선택지 하나. 목록은 서버가 정한다(GET /api/categories). */
export interface Category {
  readonly id: string;
  readonly name: string;
}

/** 상품 옵션 한 줄. 추가금액은 원 단위 정수다. */
export interface ProductOption {
  readonly name: string;
  readonly extraPrice: number;
}

export interface ProductSummary {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly status: ProductStatus;
  readonly categoryId: string;
  readonly price: number;
  readonly createdAt: string;
}

export interface Product extends ProductSummary {
  readonly stock: number;
  readonly options: readonly ProductOption[];
  /** 서버의 null은 빈 문자열로 받는다. */
  readonly description: string;
  readonly updatedAt: string;
}
