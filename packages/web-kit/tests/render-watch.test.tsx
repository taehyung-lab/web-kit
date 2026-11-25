// @vitest-environment jsdom
// 파일 책임: watchRenders가 조작 한 번에 실제로 다시 그린 줄만 key로 세는지 확인한다.
// render-watch는 React DOM보다 먼저 실행돼야 하므로 가장 먼저 import한다.
import { watchRenders } from '../src/testing/render-watch';
import { act, cleanup, render } from '@testing-library/react';
import { memo, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(cleanup);

const Row = memo(function Row({ label }: { label: string }) {
  return <li>{label}</li>;
});
const PlainRow = function PlainRow({ label }: { label: string }) {
  return <li>{label}</li>;
};
const ComparedRow = memo(
  function ComparedRow({ label }: { label: string; at: number }) {
    return <li>{label}</li>;
  },
  (before, after) => before.label === after.label
);

/** 세 줄 가운데 두 번째 줄의 값만 바꾸는 표. */
function Rows({ kind }: { kind: 'memo' | 'plain' | 'compared' }) {
  const [second, setSecond] = useState('b');
  const [tick, setTick] = useState(0);
  const labels = ['a', second, 'c'];
  return (
    <>
      <button onClick={() => setSecond((value) => value + '!')}>change</button>
      <button onClick={() => setTick((value) => value + 1)}>tick</button>
      <ul>
        {labels.map((label, at) =>
          kind === 'memo' ? (
            <Row key={`row-${at}`} label={label} />
          ) : kind === 'plain' ? (
            <PlainRow key={`row-${at}`} label={label} />
          ) : (
            <ComparedRow key={`row-${at}`} label={label} at={tick} />
          )
        )}
      </ul>
    </>
  );
}

const click = (view: ReturnType<typeof render>, name: string) =>
  act(() => view.getByRole('button', { name }).click());

it('처음 그린 줄을 모두 센다', () => {
  const rows = watchRenders('Row');
  render(<Rows kind="memo" />);
  rows.stop();
  expect(rows.renders).toEqual(['row-0', 'row-1', 'row-2']);
});

it('값이 바뀐 줄만 세고, 값이 그대로인 memo 줄은 세지 않는다', () => {
  const view = render(<Rows kind="memo" />);
  const rows = watchRenders('Row');
  click(view, 'change');
  rows.stop();
  expect(rows.renders).toEqual(['row-1']);
});

it('memo가 없으면 부모가 다시 그릴 때 모든 줄을 센다', () => {
  const view = render(<Rows kind="plain" />);
  const rows = watchRenders('PlainRow');
  click(view, 'change');
  rows.stop();
  expect(rows.renders).toEqual(['row-0', 'row-1', 'row-2']);
});

it('비교 함수를 준 memo도 바깥 key로 세고, 비교가 같다고 본 줄은 세지 않는다', () => {
  const view = render(<Rows kind="compared" />);
  const rows = watchRenders('ComparedRow');
  click(view, 'tick');
  click(view, 'change');
  rows.stop();
  expect(rows.renders).toEqual(['row-1']);
});

it('같은 줄을 두 번 그리면 두 번 센다', () => {
  const view = render(<Rows kind="memo" />);
  const rows = watchRenders('Row');
  click(view, 'change');
  click(view, 'change');
  rows.stop();
  expect(rows.renders).toEqual(['row-1', 'row-1']);
});

it('stop 뒤에는 세지 않는다', () => {
  const view = render(<Rows kind="memo" />);
  const rows = watchRenders('Row');
  rows.stop();
  click(view, 'change');
  expect(rows.renders).toEqual([]);
});

it('React DOM이 아닌 렌더러의 커밋은 세지 않는다', () => {
  const connection = (
    globalThis as unknown as {
      __REACT_DEVTOOLS_GLOBAL_HOOK__: {
        inject(internals: object): number;
        onCommitFiberRoot(id: number, root: object): void;
      };
    }
  ).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const other = connection.inject({ rendererPackageName: 'react-test-renderer' });
  // React DOM 번호로 같은 커밋을 보냈다면 기록됐을 fiber다(새로 붙은 줄).
  const rows = watchRenders('PlainRow');
  const fiber = {
    key: 'other',
    type: PlainRow,
    return: null,
    flags: 1,
    child: null,
    sibling: null,
    alternate: null,
  };
  connection.onCommitFiberRoot(other, {
    current: {
      key: null,
      type: null,
      return: null,
      flags: 0,
      child: fiber,
      sibling: null,
      alternate: null,
    },
  });
  rows.stop();
  expect(rows.renders).toEqual([]);
});

it('같은 전역에서 모듈이 다시 실행돼도 React DOM과 맺은 연결을 이어 쓴다', async () => {
  vi.resetModules();
  const again = await import('../src/testing/render-watch');
  const view = render(<Rows kind="memo" />);
  const rows = again.watchRenders('Row');
  click(view, 'change');
  rows.stop();
  expect(rows.renders).toEqual(['row-1']);
});
