// 파일 책임: 회원 목록 API 연결(예시 endpoint GET /api/members, POST /api/members/status). 생성 코드가 없는 endpoint를 앱의 apiRequest로 직접 부른다.
import { apiRequest } from '@/runtime/web-kit';
import { serializeFlatListParams } from '@boosterlab/web-kit/api';
import type { ListPage } from '@boosterlab/web-kit/list';
import type { WriteMeta } from '@boosterlab/web-kit/query';
import { queryOptions, useMutation } from '@tanstack/react-query';
import type { MemberAccountStatus, MemberSignupMethod, MemberSummary } from '../member';

/** 회원 목록 요청 query(서버 계약). 빈 조건은 보내지 않는다. 키워드는 `대상:값` 반복 키다. */
export interface MemberListParams {
  readonly page: number;
  readonly size: number;
  readonly sort: string;
  readonly periodType: string;
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly keyword: string[] | undefined;
  readonly signupMethod: MemberSignupMethod[] | undefined;
  readonly accountStatus: MemberAccountStatus[] | undefined;
}

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

/** 고른 회원들의 계정 상태를 한 값으로 바꾼다. 끝나면 회원 목록을 다시 조회한다. 바꾼 건수를 돌려준다. */
export function useChangeMemberStatus() {
  return useMutation({
    mutationFn: async ({ ids, status }: { readonly ids: readonly string[]; readonly status: MemberAccountStatus }) =>
      (
        await apiRequest<{ changedCount: number }>({
          url: '/api/members/status',
          method: 'POST',
          data: { memberIds: [...ids], accountStatus: status },
        })
      ).changedCount,
    meta: { invalidates: [memberKeys.all] } satisfies WriteMeta,
  });
}
