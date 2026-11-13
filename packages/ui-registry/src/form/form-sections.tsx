// 파일 책임: 칸 묶음 구역. 제목만 있는 구역(Section)과 접을 수 있는 구역(FormSection, 열림·오류 표시·제출 뒤 펼침).
import { useFormSection } from '@boosterlab/web-kit/form';
import type { AnyFormApi } from '@tanstack/react-form';
import { useId, type ReactNode } from 'react';
import { cn } from 'cn';
import { useFormContext } from './form-context';

/**
 * 칸 묶음 하나(제목 있는 구역). `fields`(이 구역 칸의 정확한 경로나 접두)를 주면 접을 수 있는 구역이 된다:
 * 머리글 버튼이 열고 닫고, 구역 칸에 오류가 있으면 머리글에 표시하며, 제출 뒤 오류가 있으면 펼친 다음 첫 오류 칸에 포커스한다.
 * 접을 수 있으려면 자기 칸을 알아야 한다(오류를 숨긴 채 닫혀 있지 않게).
 */
export function Section({
  title,
  fields,
  errorMarker,
  children,
  className,
  headingClassName,
}: {
  readonly title?: ReactNode;
  readonly fields?: readonly string[];
  /** 머리글 오류 표시를 바꾼다(FormSection과 같다). 없으면 「!」 + 낭독 `messages.sectionErrors`. */
  readonly errorMarker?: (errorCount: number) => ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  /** 구역 제목 줄의 모양(접는 구역은 h2, 그 밖에는 legend). 기본 클래스 뒤에 합치며 열고 닫기·오류 표시는 바꾸지 않는다. */
  readonly headingClassName?: string;
}) {
  const { editor, copy } = useFormContext();
  if (fields !== undefined) {
    return (
      <FormSection
        form={editor.form}
        fields={fields}
        title={title}
        errorLabel={copy.sectionErrors}
        errorMarker={errorMarker}
        className={className}
        headingClassName={headingClassName}
      >
        {children}
      </FormSection>
    );
  }
  return (
    <fieldset data-slot="form-section" className={cn('grid min-w-0 gap-4 rounded-xl border border-border p-4', className)}>
      {title === undefined ? null : <legend className={cn('px-1 text-sm font-medium', headingClassName)}>{title}</legend>}
      {children}
    </fieldset>
  );
}

/**
 * 접을 수 있는 구역(열림·오류 표시·제출 뒤 펼침). `Form.Section fields`가 이것을 쓰고, 키트 `Form` 밖의 폼(useSaveForm의 form만 있는 화면)도
 * 같은 부품을 직접 쓴다. 닫혀도 칸은 마운트된 채 숨긴다(값·검증 유지). 열림·오류 수·거절 때 펼침은 키트가, 머리글에 오류를 어떻게 보일지는 프로젝트가 정한다:
 * 기본 머리글 표시는 「!」이고 화면 낭독기는 오류 수(`errorLabel`)를 읽는다. `errorMarker`를 주면 그 표시로 바꾼다(예: 보이는 "오류 2개" 배지).
 */
export function FormSection({
  form,
  fields,
  title,
  errorLabel,
  errorMarker,
  className,
  headingClassName,
  children,
}: {
  readonly form: AnyFormApi;
  readonly fields: readonly string[];
  readonly title: ReactNode;
  /** 오류 수 → 화면 낭독기 문구(기본 표시가 쓴다). */
  readonly errorLabel: (count: number) => string;
  /** 오류가 있을 때 머리글 제목 뒤에 그릴 표시(오류 수를 받는다). 화면 낭독기가 읽을 문구도 이 표시가 책임진다. 없으면 기본 표시. */
  readonly errorMarker?: (errorCount: number) => ReactNode;
  readonly className?: string;
  /** 제목 줄(h2)의 모양. 기본 클래스 뒤에 합친다. */
  readonly headingClassName?: string;
  readonly children: ReactNode;
}) {
  const section = useFormSection(form, fields);
  const contentId = useId();
  return (
    <section data-slot="form-section" className={cn('min-w-0 rounded-xl border border-border', className)}>
      <h2 className={cn('text-base font-medium', headingClassName)}>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={section.open}
          aria-controls={contentId}
          onClick={section.toggle}
        >
          {title}
          {section.errorCount > 0 ? ' ' : null}
          {section.errorCount > 0 && errorMarker !== undefined ? errorMarker(section.errorCount) : null}
          {section.errorCount > 0 && errorMarker === undefined ? (
            <span className="rounded-full bg-destructive px-2 text-xs text-white">
              <span aria-hidden="true">!</span>
              <span className="sr-only">{errorLabel(section.errorCount)}</span>
            </span>
          ) : null}
        </button>
      </h2>
      <div id={contentId} className="grid gap-4 px-4 pb-4" hidden={!section.open}>
        {children}
      </div>
    </section>
  );
}
