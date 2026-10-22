// 파일 책임: 키트 공개 함수로 선택·조회·요청·폼 상태 보존 계약을 검사한다.
import { describe, expect, it } from 'vitest';
import { FormApi } from '@tanstack/react-form';
import { serializeFlatListParams, serializeSpringParams } from '../src/api';
import { resolveRequiredRecord } from '../src/detail';
import { submitForm, clearFormServerErrors, setFormServerErrors } from '../src/form';
import { checkboxTreeSelection } from '../src/checkbox-tree';
import { validateDateRange, recoverUrlField } from '../src/search';

describe('query 문자열', () => {
  for (const serialize of [serializeFlatListParams, serializeSpringParams]) {
    it(`${serialize.name}: 반복 키·객체 배열·빈 scalar`, () => {
      const result = serialize({ status: ['A', 'B'], keywords: [{ type: 'NAME', value: '김 & A' }], q: '', page: 0, enabled: false, absent: null, missing: undefined });
      const query = new URLSearchParams(result);
      expect(query.getAll('status')).toEqual(['A', 'B']);
      expect(query.get('keywords[0].value')).toBe('김 & A');
      expect(query.get('q')).toBe('');
      expect(query.get('page')).toBe('0');
      expect(query.get('enabled')).toBe('false');
      expect(query.has('absent')).toBe(false);
      expect(query.has('missing')).toBe(false);
      expect(result).toContain('keywords%5B0%5D.value=');
    });
  }
  it('엄격한 목록은 중첩 모양을 거절한다', () => {
    expect(() => serializeFlatListParams({ filter: { id: 1 } })).toThrow(TypeError);
    expect(() => serializeFlatListParams({ rows: [{ nested: { id: 1 } }] })).toThrow(TypeError);
  });
  it('재귀 방식은 중첩 경로를 보존한다', () => {
    expect(serializeSpringParams({ rows: [{ nested: { id: 1 } }] })).toBe('rows%5B0%5D.nested.id=1');
  });
});

describe('필수 레코드 상태', () => {
  it('삭제 응답과 incident는 캐시보다 우선한다', () => {
    const facts = { data: { id: 1 }, isPending: false };
    expect(resolveRequiredRecord(facts, 'not-found')).toEqual({ kind: 'not-found' });
    expect(resolveRequiredRecord(facts, 'incident')).toEqual({ kind: 'delegated', outcome: 'incident' });
  });
  it('일반 실패·대기에도 기존 데이터는 유지한다', () => {
    for (const isPending of [true, false]) {
      expect(resolveRequiredRecord({ data: 0, isPending })).toEqual({ kind: 'ready', data: 0 });
    }
  });
  it('데이터 없는 대기·완료·none을 구분한다', () => {
    expect(resolveRequiredRecord({ data: undefined, isPending: true })).toEqual({ kind: 'pending' });
    expect(resolveRequiredRecord({ data: undefined, isPending: false })).toEqual({ kind: 'error' });
    expect(resolveRequiredRecord({ data: undefined, isPending: true }, 'none')).toEqual({ kind: 'delegated', outcome: 'none' });
    expect(resolveRequiredRecord({ data: false, isPending: false }, 'none')).toEqual({ kind: 'ready', data: false });
  });
});

describe('서버 필드 오류 수명', () => {
  it('번역 참조를 배치하고 서버 오류만 지우며 입력과 다른 오류를 보존한다', () => {
    const form = new FormApi({ defaultValues: { title: '입력 유지', other: '다른 입력' } });
    form.mount();
    form.setFieldMeta('title', meta => ({ ...meta, errorMap: { onBlur: 'blur', onSubmit: 'submit' } }));
    const paths = setFormServerErrors(form, ['title'], () => 'i18n:duplicate');
    expect(paths).toEqual(['title']);
    expect(form.getFieldMeta('title')?.errorMap).toMatchObject({ onBlur: 'blur', onSubmit: 'submit', onServer: 'i18n:duplicate' });
    clearFormServerErrors(form, ['title', 'other']);
    expect(form.getFieldMeta('title')?.errorMap).toMatchObject({ onBlur: 'blur', onSubmit: 'submit', onServer: undefined });
    expect(form.state.values).toEqual({ title: '입력 유지', other: '다른 입력' });
  });
  it('비동기 submit 검증 실패는 저장을 차단한다', async () => {
    let saved = 0;
    const form = new FormApi({ defaultValues: { title: '' }, validators: { onSubmitAsync: async ({ value }) => value.title ? undefined : 'required' }, onSubmit: () => { saved += 1; } });
    form.mount();
    await submitForm(form);
    expect(saved).toBe(0);
    expect(form.state.errors).toContain('required');
    form.setFieldValue('title', 'valid');
    await submitForm(form);
    expect(saved).toBe(1);
  });
});

describe('URL 복구와 입력 검증 분리', () => {
  it('잘못된 URL 필드만 복구한다', () => {
    const number = { safeParse: (value: unknown) => typeof value === 'number' ? { success: true as const, data: value } : { success: false as const } };
    expect({ page: recoverUrlField(number, 'bad') ?? 1, size: recoverUrlField(number, 50) ?? 20 }).toEqual({ page: 1, size: 50 });
  });
  it.each([
    [undefined, undefined, undefined], ['2026-01-01', undefined, 'incomplete'],
    ['2026-02-30', '2026-03-01', 'invalid'], ['2026-03-02', '2026-03-01', 'reversed'],
    ['2024-02-29', '2024-03-01', undefined], ['0099-01-01', '0099-01-02', undefined],
  ])('기간 %s ~ %s', (start, end, expected) => { expect(validateDateRange(start, end)).toBe(expected); });
});

// 부모의 일부 선택을 mixed 상태로 바꾸는 회귀를 막는다.
it('자식 하나 선택은 부모 체크이며 부모 해제는 다른 가지를 보존한다', () => {
  const nodes = [{ label: 'A', children: [{ label: 'A1', value: 'a1' }, { label: 'A2', value: 'a2' }] }, { label: 'B', value: 'b' }];
  const selection = checkboxTreeSelection(nodes, ['a1', 'b']);
  expect(selection.checked(['a1', 'a2'])).toBe(true);
  expect(selection.checked(selection.all, true)).toBe(false);
  expect(selection.set(['a1', 'a2'], false)).toEqual(['b']);
  expect(selection.set(selection.all, true)).toEqual(['a1', 'a2', 'b']);
});
