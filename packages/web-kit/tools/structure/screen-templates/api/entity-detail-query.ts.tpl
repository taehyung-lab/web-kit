// 파일 책임: {{Entity}} 단건 조회 query 정의. web-kit-new가 만든 골격이다.
import { queryOptions } from '@tanstack/react-query';
import type { {{Entity}} } from '{{alias}}features/{{feature}}/model/{{entity}}';

/** 상세·수정 원본이 같은 query(같은 캐시)를 쓴다. */
export function {{entityCamel}}DetailQuery(id: string) {
  return queryOptions({
    queryKey: ['{{feature}}', 'detail', id] as const,
    // TODO(web-kit-new): 생성 endpoint를 호출하고 DTO를 앱 모델로 바꾼다. 응답을 지어내지 않는다. 채우기 전에는 typecheck가 실패한다.
    queryFn: ({ signal }): Promise<{{Entity}}> => {{TODO}}detail_endpoint(id, signal),
  });
}
