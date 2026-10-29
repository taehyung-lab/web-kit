---
name: web-kit-http
description: API 호출·응답 봉투·실패 처리·세션 저장과 탭 동기화·토큰 재발급·로그인/로그아웃·세션 유휴 마감과 만료 경고·연장·QueryClient·조회 재시도·쓰기 뒤 무효화를 만들거나 바꿀 때 읽는다. 폼 저장 수명은 web-kit-form, 단건 상태는 web-kit-record로 보낸다.
---

# web-kit http · session · failure · query

이 키트의 `/failure`, `/session`, `/session/idle`, `/http`, `/query`를 연결하는 기준이다. 함수 인자와 타입은 설치된 소스의 export를 따른다.

## 화면 선언

- 화면은 생성 endpoint 함수나 queryOptions를 쓰고, 전송 예외를 직접 해석하지 않는다. 받는 실패는 `RequestFailure`(12종 `kind`)다.
- 쓰기 뒤 다시 읽을 조회는 mutation `meta: { invalidates: [key, …] }`로 선언한다. 성공했을 때와 `resultUnknown`일 때 실행된다.
- 비밀번호처럼 보관하면 안 되는 입력값이 든 쓰기는 `meta: { sensitive: true }`로 선언한다. 성공이든 실패든 끝나면 요청 보관소의 기록이 지워진다(화면이 쓰기를 지켜보는 중이어도). 오류 전달과 다시 시도는 그대로다.
- 문구는 `kind`와 `messageKey`로 고른다. 서버 resultMessage는 실패에 담기지 않는다.

## 키트 보장

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
- **유휴 마감(`/session/idle`):** `createIdleTimer`를 만들고 `start()`를 부른 앱에서만 동작한다.
  - 마감은 로그인과 서버 연장(경고 구간 밖 활동의 연장과 경고 구간 안 `extend()`)만 바꾼다. 일반 응답·재발급 성공의 `observe`는 시계만 보정한다. 예외는 로그인 뒤에 보낸 첫 응답의 마감 표본 하나다(로그인 때 로컬 시계로 잡은 임시 마감을 서버 값으로 확정).
  - 경고 구간 밖에서 문서가 보이고 포커스가 있을 때의 명시적 조작(click·mousedown·keydown·wheel·touchstart·popstate)은 활동 연장 간격마다 서버 연장을 부른다. 간격은 저장된 마지막 연장 시각으로 탭 사이에 공유한다. 경고 구간에서는 조작이 연장하지 않고 `extend()`만 연장한다. `dismiss()`는 연장하지 않고 대기 상태를 만들며, 경고 구간을 벗어나거나 문서가 다시 보이면 풀린다.
  - 연장 성공은 서버 마감을 채택했고 남은 시간이 경고 구간을 벗어난 경우다. 연장 응답에 마감이 없거나 실패하면 `{ ok: false }`(실패가 있으면 `failure`)이고 경고는 유지된다.
  - 마감 표본은 세션 ID와 함께 저장한다. 다른 세션 ID의 표본, 더 먼저 보낸 요청의 표본, 세대가 바뀐 뒤 도착한 연장 응답은 마감을 바꾸지 않는다.
  - Web Locks를 쥔 탭 하나가 대표(`leader`)다. 대표 탭이 마감에 세션을 `idle`로 끝내고, 다른 탭은 그 결과를 다른 탭 종료로 받는다. 대표가 아닌 탭은 마감 뒤 5초가 지나도 끝나지 않았을 때만 스스로 끝낸다. 대표 탭이 닫히면 다음 탭이 대표가 된다. Web Locks가 없으면 모든 탭이 대표다.
  - 연장 요청 중에는 마감이 지나도 그 결과를 본 뒤 판단한다. 경고 UI 열림은 만료를 막지 않는다.
  - `start()`는 이 세션의 저장 마감이 없거나 지났으면 그 자리에서 `idle`로 끝낸다(라우터를 만들기 전에 부르면 끝난 세션이 화면에 들어가지 않는다).
  - 상태(`state`·`subscribe`)는 단계가 바뀔 때만 알리고, 남은 시간(`remaining`·`subscribeTick`)은 따로 매초 읽는다.
- **query:** 조회 자동 재시도는 network·timeout·server-error만 대상이고 횟수는 프로젝트가 정한다. 쓰기는 자동 재시도하지 않는다. 조회·쓰기의 최종 실패는 출처(`query`/`mutation`)와 함께 취소를 빼고 한 번 `notify`된다. 이전 세션의 쓰기는 알리지 않는다. 세션이 바뀌면 진행 중 조회를 중단하고 캐시 전체를 비운다. 이전 세션의 쓰기는 무효화를 일으키지 않는다. 서버에서 이미 실행된 쓰기를 취소한다고 보장하지는 않는다.

## 프로젝트 연결

키트 초기 연결의 진입점은 한 곳이다(기본 `app/web-kit.ts`): session·http·QueryClient를 만들고 아래 adapter를 넘긴다. adapter 구현은 각자 자리에 둔다.

- 결과 코드 표는 서버 enum에 있는 행만 옮겨 적는다. 이름만 보고 행을 더하지 않는다.
- 기본 브라우저 저장은 `/session/browser`의 `createBrowserSessionStore({key, credentials, unreadable})`를 쓴다. 자격증명은 동기 Standard Schema로 검증하며 읽기 불가 정책은 `memory` 또는 `empty`를 명시한다. 저장 실패의 최신 논리 상태·옛 이벤트 거절·현재 외부 변경은 키트가 처리한다. 각 쓰기에 revision을 붙여 같은 값의 새 쓰기도 구별한다. revision 없는 이전 envelope도 읽지만 쓰기 실패 후 같은 바이트를 다시 쓴 외부 변경은 새 쓰기임을 증명할 수 없어 보수적으로 무시한다. 저장 형식 이전은 소비자 책임이다.
- 앱 또는 격리된 수명이 끝나면 `session.dispose()`와 `store.dispose()`로 구독을 해제한다. dispose는 영속 로그아웃이 아니다.
- 다른 환경의 `SessionStore`: 저장 위치와 다른 탭 변경 알림(예: localStorage + storage 이벤트). 영속 저장에 실패했으면 다음 읽기에 오래된 값을 새 회전으로 내보내지 않는다(최신 논리 값 또는 null). 이 탭의 종료 뒤 읽기는 다른 탭의 실제 쓰기 전까지 null이며, 이 탭의 쓰기를 다른 탭 변경으로 알리지 않는다. 저장소 읽기 자체가 불가능할 때의 유지/종료·이전 형식 이전은 프로젝트 정책이다.
- `reissue(credentials)`: 재발급 endpoint 호출. 공개 요청으로 보낸다. 재발급 응답의 결과 코드 의미가 일반 요청과 다르면, 이 adapter가 실패에 `endsSession`·`messageKey`를 실어 던진다(결과 코드 표는 일반 요청용이다).
- `isPublic`: 로그인 전·재발급·로그아웃 경로. 공개 요청에는 토큰이 실리지 않고, 세션도 건드리지 않는다.
- `prepare`: 언어·메뉴 같은 운영 헤더.
- 서버 로그아웃은 `createSession({ signOut })`에 넘긴다. 받은 자격증명의 토큰을 헤더에 직접 실어 공개 요청으로 보낸다. 로그아웃 버튼은 `session.end()`만 부른다. 그 뒤 로그인 이동은 앱 안 이동(router navigate)으로 한다. `window.location`으로 문서를 다시 읽으면 브라우저가 진행 중인 `signOut` 요청을 끊어 서버 세션이 남는다(DT live 관찰 2026-10-27).
- `session.subscribe`의 `ended`에서 로그인 이동·안내를 한다. `by`로 이 탭의 로그아웃(local), 다른 탭(other-tab), 서버 인증 계약(server)을 구별한다. 토큰 저장 위치는 프로젝트 정책이다.
- 유휴 마감을 쓰면 `createIdleTimer({ session, key, policy, extend })`를 같은 진입점에서 만들고, 앱 시작 때 라우터보다 먼저 `start()`를 부른다. 프로젝트가 정하는 것: 시간 정책(`durationMs`·`warningMs`·`activityThrottleMs`), 저장 key, 서버 연장 호출(그 응답의 서버 시각 표본을 돌려준다), `observe`에서 응답 헤더를 `ServerTimeSample`(보낸 시각·서버 마감·시계 차이)로 바꾸는 일, 경고 디자인(팝업·모달·알림·제목)과 `ended`의 `idle` 안내, 연장 실패 안내. 대표 탭(`leader`)만 경고를 띄운다.
- 연결 상태 표시·서버 시각 동기화 같은 관찰은 `observe`로 받는다. 재전송·재발급을 포함한 전송 시도마다 한 번 오고, 응답이 없으면 `response`가 없다.
- orval mutator는 `http.request` 하나로 둔다.
- 요청 query는 `/api`에서 서버 계약에 맞는 것을 고른다. `serializeSpringParams`는 재귀 객체용이고, `serializeFlatListParams`는 한 단계 깊이의 목록용이다(중첩은 TypeError). 둘 다 null·undefined는 빼고 빈 문자열·0·false는 보존한다.
- `notify`에서 어떤 실패를 어디에 보일지 출처로 고른다(예: 활성 조회의 forbidden만 모달). 화면이 이미 보이는 쓰기 실패와 겹치지 않게 한다.

## 확인 방법

- 저장 adapter는 `/testing/session`의 `checkSessionStoreAdapter`로 저장 실패 뒤 재발급·다른 탭 변경·종료를 확인한다. 실제 adapter에 실패를 주입하는 fixture 연결은 [소비 안내](../../docs/consuming.md#저장-adapter-검사)를 따른다.
- 실제 adapter로 다음을 관찰한다.
  - 보낸 Authorization 헤더와 운영 헤더
  - 401 → 재발급 1회 → 재전송 1회
  - 세션 종료 행 → 로그인 이동 1회
  - 쓰기 401의 재전송 0회
  - 로그아웃 뒤 이전 화면 데이터 미노출
- mock 통과나 HTTP 200만으로 서버 계약을 확인했다고 하지 않는다.

## 미확인 외부 계약

E1(401이 업무 실행 전인가), E2(일반·재발급 요청의 status·resultCode 의미), E3(동시 재발급, 이전 refresh 토큰 재사용, 늦은 응답의 쿠키 변경)는 설치된 web-kit 패키지의 결정 기록 0001(web-kit 1.0 구조와 수명 계약)이 기준이다. 확인되기 전까지 해당 부분은 보류한다.

## 프로젝트별 응답 계약

`createHttp({ response: { read(body, status, requestId) } })`로 서버 형식·성공 판정·코드 의미를 프로젝트가 해석한다. 결과는 `{ ok: true, data }` 또는 `{ ok: false, failure: RequestFailure }`다. HTTP 거절은 성공으로 바꿀 수 없다. 네트워크·취소·타임아웃과 세션 회복은 키트가 맡는다. 같은 코드의 메시지 키도 프로젝트마다 다를 수 있으며 번역 문구는 키트에 넣지 않는다.

기존 응답 봉투를 쓰는 소비자는 `readEnvelope`·`toRequestFailure`를 자기 계약 함수 안에서 사용할 수 있다. `response` 생략 시 기존 동작을 유지한다. 실제 데이터 타입을 넘기면 `http.requestData<T>`를 쓴다. 기존 생성 봉투 타입을 푸는 `http.request<T>`는 호환용으로 유지한다.

사용자 정의 `response.read`는 성공 값 또는 `RequestFailure`를 반환한다. 응답 형식이 잘못되어도 실패 값을 반환하며 예외를 던지지 않는다. 키트는 반환된 실패의 상태 코드와 요청 식별자를 실제 HTTP 응답 값으로 맞추므로 응답 본문이 재발급 여부를 바꿀 수 없다.
