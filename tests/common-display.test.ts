/** 표시 정책과 목록 복귀 문맥의 경계를 검사한다. */
import { expect, it } from 'vitest';
import { maskText } from '../src/masking';
import { captureListReturn, resolveListReturn } from '../src/list-return';
it('마스킹은 명시한 노출 수와 유니코드 문자 경계를 지킨다', () => {
  expect(maskText('가😀나다', { visibleStart: 1, visibleEnd: 1 })).toBe('가**다');
  expect(maskText('ab', { visibleStart: 2, visibleEnd: 2 })).toBe('ab');
  expect(() => maskText('abc', { visibleStart: -1, visibleEnd: 0 })).toThrow();
});
it('복귀는 같은 목록의 검색과 해시를 보존하고 외부·다른 경로는 거절한다', () => {
  expect(resolveListReturn(captureListReturn('/items?page=3#row'), '/items')).toBe('/items?page=3#row');
  for (const href of ['https://example.com', '//example.com', '/other', '/\\example.com'])
    expect(resolveListReturn({ href }, '/items')).toBe('/items');
  expect(() => captureListReturn('//example.com')).toThrow();
});
