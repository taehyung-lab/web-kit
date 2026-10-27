// 파일 책임: 회원 목록 API 연결(예시 endpoint GET /api/members). 생성 코드가 없는 endpoint를 앱의 apiRequest로 직접 부른다.
import { apiRequest } from '@/app/web-kit';
import { serializeFlatListParams } from '@boosterlab/web-kit/api';
import type { ListPage } from '@boosterlab/web-kit/list';
import { queryOptions } from '@tanstack/react-query';
import type { MemberListParams } from '../model/list-search';
import type { MemberSummary } from '../model/member';

export const memberKeys = {
  all: ['members'] as const,
  list: (params: MemberListParams) => [...memberKeys.all, 'list', params] as const,
};

/** 목록 조회. 배열 조건은 반복 키로 보낸다. */
export function memberListQuery(params: MemberListParams) {
  return queryOptions({
    queryKey: memberKeys.list(params),
    queryFn: async ({ signal }): Promise<ListPage<MemberSummary>> => {
      const page = await apiRequest<{ content: MemberSummary[]; totalElements: number }>({
        url: '/api/members',
        method: 'GET',
        params,
        signal,
        paramsSerializer: { serialize: serializeFlatListParams },
      });
      return { rows: page.content, total: page.totalElements };
    },
  });
}
