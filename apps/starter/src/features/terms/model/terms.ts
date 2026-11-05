// 파일 책임: 약관 단건의 앱 모양(예시 서버 응답).
import type { TermsFormValues } from './forms/terms-form';

export interface Terms extends TermsFormValues {
  readonly termsId: string;
}
