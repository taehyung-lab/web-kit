// 파일 책임: {{Entity}} 목록 조회 query 정의(요청·응답 변환). web-kit-new가 만든 골격이다.
import type { ListPage } from '@boosterlab/web-kit/list';
import { queryOptions } from '@tanstack/react-query';
import type { {{Entity}} } from '{{alias}}features/{{feature}}/model/{{entity}}';

/** 목록 요청(서버 계약). TODO(web-kit-new): 서버 명세의 요청 이름·형식으로 바꾼다. */
export interface {{Entity}}ListParams {
  readonly page: number;
}

export function {{entityCamel}}ListQuery(params: {{Entity}}ListParams) {
  return queryOptions({
    queryKey: ['{{feature}}', 'list', params] as const,
    // TODO(web-kit-new): 생성 endpoint를 호출하고 응답을 { rows, total }로 바꾼다. 응답을 지어내지 않는다. 채우기 전에는 typecheck가 실패한다.
    queryFn: ({ signal }): Promise<ListPage<{{Entity}}>> => {{TODO}}list_endpoint(params, signal),
  });
}
