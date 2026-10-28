// 파일 책임: 약관 등록 폼의 값 모양·검증(레퍼런스 terms-form-schema의 규칙: 다섯 항목 필수, 버전은 숫자·점 10자 이하)과
// 폼 결과 → 저장 요청, 서버 필드 오류 대응, 약관 단건 모양.
import { formMessages } from '@/shared/lib/form-messages';
import type { FieldError } from '@boosterlab/web-kit/failure';
import { z } from 'zod';

export const TERMS_STATUSES = ['PUBLISHED', 'UNPUBLISHED'] as const;
export type TermsStatus = (typeof TERMS_STATUSES)[number];

const m = (key: string) => formMessages.encode(`terms.errors.${key}`);

export const termsFormSchema = z.object({
  version: z.string().trim().min(1, m('version')).max(10, m('versionLength')).regex(/^[0-9.]+$/, m('versionFormat')),
  effectiveAt: z.iso.date(m('effectiveAt')),
  status: z.string().pipe(z.enum(TERMS_STATUSES, m('status'))),
  publishedAt: z.iso.date(m('publishedAt')),
  body: z.string().trim().min(1, m('body')),
});
export type TermsFormInput = z.input<typeof termsFormSchema>;
export type TermsFormValues = z.output<typeof termsFormSchema>;

/** 등록 화면 첫 값: 게시 상태는 '게시', 나머지는 빈 값(레퍼런스 termsCreateDefaults). */
export const EMPTY_TERMS_FORM: TermsFormInput = { version: '', effectiveAt: '', status: 'PUBLISHED', publishedAt: '', body: '' };

export interface Terms extends TermsFormValues {
  readonly termsId: string;
}

/** 서버 필드 오류 → 폼 경로와 문구. 폼에 없는 필드면 붙이지 않는다. */
export function termsFieldError(error: FieldError): { readonly field: keyof TermsFormInput; readonly message: string } | undefined {
  if (!(error.field in EMPTY_TERMS_FORM)) return undefined;
  const key = error.field === 'version' && error.code === 'DUPLICATE' ? 'versionDuplicate' : 'invalid';
  return { field: error.field as keyof TermsFormInput, message: m(key) };
}
