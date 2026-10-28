// 파일 책임: 약관 API 연결(예시 endpoint POST /api/terms, GET /api/terms/:id). 생성 코드가 없는 endpoint를 앱의 apiRequest로 부른다.
import { apiRequest } from '@/app/web-kit';
import { queryOptions, useMutation } from '@tanstack/react-query';
import type { Terms, TermsFormValues } from '../model/terms';

/** 약관 단건. */
export function termsQuery(termsId: string) {
  return queryOptions({
    queryKey: ['terms', termsId] as const,
    queryFn: ({ signal }) => apiRequest<Terms>({ url: `/api/terms/${encodeURIComponent(termsId)}`, method: 'GET', signal }),
  });
}

/** 약관 등록. */
export function useCreateTerms() {
  return useMutation({ mutationFn: (values: TermsFormValues) => apiRequest<Terms>({ url: '/api/terms', method: 'POST', data: values }) });
}
