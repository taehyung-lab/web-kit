// 파일 책임: 검사 설정이 render-watch를 React DOM보다 먼저 실행해, 화면 검사에서 다시 그린 줄을 셀 수 있는지 확인한다.
import { watchRenders } from '@boosterlab/web-kit/testing/render-watch';
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';

function Line({ label }: { label: string }) {
  return <li>{label}</li>;
}

it('검사 설정에 연결된 render-watch가 처음 그린 줄을 key로 센다', () => {
  const lines = watchRenders('Line');
  render(
    <ul>
      {['first', 'second'].map((label) => (
        <Line key={label} label={label} />
      ))}
    </ul>
  );
  lines.stop();
  expect(lines.renders).toEqual(['first', 'second']);
});
