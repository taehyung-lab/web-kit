// 파일 책임: pnpm dev:mock 에서 브라우저 service worker로 mock API를 켠다.
// 실제 서버는 새로 고침해도 발급한 토큰·저장한 데이터를 잊지 않는다. mock 상태는 페이지 메모리에 있어 새로 고침하면 사라지므로,
// localStorage(앱 세션 저장소와 같은 범위)에 두고 다시 읽는다. 지우면 앱은 저장된 토큰으로 보낸 첫 쓰기가 401을 받아
// 키트가 "저장 결과를 확인할 수 없습니다"(쓰기 401은 재전송하지 않음, 결정 0003 E1)로 끝낸다 — mock에만 있는 현상이다.
import { setupWorker } from 'msw/browser';
import { mockDb, type MockSnapshot } from './db';
import { handlers } from './handlers';

const STORAGE_KEY = 'starter.mock-server';

/** 저장된 mock 서버 상태를 읽는다. 없거나 읽을 수 없으면 처음 상태로 둔다. */
function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) mockDb.restore(JSON.parse(raw) as MockSnapshot);
  } catch {
    mockDb.reset();
  }
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockDb.snapshot()));
  } catch {
    // 저장소를 쓸 수 없으면 이전처럼 페이지 메모리에만 둔다.
  }
}

/** mock worker를 시작한다. 처리하지 않는 요청(정적 파일 등)은 그대로 통과시킨다. */
export async function startMockWorker() {
  load();
  // 다른 탭도 같은 서버를 본다.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) load();
  });
  const worker = setupWorker(...handlers);
  worker.events.on('response:mocked', save);
  await worker.start({ onUnhandledRequest: 'bypass' });
}
