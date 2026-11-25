// @vitest-environment jsdom
// 파일 책임: React DOM이 render-watch보다 먼저 실행된 설정에서는 빈 결과로 통과시키지 않고 오류로 알리는지 확인한다.
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';

it('React DOM이 먼저 실행됐으면 watchRenders가 설정 순서를 알리는 오류를 던진다', async () => {
  render(<p>ready</p>);
  const { watchRenders } = await import('../src/testing/render-watch');
  expect(() => watchRenders('Row')).toThrow(/setupFiles의 맨 앞/);
});
