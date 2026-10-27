// 파일 책임: 키트 공개 함수로 선택·조회·요청·폼 상태 보존 계약을 검사한다.
import { describe, expect, it } from 'vitest';
import { serializeFlatListParams, serializeSpringParams } from '../src/api';
import { createFormMessages } from '../src/form';
import { checkboxTreeSelection } from '../src/checkbox-tree';
import { validateDateRange } from '../src/search/date-range';

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

describe('기간 입력 검증', () => {
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

// 서로 다른 기존 marker가 있어도 현재 언어에서 같은 시점에 해소한다.
it.each(['@form-error:', '@form-validation:'])('오류 참조 %s는 번역 시점과 치환값을 보존한다', (prefix) => {
  const codec = createFormMessages(prefix);
  const value = codec.encode('form:required', { max: 3 });
  expect(value).toBe(prefix + '{"key":"form:required","values":{"max":3}}');
  expect(codec.resolve({ message: value }, (key, values) => `ko:${key}:${values.max}`)).toBe('ko:form:required:3');
  expect(codec.resolve(value, key => `en:${key}`)).toBe('en:form:required');
  expect(codec.resolve('plain', () => 'unexpected')).toBe('plain');
  expect(codec.resolve({}, () => 'unexpected')).toBeUndefined();
});
