// 파일 책임: 약관 상세 흐름. 단건 상태 판정(useRecord)을 이 한 곳에서 한다.
import { useRecord } from '@boosterlab/web-kit/record';
import { termsQuery } from '../api/terms';

/** 상세 화면이 쓸 단건 상태. */
export function useTermsDetail(termsId: string) {
  return useRecord(termsQuery(termsId), termsId, { progress: 'page' });
}
