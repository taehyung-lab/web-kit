// 파일 책임: {{Entity}} 목록 URL 검색 선언과 확정 검색 → 요청 변환. web-kit-new가 만든 골격이다.
import { defineSearch, type FullSearch } from '@boosterlab/web-kit/search';
import { z } from 'zod';
import type { {{Entity}}ListParams } from '{{alias}}features/{{feature}}/api/{{entity}}-list-query';

// TODO(web-kit-new): 제품이 정한 검색 필드·기본값·검색을 눌러야 조회(gated) 여부를 더한다(web-kit-list 스킬).
export const {{entityCamel}}ListSearch = defineSearch({
  fields: {
    page: { schema: z.number().int().min(1), default: 1 },
  },
});

export type {{Entity}}ListSearch = FullSearch<typeof {{entityCamel}}ListSearch.fields>;

/** 확정 검색 → 서버 요청. */
export function to{{Entity}}ListParams(search: {{Entity}}ListSearch): {{Entity}}ListParams {
  return { page: search.page - 1 };
}
