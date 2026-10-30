---
name: web-kit-http
description: API 호출·응답 봉투·실패 처리·세션 저장과 탭 동기화·토큰 재발급·로그인/로그아웃·세션 유휴 마감과 만료 경고·활동 연장·재개 유예·QueryClient·조회 재시도·쓰기 뒤 무효화를 만들거나 바꿀 때 읽는다. 로그인 전 코드·기한·재전송은 web-kit-auth, 폼 저장 수명은 web-kit-form, 단건 상태는 web-kit-record로 보낸다.
---

# web-kit http · session · failure · query

이 키트의 `/failure`, `/session`, `/session/idle`, `/http`, `/query`를 연결하는 기준이다. 함수 인자와 타입은 설치된 소스의 export를 따른다.

이 책임만 골라 사용할 수 있다. 선택한 한 책임 안에서는 키트 수명 처리와 자체 구현을 섞지 않는다. 선택 설치 peer(해당 기능을 쓸 때만 설치하는 동료 라이브러리)를 설치하지 않아 실행하지 못한 기능은 "검사하지 않음"으로 기록한다. 예시는 같은 버전의 실제 starter 코드에서 가져와 패키지에 함께 담는다. 링크로 읽고 조립 방식만 참고한다. 예제만 따로 실행하는 용도는 아니다.

## 화면 선언

실제 조립 예: [apps/starter/src/features/products/api/products.ts](../../references/apps/starter/src/features/products/api/products.ts.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- 화면은 생성 endpoint 함수나 queryOptions를 쓰고, 전송 예외를 직접 해석하지 않는다. 받는 실패는 `RequestFailure`(12종 `kind`)다.
- 쓰기 뒤 다시 읽을 조회는 mutation `meta: { invalidates: [key, …] }`로 선언한다. 성공했을 때와 `resultUnknown`일 때 실행된다.
- 비밀번호처럼 보관하면 안 되는 입력값이 든 쓰기는 `meta: { sensitive: true }`로 선언한다. 성공이든 실패든 끝나면 요청 보관소의 기록이 지워진다(화면이 쓰기를 지켜보는 중이어도). 오류 전달과 다시 시도는 그대로다.
- 문구는 `kind`와 `messageKey`로 고른다. 서버 resultMessage는 실패에 담기지 않는다.

## 키트 보장

실제 조립 예: [apps/starter/src/app/session.test.tsx](../../references/apps/starter/src/app/session.test.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- **실패:** status 기본 분류는 결과 코드 표 `(status, code)` 행보다 뒤다. HTTP 200 안의 다른 resultCode는 business, 봉투가 아니면 contract다. 파일로 받는 요청(`responseType: 'blob'`)도 응답이 JSON이면 본문을 JSON으로 읽어 같은 규칙으로 해석한다(다운로드 실패 문구가 resultCode를 따른다). 취소는 `cancelled`이고 화면 상태·알림에 들어가지 않는다.
- **세션 수명** 한 곳이 세대를 판정한다.
  - 로그인·계정 교체(`start`)와 로그아웃·종료(`end`)는 세대를 올린다. `end`는 세대마다 한 번만 알린다.
  - 종료 사유 `by`: 이 탭의 로그아웃(`local`), 유휴 마감(`idle`), 다른 탭(`other-tab`), 서버 인증 계약(`server`).
  - 종료 순서: 자격증명을 잡아 둔다 → 저장값을 지운다 → 정리 구독(QueryClient 캐시 비움)을 부른다 → 앱 구독(안내·이동)을 부른다 → `local`·`idle`이면 `signOut`을 잡아 둔 자격증명으로 한 번 보낸다. 앱 구독은 등록 순서와 관계없이 이전 사용자 캐시가 지워진 뒤에 받는다. `signOut` 실패는 로컬 종료를 되돌리지 않는다. `server`·`other-tab`에는 보내지 않는다.
  - 다른 탭의 저장값이 같은 sessionId면 토큰 회전으로 보고, 아니면 교체 또는 종료로 본다.
  - 세대가 바뀐 뒤 도착한 응답과 재발급 결과는 저장·재전송·화면 반영에 들어가지 않고 `cancelled`로 끝난다. 이 보장은 클라이언트 반영까지다. 쿠키 격리는 서버 계약이다(E3).
- **재발급:** 같은 세대에서는 한 번만 실행한다. Web Locks가 있으면 탭 사이에서 하나만 돌고, lock 안에서 저장값을 다시 읽어 다른 탭의 결과를 재사용한다(구체 방식은 E3 확인 대기).
  - 재발급 실패도 인증 계약으로 판정한다. 401이나 결과 코드 표의 세션 종료 행(HTTP 200 포함)이면 세션을 끝낸다. 종료 사유는 종료 행이면 그 재발급 실패이고, 아니면 원 요청 실패다. 재발급의 403은 contract로 바뀐다. 일시 실패는 세션을 유지한다.
  - 원 요청 없이도(SSE 등) 재발급할 수 있다.
  - 기다리던 요청 하나가 취소되면 그 요청만 끝나고 재발급은 계속된다.
- **요청 처리:**
  - 인증 거절(401 또는 종료 행)이 왔는데 요청이 쓴 토큰이 그 사이 회전돼 있으면, 그것은 옛 토큰에 대한 응답이다. 재발급·종료 없이 현재 토큰으로 다시 보내고, 토큰이 또 바뀌었을 때만 반복한다. 쓰기는 E1 전제상 다시 보내지 않고 원래 실패를 `resultUnknown`으로 돌려준다.
  - 조회의 401은 재발급 뒤 한 번만 다시 보낸다. 재전송 뒤에는 재발급하지 않는다.
  - 세션 종료는 결과 코드 표의 세션 종료 행(HTTP 200 포함)으로만 판정하고, 그 요청은 화면에 `cancelled`로 끝난다.
  - 쓰기의 401은 다시 보내지 않는다(E1 확인 전 전제). 재발급만 하고 원래 실패를 `resultUnknown`으로 돌려준다.
  - `resultUnknown`은 http가 요청 경로로 판정한다. 쓰기 자체의 network·timeout, 그리고 쓰기의 401이 해당한다.
- **유휴 마감(`/session/idle`):** `createIdleTimer`를 만들고 `start()`를 부른 앱에서만 동작한다. 타이머는 활동 연장 요청이나 임시 마감을 스스로 만들지 않는다.
  - `policy`는 `warningMs`와 필수 `pendingAtDeadline: 'wait' | 'expire'`다. `durationMs`·`activityThrottleMs`는 타이머 입력에서 제거됐다. 문구용 세션 길이는 프로젝트가 소유한다.
  - 로그인·복원·다른 탭 계정 교체에서 이 세션의 마감이 없으면 마감 미정(`deadline: null`, `remaining(): null`, 경고 없음)이다. `start()` 때 저장 마감이 이미 지났으면 그 자리에서 `idle`로 끝낸다. `start()` 전 `pause()`는 그 판정을 재개 결과에 맡긴다.
  - 일반 응답의 `observe(sample)`는 로그인 전후 모두 시계만 보정한다. 로그인 뒤 첫 표본 자동 채택은 제거됐다. 프로젝트가 고른 응답만 `acceptDeadline(sessionId, sample)`로 넘긴다. 세션 시작 뒤라면 타이머 `start()` 전에도 전달할 수 있다. 로그인 응답을 먼저 받았다면 프로젝트가 세션을 시작한 다음 그 세션 ID로 넘긴다. 세션 ID 없는 마감을 다음 로그인에 예약하지 않는다.
  - 같은 세션의 서버 마감은 더 늦은 값만 채택한다. 요청 전송 순서가 더 이르더라도 더 긴 마감이면 채택한다. 동일·짧은 서버 마감과 다른 세션 값은 채택하지 않는다. 직접 전달·저장 이벤트·복원에 같은 규칙을 적용한다. 불변 저장 기록을 병합하므로 같은 옛값을 본 탭들의 동시 쓰기에서도 긴 마감은 남고, 그 탭이 닫혀도 새 탭이 복원한다. 기록은 쓰기·시작·저장 변경/매초 확인 때 전체 병합값을 담은 불변 기록을 확보한 뒤 읽었던 키만 정리한다. 순차 실행에서는 현재 세션의 요약 하나로 유지하고, 동시 정리에서 잠시 남은 요약은 다음 확인에서 합친다. 이전 세션 기록·종료 표식은 제거하며 단일 현재 세션 경계로 늦은 옛 쓰기를 차단한다.
  - 프로젝트가 임시 마감을 허용하면 `setProvisionalDeadline(sessionId, deadline)`로 보정 시계 기준 절대시각을 넣는다. `createServerClock`의 `now()`로 계산한다. 서버 마감이 있으면 임시 마감을 넣지 않으며, 처음 명시 전달한 서버 마감이 임시 마감보다 짧아도 그 서버 값으로 대체한다. 로컬 임시·유예는 서버 승인으로 취급하지 않는다(`deadlineSource`로 구분).
  - 서버 시계는 같은 `ServerClock`을 인증 단계와 공유할 수 있다. 표본 `sentAt` 순서로 오래된 보정을 배제하며 다른 탭 보정도 읽는다. 시계는 세션 없이도 관측·구독·저장 이벤트 때 읽었던 과거 표본을 정리해, 순차 실행 뒤 최신 불변 표본 하나만 남긴다. 동시 쓰기의 새 표본은 읽었던 삭제 목록에 없으며 다음 관측에서 같은 최신 값으로 수렴한다. 페이지 재로드마다 writer 키를 누적 보유하지 않는다. 시계와 마감을 함께 전달하면 중간 보정만으로 종료하지 않는다.
  - `extend()`는 탭 안에서 한 요청으로 합류한다. 결과는 `kind: 'failed'`(요청 실패, `failure` 포함), `'no-deadline'`(응답했지만 채택 없음), `'adopted-warning'`(채택했지만 경고 해소 안 됨), `'adopted-active'`(채택하고 경고 해소)다. 동일 마감 재응답도 `no-deadline`이다. 화면에서 무엇을 성공으로 보여 줄지는 프로젝트가 정한다.
  - `pendingAtDeadline: 'wait'`는 **판정하는 탭 자신의** 진행 중 연장만 기다린다. 프로젝트는 연장 요청에 timeout을 설정해 기다림의 상한을 정해야 한다. `'expire'`는 자기 요청 진행 중이어도 정상 만료를 적용한다. 다른 탭의 정상 만료·비대표 5초 복구 종료가 먼저 일어날 수 있다. 종료·세대 교체·stop 뒤 늦은 성공은 세션이나 마감을 되살리지 않는다.
  - Web Locks를 쥔 탭 하나가 대표(`leader`)다. 대표는 마감에 끝내고, **마감 뒤에도 세션이 유지되는 비대표 탭**은 5초 뒤 스스로 끝낸다(자기 요청을 기다리는 탭은 위 선택을 따른다). 대표가 닫히면 다음 대기 탭이 이어받는다. Web Locks가 없으면 모든 탭이 대표이며 탭 간 단일성을 확대 보장하지 않는다. Worker 1초 tick, 부재 때 setInterval 대체는 유지한다.
  - `state`·`subscribe`는 상태 변화만, `remaining`·`subscribeTick`은 매초 표시를 따로 제공한다. `dismiss()`·`dismissed`와 재노출 규칙은 제거됐다. UI는 `phase`·`leader`·`visible`·`sessionId`를 보고 자기 닫음 상태를 관리한다. 경고를 대표에게만 띄울지도 화면이 정한다.
  - **멈춤·재개:** `pause()`는 탭 단위 경고·만료를 멈추고 대표를 반납한다. `remaining()`은 null이며 단계는 warning이 되지 않는다. 세션·저장·시계 구독은 유지된다. `resume({ graceMs? })`는 서버 확인을 동반하는 선택 기능이며 한 번의 연장 결과를 돌려준다. 진행 중 다시 부르면 합류한다. 그 사이 `pause()`가 오면 받은 서버 마감은 저장하되 멈춤을 유지한다. 다시 resume하면 그 결과로 재개한다.
  - 재개 완료 때 마감이 없거나 지났고 서버가 거절했다면(기존 재발급 기준: 401 또는 종료 행) 그 탭이 끝낸다. 일시 실패·마감 없는 응답에는 프로젝트가 `graceMs`를 준 경우만 **실패 확정 시점의 보정 시계부터** 한 번 적용한다. 미지정이면 지난 마감은 일반 만료로 처리하고 무마감은 미정으로 남는다. 취소·세대 변경·다시 pause·stop에는 유예를 적용하지 않는다. 다른 탭이 끝낸 세션을 살리거나 다른 탭의 새 유효 서버 마감을 덮지 않는다. 유예 뒤 더 늦은 서버 마감이 오면 그 서버 값으로 대체한다. 유예는 저장돼 새로고침·다른 탭도 같은 시한을 쓴다.
  - 세션 종료와 stop은 멈춤을 풀고, 계정 교체는 멈춤을 유지한다. 멈춘 탭도 다른 탭의 세션 종료를 받는다.
- **선택 활동 부품(`/session/activity`):** `attachSessionActivity({ idle, intervalMs, events? })`는 부착 즉시 이벤트를 듣고 해제 함수를 돌려준다. 기본 이벤트는 click·mousedown·keydown·wheel·touchstart·popstate다. 문서가 보이고 포커스가 있으며 경고 밖·멈춤 아님·마감 있음일 때만 연장한다. 로컬 재개 유예 중에는 활동 연장을 하지 않는다. 미부착이면 조작으로 요청하지 않는다.
  - 간격은 **마지막 연장 시도 시각**(`idle.lastAttemptAt()`) 기준이다. 성공·실패·재개·직접 연장을 모두 포함하고 세션에 묶어 공유한다. 다른 탭이 이미 기록한 시도 뒤의 간격을 지킨다. 두 탭이 동시에 판단할 때 탭 전체 정확히 한 요청은 보장하지 않는다. 그 밖의 계기는 프로젝트가 `extend()`를 부른다.
- **query:** 조회 자동 재시도는 network·timeout·server-error만 대상이고 횟수는 프로젝트가 정한다. 쓰기는 자동 재시도하지 않는다. 조회·쓰기의 최종 실패는 출처(`query`/`mutation`)와 함께 취소를 빼고 한 번 `notify`된다. 이전 세션의 쓰기는 알리지 않는다. 세션이 바뀌면 진행 중 조회를 중단하고 캐시 전체를 비운다. 이전 세션의 쓰기는 무효화를 일으키지 않는다. 서버에서 이미 실행된 쓰기를 취소한다고 보장하지는 않는다.

## 프로젝트 연결

소비 검사 연결은 [starter의 세션 연결](../../references/apps/starter/src/app/session-idle.ts.txt), [경고 UI](../../references/apps/starter/src/app/SessionWarning.tsx.txt), [소비 검사](../../references/apps/starter/src/app/session-idle.test.tsx.txt)에 있다. 실제 운영 서버의 경로·헤더 정책을 정하지 않는 격리 fixture이며 starter 기본 화면에는 유휴 정책을 켜지 않는다. [시간·탭 순서 검사](../../references/packages/web-kit/tests/session-policy.test.ts.txt)와 [기존 수명 검사](../../references/packages/web-kit/tests/session-idle.test.ts.txt)는 DT·REF 실제 연결 검사를 대신하지 않는다.

실제 조립 예: [apps/starter/src/app/web-kit.ts](../../references/apps/starter/src/app/web-kit.ts.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

키트 초기 연결의 진입점은 한 곳이다(기본 `app/web-kit.ts`): session·http·QueryClient를 만들고 아래 adapter를 넘긴다. adapter 구현은 각자 자리에 둔다.

- 결과 코드 표는 서버 enum에 있는 행만 옮겨 적는다. 이름만 보고 행을 더하지 않는다.
- 기본 브라우저 저장은 `/session/browser`의 `createBrowserSessionStore({key, credentials, unreadable})`를 쓴다. 자격증명은 동기 Standard Schema로 검증하며 읽기 불가 정책은 `memory` 또는 `empty`를 명시한다. 저장 실패의 최신 논리 상태·옛 이벤트 거절·현재 외부 변경은 키트가 처리한다. 각 쓰기에 revision을 붙여 같은 값의 새 쓰기도 구별한다. revision 없는 이전 envelope도 읽지만 쓰기 실패 후 같은 바이트를 다시 쓴 외부 변경은 새 쓰기임을 증명할 수 없어 보수적으로 무시한다. 저장 형식 이전은 소비자 책임이다.
- 앱 또는 격리된 수명이 끝나면 `session.dispose()`와 `store.dispose()`로 구독을 해제한다. dispose는 영속 로그아웃이 아니다.
- 다른 환경의 `SessionStore`: 저장 위치와 다른 탭 변경 알림(예: localStorage + storage 이벤트). 영속 저장에 실패했으면 다음 읽기에 오래된 값을 새 회전으로 내보내지 않는다(최신 논리 값 또는 null). 이 탭의 종료 뒤 읽기는 다른 탭의 실제 쓰기 전까지 null이며, 이 탭의 쓰기를 다른 탭 변경으로 알리지 않는다. 저장소 읽기 자체가 불가능할 때의 유지/종료·이전 형식 이전은 프로젝트 정책이다.
- `reissue(credentials)`: 재발급 endpoint 호출. 공개 요청으로 보낸다. 재발급 응답의 결과 코드 의미가 일반 요청과 다르면, 이 adapter가 실패에 `endsSession`·`messageKey`를 실어 던진다(결과 코드 표는 일반 요청용이다).
- `isPublic`: 로그인 전·재발급·로그아웃 경로. 공개 요청에는 토큰이 실리지 않고, 세션도 건드리지 않는다.
- `prepare`: 언어·메뉴 같은 운영 헤더.
- 서버 로그아웃은 `createSession({ signOut })`에 넘긴다. 받은 자격증명의 토큰을 헤더에 직접 실어 공개 요청으로 보낸다. 로그아웃 버튼은 `session.end()`만 부른다. 그 뒤 로그인 이동은 앱 안 이동(router navigate)으로 한다. `window.location`으로 문서를 다시 읽으면 브라우저가 진행 중인 `signOut` 요청을 끊어 서버 세션이 남는다.
- `session.subscribe`의 `ended`에서 로그인 이동·안내를 한다. `by`로 이 탭의 로그아웃(local), 다른 탭(other-tab), 서버 인증 계약(server)을 구별한다. 토큰 저장 위치는 프로젝트 정책이다.
- 유휴 마감은 프로젝트의 세션 시작과 명시 마감 전달을 같은 연결에서 조립한다. 어떤 응답의 마감을 받을지·임시 마감 계기·경고 길이·0초 선택·재개 유예 길이·활동 부품 부착과 화면 닫음 상태는 프로젝트가 정한다. 서버 형식은 `ServerTimeSample`로 해석해 넘긴다.
- 자기 연장 응답 메타가 필요하면 `http.requestWithResponse<T>()`를 쓴다. `{ data, sentAt, response: { status, header } }`는 최종 성공 전송 하나에 묶인다(동시 요청·재전송에도 다른 응답과 섞이지 않음). `requestData`·`request`의 기존 반환값은 유지한다.
- 연결 상태 표시·서버 시각 동기화 같은 관찰은 `observe`로 받는다. 재전송·재발급을 포함한 전송 시도마다 한 번 오고, 응답이 없으면 `response`가 없다.
- orval mutator는 `http.request` 하나로 둔다.
- 요청 query는 `/api`에서 서버 계약에 맞는 것을 고른다. `serializeSpringParams`는 재귀 객체용이고, `serializeFlatListParams`는 한 단계 깊이의 목록용이다(중첩은 TypeError). 둘 다 null·undefined는 빼고 빈 문자열·0·false는 보존한다.
- `notify`에서 어떤 실패를 어디에 보일지 출처로 고른다(예: 활성 조회의 forbidden만 모달). 화면이 이미 보이는 쓰기 실패와 겹치지 않게 한다.

## 확인 방법

실제 조립 예: [apps/starter/src/app/session.test.tsx](../../references/apps/starter/src/app/session.test.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

registry 항목을 채택하면 함께 설치한 검사 연결 파일을 자기 단위·브라우저 CI에서 실행하고 `web-kit-check`를 필수 단계로 둔다. starter 통과로 대신하지 않는다. 실제 사용 UI와 검사 대상의 일치는 별도 검토로 판정한다. 설치·결과 파일 연결은 [소비 안내](../../docs/consuming.md#복사본-적합성-검사)를 따른다.

- 저장 adapter는 `/testing/session`의 `checkSessionStoreAdapter`로 저장 실패 뒤 재발급·다른 탭 변경·종료를 확인한다. 실제 adapter에 실패를 주입하는 fixture 연결은 [소비 안내](../../docs/consuming.md#저장-adapter-검사)를 따른다.
- 실제 adapter로 다음을 관찰한다.
  - 보낸 Authorization 헤더와 운영 헤더
  - 401 → 재발급 1회 → 재전송 1회
  - 세션 종료 행 → 로그인 이동 1회
  - 쓰기 401의 재전송 0회
  - 로그아웃 뒤 이전 화면 데이터 미노출
- mock 통과나 HTTP 200만으로 서버 계약을 확인했다고 하지 않는다.

## 미확인 외부 계약

실제 조립 예: [apps/starter/src/features/auth/api/auth.ts](../../references/apps/starter/src/features/auth/api/auth.ts.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

E1(401이 업무 실행 전인가), E2(일반·재발급 요청의 status·resultCode 의미), E3(동시 재발급, 이전 refresh 토큰 재사용, 늦은 응답의 쿠키 변경)는 설치된 web-kit 패키지의 결정 기록 0001(web-kit 1.0 구조와 수명 계약)이 기준이다. 확인되기 전까지 해당 부분은 보류한다.

## 프로젝트별 응답 계약

실제 조립 예: [apps/starter/src/app/web-kit.ts](../../references/apps/starter/src/app/web-kit.ts.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

`createHttp({ response: { read(body, status, requestId) } })`로 서버 형식·성공 판정·코드 의미를 프로젝트가 해석한다. 결과는 `{ ok: true, data }` 또는 `{ ok: false, failure: RequestFailure }`다. HTTP 거절은 성공으로 바꿀 수 없다. 네트워크·취소·타임아웃과 세션 회복은 키트가 맡는다. 같은 코드의 메시지 키도 프로젝트마다 다를 수 있으며 번역 문구는 키트에 넣지 않는다.

기존 응답 봉투를 쓰는 소비자는 `readEnvelope`·`toRequestFailure`를 자기 계약 함수 안에서 사용할 수 있다. `response` 생략 시 기존 동작을 유지한다. 실제 데이터 타입을 넘기면 `http.requestData<T>`를 쓴다. 기존 생성 봉투 타입을 푸는 `http.request<T>`는 호환용으로 유지한다.

사용자 정의 `response.read`는 성공 값 또는 `RequestFailure`를 반환한다. 응답 형식이 잘못되어도 실패 값을 반환하며 예외를 던지지 않는다. 키트는 반환된 실패의 상태 코드와 요청 식별자를 실제 HTTP 응답 값으로 맞추므로 응답 본문이 재발급 여부를 바꿀 수 없다.

## 기존 소비자 이전

요청과 마감 전달 연결은 [starter 세션 예제](../../references/apps/starter/src/app/session-idle.ts.txt)를 참고한다. 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다. 예제는 격리 소비 검사다.

DT 이전 시 프로젝트가 넘길 입력: 활동 부품과 1분 간격, `pendingAtDeadline: 'wait'`, 로그인 완료 후 보정 시계 기준 30분 임시 마감, 로그인 확정·연장 응답의 명시 전달, `resume({ graceMs: 60_000 })`, 경고 닫음과 재노출을 소유하는 UI다. 이는 DT 사용자 결정에 근거한 이전 안내이며 키트 기본값이 아니다. 전역 최신 표본 변수는 `requestWithResponse`로 교체한다. 탭 전체 동시 요청 수의 엄격한 제한과 다른 탭이 끝내는 동안의 연장 대기는 기존 한계이며 DT 실제 이전에서 확인한다.

REF는 헤더 없는 로그인·복원, 수동 ping 실패 처리, 경고 길이·문구·재노출과 비대표 5초 복구 호환성을 실제 이전 때 확인해야 한다. 이 문서는 그 미확인 값을 정하지 않는다. 저장 불가·Web Locks/Worker 부재 환경의 보장은 확대하지 않는다.
