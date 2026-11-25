// 파일 책임: 화면 검사에서 조작 한 번에 어떤 컴포넌트가 실제로 다시 그려졌는지 key로 센다.
// 결과 검사는 다시 그린 범위를 보지 못하고 걸린 시간은 실행 환경마다 흔들리므로, 반복해 그리는 줄의 비용은 다시 그린 횟수로 잰다.
// React DevTools와 같은 연결(__REACT_DEVTOOLS_GLOBAL_HOOK__)로 커밋된 트리를 읽는다. React DOM은 이 연결을 처음 불러올 때 한 번만
// 찾으므로, 이 모듈은 React DOM보다 먼저 실행돼야 한다(검사 설정 setupFiles의 맨 앞).
// 다시 그림 판정: 받은 값이 바뀌어 함수가 실행되고 그 결과가 커밋된 fiber에는 PerformedWork(1) 표시가 남는다.
// 이번 커밋에서 손대지 않은 하위 트리는 건너뛴다. 세지 않는 것: 같은 state로 다시 실행됐다가 React가 버린 실행(결과가 커밋되지 않음).
interface Fiber {
  key: string | null;
  type: unknown;
  return: Fiber | null;
  flags: number;
  child: Fiber | null;
  sibling: Fiber | null;
  alternate: Fiber | null;
}

const PERFORMED_WORK = 1;
const watchers = new Set<{ component: string; renders: string[] }>();

function nameOf(type: unknown) {
  return typeof type === 'function' ? type.name : undefined;
}

function record(fiber: Fiber) {
  const name = nameOf(fiber.type);
  if (!name) return;
  for (const watcher of watchers) {
    // memo(Row, 비교 함수)는 key를 감싼 바깥 fiber에 둔다.
    if (watcher.component === name)
      watcher.renders.push(fiber.key ?? fiber.return?.key ?? '(key 없음)');
  }
}

/** 새로 붙은 하위 트리: 모두 처음 그린 것이다. */
function visitMounted(fiber: Fiber | null) {
  for (let child = fiber; child; child = child.sibling) {
    record(child);
    visitMounted(child.child);
  }
}

/** 이번 커밋의 트리(next)를 앞 트리(prev)와 짝지어 내려가며, 실제로 실행된 컴포넌트만 기록한다. */
function visitUpdated(next: Fiber, prev: Fiber) {
  if (next.child === prev.child) return; // 이번 커밋에서 손대지 않은 하위 트리
  for (let child = next.child; child; child = child.sibling) {
    if (!child.alternate) {
      record(child);
      visitMounted(child.child);
      continue;
    }
    if (child.flags & PERFORMED_WORK) record(child);
    visitUpdated(child, child.alternate);
  }
}

let connected = false;
const hook = {
  supportsFiber: true,
  renderers: new Map(),
  inject: () => {
    connected = true;
    return 1;
  },
  onCommitFiberRoot(_id: number, root: { current: Fiber }) {
    if (watchers.size === 0) return;
    const prev = root.current.alternate;
    if (prev) visitUpdated(root.current, prev);
    else visitMounted(root.current.child);
  },
  onCommitFiberUnmount: () => undefined,
  onPostCommitFiberRoot: () => undefined,
};
const scope = globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown };
if (scope.__REACT_DEVTOOLS_GLOBAL_HOOK__ === undefined) scope.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;

/** React DOM이 이 연결보다 먼저 실행됐거나 다른 연결이 먼저 있으면 센 결과가 늘 비므로, 시작할 때 알린다. */
function assertConnected() {
  if (scope.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== hook || !connected)
    throw new Error(
      'render-watch: React DOM과 연결되지 않았습니다. 검사 설정 setupFiles의 맨 앞에 @boosterlab/web-kit/testing/render-watch를 두세요.'
    );
}

/**
 * 지금부터 stop까지 이름이 component인 컴포넌트가 다시 그려질 때마다 그 key를 순서대로 모은다(두 번 그리면 두 번).
 * 예: 체크 표에서 칸 하나를 누르는 동안 watchRenders('AccessRow') → renders = ['ORDERS.CREATE'].
 * key는 화면 전체에서 겹치지 않아야 구별된다. 이름은 함수 이름이다(memo로 감싸면 안쪽 함수의 이름).
 */
export function watchRenders(component: string) {
  assertConnected();
  const watcher = { component, renders: [] as string[] };
  watchers.add(watcher);
  return { renders: watcher.renders, stop: () => watchers.delete(watcher) };
}
