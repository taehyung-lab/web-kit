---
name: web-kit-list
description: 목록 필터·기간 프리셋·날짜 검색의 시간대/UTC 경계·키워드 칩·표·페이지 이동·URL 검색 조건·필드 기본값 복구·검색 확정·페이지/정렬·조회 상태·선택지 확인·행 선택·일괄 작업·엑셀 다운로드 흐름을 만들거나 바꿀 때 읽는다. 권한 판정 연결은 web-kit-permission, 단건 상세는 web-kit-record, 요청·실패 해석은 web-kit-http로 보낸다.
---

# web-kit list · search

`/search`의 `defineSearch`, `/list`의 `useList`·`useListDownload`·`ListProvider`와 registry `list` 항목의 목록 복사본을 쓰는 기준이다. registry는 프로젝트에 설치해 소유하는 UI 원본 묶음이다. 공통 상태와 이벤트 순서는 패키지 hook이 맡는다. 인자와 타입은 설치된 소스를 따른다.

이 책임만 골라 사용할 수 있다. 선택한 한 책임 안에서는 키트 수명 처리와 자체 구현을 섞지 않는다. 선택 설치 peer(해당 기능을 쓸 때만 설치하는 동료 라이브러리)를 설치하지 않아 실행하지 못한 기능은 "검사하지 않음"으로 기록한다. 예시는 같은 버전의 실제 starter 코드에서 가져와 패키지에 함께 담는다. 링크로 읽고 조립 방식만 참고한다. 예제만 따로 실행하는 용도는 아니다. 이 책임을 어느 파일에 조립하는지(flow는 `features/<도메인>/flows`, 화면은 `screens`)는 [web-kit-structure](../web-kit-structure/SKILL.md)가 정한다. 아래에서 "화면"은 사용자가 보는 화면 단위를 뜻하며, 키트 수명 hook을 부르는 코드는 그 화면의 flow에 둔다.

## 화면 선언

실제 조립 예: [apps/starter/src/features/members/state/member-list-search.ts](../../references/apps/starter/src/features/members/state/member-list-search.ts.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- 목록 검색은 칸 종류로 선언한다(`listSearch`, `/search`). 종류가 주소 키·허용값·기본값·URL 복구 묶음·검색 제출 정리·화면이 읽을 선택지를 함께 정하므로 `groups`·`periods`·`view`·`sortFirst`를 따로 적지 않는다.
  - 제품마다 정책 하나를 `definePolicy`로 둔다: 페이지·보기 수·정렬·방향의 주소 키, 기본 보기 수, 처음 정렬 방향, 검색어 주소 표현(`KeywordCodec`, 배열 그대로면 `arrayKeywordCodec`)과 구분자·미추가 입력 포함(`pending: 'include' | 'exclude'`), 다중 선택 표현(`comma`·`array`, 조건 없음 토큰), 날짜 기간의 기본 주소 키와 진입 규칙(`paired`: 주소의 한쪽 날짜도 함께 지움 / `allow-open`: 한쪽 날짜는 둠. 둘 다 형식 오류·역순은 함께 지우고, 검색할 때는 한쪽만·역순을 함께 지운다). 키트는 이 값들의 기본값을 갖지 않는다.
  - 칸: `keywords({ targets })`, `choices({ values, multiple? })`, `dateRange({ types?, defaultType?, keys? })`, `paging(옵션?)`(생략하면 정책 보기 수), `sort({ values, default, order? })`. 기존 `SearchField`도 같은 자리에 넣을 수 있다. fields의 이름은 화면이 칸을 가리키는 이름이고 주소 키는 종류가 정한다(검색어·선택은 이름 그대로, 기간·페이지·정렬은 정책 키). 같은 주소 키가 두 번 나오면 선언할 때 오류다. 기간이 둘이면 한쪽의 `keys`를 바꾼다.
  - 확정 값 타입은 `SearchValues<typeof 선언>`이다(주소 키별 평면 값). 선언은 라우터를 실행 import하지 않으므로 순수 층에 두고 요청 변환이 그 타입을 읽는다.
  - 주소 연결은 `connectSearch(선언, { checks? })`다. 서버 선택지 확인(`checks: { 칸: { options, allowed, parents?, tree? } }`)은 실행 층의 query를 묶으므로 여기서 붙인다. 결과를 `useList`의 definition으로 쓰고, route는 `...connected.route({ guard })`를 펼친다. guard(권한 확인 등)는 주소 교정보다 먼저 실행되어 거부된 진입에서 주소를 바꾸지 않는다.
  - 화면 부품은 칸 이름으로 선언을 읽는다: `List.Period name`(+`typeLabels`), `List.Keywords name`(+`choiceLabels`, 구분자는 정책), `List.MultiSelect name`(+`optionLabels`), `List.PageSize`, `List.SortSelect`(+`optionLabels`). 문구는 값→문구 표로 주며 소비자는 `satisfies Record<값 타입, string>`으로 빠진 값을 타입에서 잡는다. 화면은 배치·문구만 준다. 이름이 없거나 종류가 다르거나 문구가 빠진 값이 있으면 오류다.
  - `List.Table`은 `rowId`·`selectable`을 생략하면 `useList`의 `rowId`와 `selectable`(선언했고 지금 행 중 선택할 수 있는 행이 있을 때 선택 칸)을 쓴다.
  - 정책이 `pending: 'include'`면 `useList.submit`이 [추가]하지 않은 입력을 같은 구분자·같은 추가 규칙(trim·중복 제거)으로 포함한다. 화면에서 submit을 감싸지 않는다.
- 칸 종류로 표현하지 못하는 검색은 아래 `defineSearch`로 직접 선언한다(같은 엔진). URL 하나에 `defineSearch` 하나를 선언한다.
  - 필드마다 schema와 default를 둔다. schema는 URL 값을 읽는 동기 Standard Schema이고 `.catch`를 붙이지 않는다. default는 제품이 정한 값 그대로다.
  - URL 표현이 값과 다르면(쉼표 목록 등) `encode`로 쓰고 schema로 읽는다.
  - URL에서 함께 맞아야 할 필드는 `groups: [{ fields, valid? }]`로 묶는다. 한 필드라도 못 읽거나 `valid`가 거짓이면(역순 기간 등) 묶음 전체가 기본값이 된다.
  - 검색 제출 때 정리할 날짜 쌍은 같은 선언의 `periods: [[시작, 끝]]`에 검색 필드 이름으로 둔다. `groups`는 URL 읽기, `periods`는 초안 제출을 맡아 서로의 규칙을 추정하지 않는다. 따라서 URL은 한쪽 날짜를 허용하되 사용자가 검색할 때는 두 날짜를 함께 요구하는 제품도 유지할 수 있다.
  - 조회 시작 조건은 화면 값이다: 들어오면 바로 조회(기본) / 필수 조건이 채워지면 조회(queryOptions `enabled`) / 검색을 눌러야 조회(`gated`).
  - 처음 누른 머리글의 정렬 방향은 `sortFirst`('asc'·'desc'·'current', 생략 시 지금 방향 유지)로 선언한다.
  - URL 값은 그 필드가 가질 수 있는 값만 남는다. 고정 목록(유형·상태·정렬 key 등)은 schema를 그 목록(`z.enum`)으로 두고, 서버 선택지에서 고르는 필드는 `check: { options(parents) → 선택지 queryOptions, allowed(data) → 가능한 값 }`을 둔다. 둘 다 아니면(`z.string` 그대로) 없는 값이 요청에 실린다.
  - `check.options`에는 필터 UI가 쓰는 선택지 queryOptions를 그대로 준다. 확인은 그 query의 observer라서 요청·상태를 필터 UI와 함께 쓴다. 상위 필드에 따라 선택지가 바뀌면 `parents`에 적는다.
- route에는 `validateSearch`와 `beforeLoad`를 연결한다. `validateSearch`는 정규 URL 표현을 내고 Router가 그대로 URL로 쓴다. 처음 진입한 주소가 정규형이 아니면(역순 기간·틀린 값·모르는 키) `beforeLoad`가 정규형으로 replace한다. route는 `Route.useSearch()`(URL 값)와 navigate를 화면에 넘기고, 화면의 목록 flow가 그것을 `useList`에 넘긴다([목록 flow](../../references/apps/starter/src/features/products/flows/use-product-list.ts.txt)). 값으로 읽는 일은 `useList`가 한다. 검색 선언(`defineSearch`)은 `state/`에 둔다.
- `useList`에 넘기는 것: 조회 queryOptions 생성 함수, `rowId`, 필요하면 `selectable`, 제품 검증 `validateDraft`(기간 한도 등). 선택지 준비 같은 화면 조건은 queryOptions의 `enabled`(boolean)로 주면 목록 조건과 함께 지켜지고, 충족 전에는 `idle`(`not-ready`)이다.
- 페이지의 주 목록이면 `useList({ progress: 'page' })`로 선언한다. 보여 줄 결과가 아직 없고 조회(주소 값 확인 조회 포함) 중인 동안만 앱 셸의 화면 전체 진행 덮개(registry `blocking-progress`의 `BlockingProgress`와 `/dialog` 연결 hook, web-kit-form 「화면 전체 진행 덮개」)가 덮는다. 검색·정렬·페이지 이동은 이전 결과를 보인 채 조회하므로 덮지 않는다. 대화창 안 목록은 선언하지 않는다.
- 입력 초안 모양이 URL 값과 다르면(기간 preset처럼 URL에는 날짜만 있는 화면) `useList({ draft: { from(search) → 초안, to(초안) → 필터 값 } })`로 선언한다. `draft`·`patchDraft`·`validateDraft`는 그 초안 모양을 쓴다. 검색 선언의 `periods`는 변환 뒤 검색 값으로 검사하고, 복구된 날짜와 연결된 초안만 갱신해 다른 입력은 보존한다. 기존 `useList({ periods })`는 초안 키를 받는 연결로 유지하며 명시하면(빈 배열 포함) 검색 선언의 `periods`보다 우선한다.
- 페이지·크기·정렬 필드 이름은 `defineSearch({ view: { size: 'pageSize', … } })`로 선언한다(기본 page·size·sort·order). URL key는 제품 계약이다.

## 키트 보장

실제 조립 예: [apps/starter/src/features/products/screens/ProductListScreen.test.tsx](../../references/apps/starter/src/features/products/screens/ProductListScreen.test.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- **URL:**
  - 틀린 필드와 그 묶음만 기본값으로 돌린다. 나머지 유효한 값은 유지한다.
  - 정규 URL이 아니면 replace로 바꾼다. 기본값과 같은 값은 URL에서 뺀다.
- **확정:**
  - `submit`은 추가된 키워드만 사용해 초안을 검증한 뒤 page 1로 확정한다. 정렬·페이지 크기는 지금 값을 유지한다. 초안은 필터 조건이 바뀔 때만 새로 만들어지고, 페이지·크기·정렬만 바뀌면 고치던 초안이 남는다.
  - `periods`로 선언한 기간은 한쪽만·없는 날짜·역순이면 검색할 때 그 쌍만 기본값으로 돌리고 나머지 조건으로 확정한다(주소의 잘못된 값과 같은 규칙). 검색을 막거나 문구를 띄우지 않는다. 입력 UI가 키트 `List.Period`가 아니거나 숨겨져도 지킨다. 검색을 막는 검증은 제품 규칙(`validateDraft`)만 쓴다.
  - 키워드 입력 중 글자는 `keywordInput(name, choices)` 상태에 있고 초안과 수명이 같다(페이지·정렬 이동에는 남고 필터 교체·초기화에는 지워진다). 입력 중 글자는 `submit`·`blockedReason`의 검색 조건에 포함하지 않고 검색 뒤에도 유지한다. `add()`는 입력 하나를, `addMany(texts)`는 여러 값을 한 번의 초안 갱신으로 trim·중복 제거해 추가한다. 같은 이벤트에서 추가 후 `submit`도 최신 칩을 쓴다.
  - 같은 조건이면 재조회하고(진행 중인 요청이 있으면 합류한다), 다르면 URL을 바꾼다. `refresh()`는 선택 수명을 유지한 채 현재 조건을 다시 읽는다.
  - `validateDraft`가 실패하면 입력·URL·결과를 유지하고 새 조회를 하지 않는다.
- **선택지 확인:**
  - 선택지가 올 때까지 조회하지 않는다. 판정은 받은 선택지로 하므로 값만 바뀌면 선택지를 다시 요청하지 않는다.
  - 판정은 지금 상위 조건의 선택지로만 한다. 이전 상위 조건의 늦은 응답은 지금 판정에 들어오지 않는다(A→B→A).
  - 선택지에 없는 값은 버리는 replace를 한 번 한다. 단일 값은 그 필드와 묶음을 기본값으로, 배열은 없는 항목만 빼고 남는 항목이 없으면 기본값으로 한다(고정 목록의 항목 복구와 같은 규칙).
  - 선택지 조회 실패면 URL을 유지하고 조회를 보류하며 `resume`을 제공한다. 같은 선택지 query를 다른 곳(필터의 다시 시도)이 다시 받아도 보류가 풀린다.
  - 기본값도 무효이거나 같은 복구가 반복되면 자동 복구를 멈춘다(`check-stuck`).
- **조회 상태:** `idle`(조회 안 함: 첫 진입 보류·확인 보류, `resume` 있음), `pending`, `failed`, `empty`, `rows`.
- **응답 전체:** 목록 응답에 다른 필드(집계 등)가 함께 있으면 그 타입 그대로 `query`에 주고 `page`로 읽는다. 같은 조회를 따로 다시 읽지 않는다.
- **결과 출처:** `isCurrent`가 false인 행은 이전 조건이거나 사용자 검색 응답 대기 중인 결과다. 읽기용으로 계속 보이고 행·머리글 체크, 일괄 작업과 확인창 실행, 다운로드, `selection.run`을 막는다. 같은 조건의 `submit`도 응답 성공·실패까지 잠그며, 응답 뒤 잠금을 풀고 실패는 기존 실패 안내로 보인다. 창 포커스 등 배경 재조회는 잠그지 않는다. 늦게 도착한 이전 조건 응답은 현재 결과·선택·상태를 덮지 않는다.
- **선택:**
  - 검색을 실행하면 같은 조건이어도 선택을 모두 비운다. 페이지·크기·정렬 변경도 비운다. 배경 재조회에서는 남은 행의 선택을 유지하고 사라진 행만 뺀다. `selectedIds`는 화면 행 순서다.
  - `selection.run`은 시작하는 순간의 ID 집합으로 실행한다. 실행 중 다시 부르면 두 번째 작업은 실행하지 않는다.
  - `run`의 결과는 `{ completedIds }`다. 같은 선택 수명에서 실제 성공 ID만 선택에서 뺀다. 실행 중 같은 조건 검색을 해도 새 수명의 선택에는 이전 실행의 `completedIds`를 적용하지 않는다. 거절은 throw하고 0건 성공은 빈 배열로 돌려준다. Promise resolve만으로 전체 성공을 추측하지 않는다.

- **일괄 결과 불확실:** 서버 반영 여부를 모르는 실패(`RequestFailure.resultUnknown`)면 `selection.run`이 재실행과 선택 변경을 잠근다. 응답 해석을 맡는 소비자도 이미 전송한 결과를 해석할 수 없으면 이 표식을 붙인다. `selection.recover()`는 현재 조건을 다시 조회하고 성공할 때만 잠금을 풀고 선택을 비운다. 조회 실패·검색 변경·확인창 재열기만으로 잠금을 풀지 않는다. 복구 중 조회 문맥이 바뀌면 원래 주소로 돌아와도 이전 완료가 잠금을 풀지 않는다. `BulkAction`·`BulkSelectAction`은 확인 대신 재조회 동작과 안내를 표시한다. 일반 거절은 기존처럼 선택을 유지하고 재시도할 수 있다.

- **다운로드:** `useListDownload(list, { run })`은 누른 순간 대상(`{ kind: 'all', search }` 또는 `{ kind: 'selected', ids, search }`)을 고정해 `run`에 넘긴다. `search`는 마지막으로 확정한 URL 조건이며 입력만 하고 검색하지 않은 초안은 들어가지 않는다. 진행 중 재실행, 이전 조건 결과를 보이는 동안(`isCurrent` 거짓), 선택 0건의 선택 다운로드는 시작하지 않는다(`blockOf`). 실패는 `state`에 남는다. 서버 요청 변환·파일 이름·저장·완료 안내는 `run` 안에서 소비자가 한다.

## registry 목록과 제품 선언

실제 조립 예: [apps/starter/src/features/products/screens/ProductListScreen.tsx](../../references/apps/starter/src/features/products/screens/ProductListScreen.tsx.txt)(flow가 준 model을 배치), [apps/starter/src/features/products/flows/use-product-list.ts](../../references/apps/starter/src/features/products/flows/use-product-list.ts.txt)(`useList`·일괄 작업 실행). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

`/list`의 `<ListProvider model={model}>`를 상태 전달의 기본으로 두고 registry `list`의 표시 wrapper와 부품을 조립한다. 각 부품에 `model` props를 직접 넘기는 방식도 허용하며 명시한 model을 우선한다. 복사본 `<List model={model}>` 안에 `List.Filter`·`FilterActions`·`Detail`·`Text`·`Select`·`MultiSelect`·`Period`·`Keywords`·`Result`·`Table`·`Total`·`PageSize`·`SortSelect`·`Pagination`·`Actions`·`BulkAction`·`BulkSelectAction`·`Download`를 원하는 배치로 둔다. 부품은 context로 같은 상태를 읽으므로 필터를 위·왼쪽으로 옮겨도 조회·정렬·선택 연결을 다시 쓰지 않는다. 프로젝트 입력칸은 `useListField(name)`로 같은 초안에 연결한다.

- `const L = List.of<typeof 검색선언>()`는 같은 실행 구현을 쓰며 검색어·다중 선택·기간의 이름/종류와 문구 누락, 정렬 문구·상세 칸 이름을 타입으로 검사한다. 검색 선언은 `model`의 타입만 import할 수 있다. 기존 `List`는 직접 options를 주는 조립을 계속 지원한다.
- `Period`/`PeriodFilter`의 `timeZone`·`now`는 생략할 수 있고 기본은 브라우저 시간대·호출 순간의 `new Date()`다. 넘기면 그 값을 쓴다. 요청 변환은 프로젝트가 같은 시간대를 명시하여 연결한다. 이 값으로 단축(`value` 이동 또는 `range(today)`)을 계산하고, 지금 기간과 같은 단축은 눌린 상태로 보인다. 보이는 오류 문구는 제품 검증 `validateDraft`가 그 기간의 시작 칸에 낸 문제 하나뿐이다(맞지 않는 기간은 검색할 때 기본값으로 돌아갈 뿐 문구를 띄우지 않는다). 일/월 이동은 달력 기준이며 월말을 보정한다.
- `Keywords`는 `keywordInput` 상태를 표시한다. 키 이벤트 연결은 복사본이 소유하며 패키지 바인딩은 input·items·submit·remove 동작만 제공한다. 기본 복사본은 Enter에 추가 후 검색을 연결하고 IME 조합 중 Enter는 무시한다. 빈 입력·중복 입력도 검색은 실행한다. [추가]는 추가만, [검색]은 검색만 한다. 추가 경로는 `;`로 나눈 조각을 trim하고 빈 조각·기존 중복을 버린다. 프로젝트는 복사본에서 키와 구분 규칙을 바꾼다.
- `MultiSelect`는 `[]`를 제한 없음(전체 체크 표시)으로 쓰고 전부 고르면 `[]`로 접는다. `allLabel`을 주면 "전체" 칸을 둔다. `Select`는 빈 선택을 기본값이 없을 때 undefined로 둔다.
- `Result`는 조회 안 함·로딩·결과 없는 실패(재시도)·빈 결과를 그리고, 이전 결과를 보이는 중 실패하면 원인 · `messages.refreshFailed` 안내와 재시도를 위에 띄운다. 실패 문구는 `List renderFailure(failure, place)`가 고르고 null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 401·403 등).
- 앱 맨 위에 `ListDefaults messages? renderFailure?`를 한 번 두면 모든 목록의 공용 문구·실패 문구가 된다(언어가 바뀌면 새 값으로 다시 그린다). 문구는 키트 기본 → `ListDefaults`(안쪽이 바깥 위) → `<List messages>` 순으로 키별로 덮고, 값이 `undefined`인 키는 덮지 않는다. `renderFailure`는 가까운 단계부터 묻고 `undefined`를 돌려주면 다음 단계(바깥 `ListDefaults` → 키트 기본 문구)로 넘긴다. `null`은 그리지 않고 `''`은 그 단계의 답이다(refresh에서는 원인 없이 안내만). `<List>` 밖에서 `model`을 직접 받은 부품도 앱 기본값을 쓴다.
- `Table`은 컬럼(`key`·`header`·`cell`·`sort`)·선택 칸(`selectable`·`rowLabel`)·행 이동(`onOpen`, 클릭·Enter, 행 안 버튼 제외)을 받는다. 50행부터 보이는 행만 그린다(`@tanstack/react-virtual` peer). 머리글 정렬은 `toggleSort`다. `headerClassName`은 머리글(thead) 표면이며 일반·가상화 표에 똑같이 붙는다. 가상화 중에는 머리글이 스크롤 영역 위에 고정되고(기본 불투명 `bg-background`) 행이 그 밑으로 지나가므로, 배경을 바꾸려면 불투명한 색을 준다. 머리글 색을 바깥 선택자(`[&_thead]:…`)로 칠하지 않는다. `ResultTable`은 `Table`의 다른 이름이다.
- `Total`은 이전 조건 결과를 보이는 동안 '…'이다. `Actions`는 그 동안 안의 쓰기 버튼을 통째로 잠근다.
- `BulkAction`은 registry `dialog`의 `ConfirmDialog`로 확인을 받으므로 앱 맨 위의 `DialogDefaults`가 필요하다([web-kit-form의 앱 기본 문구](../web-kit-form/SKILL.md#앱-기본-문구)). 확인 당시 결과와 선택이 바뀌면 실행하지 않는다. 실패는 확인창에 남고 선택은 유지된다. 성공 ID 해석·업무 거절 조건은 소비자가 반환한다.
- `BulkSelectAction`은 값 하나를 골라 선택 행에 적용하는 일괄 작업(상태 변경 등)이다. `options`(선택지)·`placeholder`·`selectLabel`·`run(ids, value)`·`check?(ids, value)`·`describe?(ids, value)`를 받고 선택 칸·실행 버튼·확인창을 한 묶음으로 그리며, 이전 조건 결과를 보이는 동안 묶음 전체가 잠긴다. 확인창을 여는 순간의 행 id와 값을 함께 고정해 업무 확인·실행·문구에 쓰고(`useBulkConfirmation`의 `value`), 값 없이 누르면 실행하지 않고 `requiredMessage`(없으면 `messages.chooseValue`)를 보인다. 성공 뒤에도 고른 값은 남는다. 확인 당시 결과·선택 변경 무효화·실패 선택 유지·중복 실행 방지는 `BulkAction`과 같다. 권한·서버 호출·부분 성공 의미는 소비자가 `run`의 반환으로 정한다. 조립 예: [apps/starter/src/features/members/screens/MemberListScreen.tsx](../../references/apps/starter/src/features/members/screens/MemberListScreen.tsx.txt).
- `Download`는 `useListDownload` 결과를 받아 종류 선택·버튼·진행·실패 문구를 그린다.
- 문구는 `ListDefaults`·`messages`, 모양은 프로젝트 shadcn 테마 변수·`className`·좁은 표시 입구(`Table headerClassName`, `Detail triggerClassName`, `BulkSelectAction selectClassName`)·복사본의 Tailwind 클래스로 바꾼다. 표시 입구는 모양만 바꾸고 동작·접근성 연결은 그대로다. 선택 칸(`Select`·기간 기준·검색어 대상·정렬·페이지 크기·다운로드 종류)은 shadcn Select, 체크는 shadcn Checkbox다.
- `captureListReturn`/`resolveListReturn`은 목록 주소의 검색·hash를 보존하고 같은 목록 경로에서만 복귀한다. 앱 안 경로 판정은 루트 `safeAppPath`와 같다([web-kit-http](../web-kit-http/SKILL.md)). 조회 결과 출처(`isCurrent`)와는 다른 책임이다.

특수 표현은 루트의 `checkboxTreeSelection`·`validateDateRange`, `/list`의 `activateTableRow`와 연결 hook, registry `checkbox-tree`·`filter-error`를 사용한다. 서버·권한·업무 계산을 공용 UI 안으로 옮기지 않는다.

## 날짜 검색의 절대시각 경계

루트의 `calendarDayBounds(date, timeZone)`는 달력 날짜와 명시한 시간대에서 `start`·`endExclusive`(epoch milliseconds)를 구한다. 공개 타입은 [calendar-day.ts](../../src/calendar-day.ts), 소비 예는 [날짜 경계 검사](../../references/apps/starter/src/shared/lib/calendar-day.test.ts.txt)에 있다. 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- 정상 날짜는 해당 날짜 시작부터 다음 날짜 시작까지다. 자정이 두 번 있으면 첫 발생, 자정이 사라지면 전환 후 첫 유효 순간을 쓴다. 날짜 전체가 없으면 `nonexistent-date`이며 다른 날짜로 바꾸지 않는다.
- 잘못된 달력 날짜는 `invalid-date`, 잘못된/빠진 시간대는 `invalid-time-zone`이다. 반환 실패를 프로젝트 검증·조회 오류 정책에 연결한다. 키트는 실패를 넓은 조회로 바꾸지 않는다.
- 시간대 선택(브라우저/사용자/시설), 표시 형식, 프리셋 목록, 서버 필드명·종료 포함 여부·초/밀리초 정밀도는 프로젝트가 소유한다. 키트 반환값은 서버 전송값이 아니다.
- 달력 이동·월말 보정은 기존 `shiftCalendarDate`, 기간 쌍 검증은 `validateDateRange`를 재사용한다. `endExclusive - 1초` 같은 서버 정책은 계산 함수에 넣지 않는다.

## 확인 방법

실제 조립 예: [apps/starter/src/shared/ui/web-kit/checks/list-ui.test.tsx](../../references/apps/starter/src/shared/ui/web-kit/checks/list-ui.test.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

registry 항목을 채택하면 함께 설치한 검사 연결 파일을 자기 단위·브라우저 CI에서 실행하고 `web-kit-check`를 필수 단계로 둔다. starter 통과로 대신하지 않는다. 실제 사용 UI와 검사 대상의 일치는 별도 검토로 판정한다. 설치·결과 파일 연결은 [소비 안내](../../docs/checking.md)를 따른다.

화면에서 다음을 관찰한다.

- 잘못된 URL 한 필드만 복구되고 다른 값은 유지된다. 기간·고정 목록 값·서버 선택지 값 각각에 없는 값을 넣어 본다.
- 검색할 때 맞지 않는 입력(한쪽만·역순·없는 날짜의 기간, 선택지에 없는 값)은 그 칸만 기본값으로 돌아가고 나머지 조건으로 URL이 바뀌고 요청이 나간다. 검색이 막히는 것은 제품 검증(`validateDraft`)이 실패할 때뿐이며, 그때는 URL·요청이 생기지 않는다.
- 선택지 확인 중에는 요청이 0건이다.
- 이전 결과 행은 선택할 수 없고 총건수는 '…'이다.
- 일괄 작업·다운로드는 누른 순간의 ID·확정 조건으로 실행된다. 입력만 한 필터는 다운로드 요청에 없다.
- 기간 입력칸을 바꾸거나 숨겨도 역순 기간은 그 쌍만 기본값으로 돌아간 채 요청에 들어간다(역순 값은 요청에 없다). 추가하지 않은 키워드는 요청에서 빠지고 입력 칸에 남는다.

최종 URL의 키·값·인코딩은 실제 요청에서 확인한다.

## 이름 있는 부품과 공용 선택

실제 조립 예: [apps/starter/src/features/products/screens/ProductFilters.tsx](../../references/apps/starter/src/features/products/screens/ProductFilters.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

새 화면은 `/list`의 `ListProvider`·`useListModel`·`useListField`와 registry `list`의 `FilterPanel`, `FilterActions`, `TextFilter`, `ChoiceFilter`, `PeriodFilter`, `ListResult`, `ResultTable`, `PageSize`, `Pagination`으로 조립할 수 있다. 복사본의 기존 `List.*` 표기와 같은 상태·구현을 쓴다. `useListFilterBinding`·`useListPeriodBinding`·`useBulkConfirmation` 등 패키지 연결 hook의 반환값을 표현에 연결하며 순서를 다시 구현하지 않는다. 화면은 제목·필터·업무 작업·결과로 읽히도록 나누고 열 선언과 요청 변환은 해당 책임에 둔다.

### 고정 선택지와 서버 선택지 고르기

| 선택지의 출처·표현 | 사용할 칸 | 선언 자리 |
|---|---|---|
| 준비된 평면 목록의 단일·다중 선택 | `List.Select`·`List.MultiSelect` | 화면은 `options`, 검색 필드는 허용값 schema. 이 칸들은 `check`를 구독하지 않는다. |
| 준비된 트리·그룹 또는 표시 모양을 고르는 선택 | `List.Choice`(`ChoiceFilter`) | 화면은 `nodes`, 검색 필드는 허용값 schema |
| 서버 응답으로 표시와 URL 허용값을 함께 확인 | `List.Choice`(`ChoiceFilter`) | 검색 필드의 `check`; 화면은 필드 이름과 문구·표시 설정 |

서버 선택지는 다음 세 자리에 연결한다. 실제 예: [분류 요청](../../references/apps/starter/src/features/products/api/categories.ts.txt) → [상품 검색 선언](../../references/apps/starter/src/features/products/state/product-list-search.ts.txt) → 위 `ProductFilters`의 `categoryId` 칸.

1. feature `api/`에서 선택지 `queryOptions`를 만든다. 요청·응답 변환·query key·취소 signal·캐시 수치는 프로젝트가 소유한다.
2. feature `state/`의 필드 `check`에 그 query를 주는 `options`, 응답에서 저장 가능한 값을 읽는 `allowed`, 표시 이름과 값을 만드는 `tree`를 연결한다. 상위 필터에 따라 선택지가 달라지면 `parents`에 상위 필드 이름을 적고, query key에도 해당 상위 값을 포함한다.
3. 화면의 `ChoiceFilter`는 `name`과 문구·표시 설정을 받는다. 같은 선언을 URL 확인과 칸이 구독하므로, 화면에서 별도 조회·로딩·오류·재시도를 조립하지 않는다. 기존 선택값을 확인하는 동안 목록 조회를 보류하고, 선택지 조회 실패에는 URL을 유지하며 칸의 재시도로 재개한다. 확인할 값이 없으면 목록과 선택지 조회는 함께 시작할 수 있다.

목록 옵션을 받기 위한 기본 `loader`는 두지 않는다. 조회 상태는 목록 flow와 선택지 선언이 소유한다([route 역할](../web-kit-structure/SKILL.md#route-파일)). 진입 시 사전 조회가 필요하다는 근거가 생기면 같은 query 캐시를 쓰는 최적화로 별도 판단하며, 필터 변경·URL 확인의 소유권은 유지한다.

### Choice의 값과 준비 상태

registry `choice`는 `/choice`의 `useChoiceBinding`을 쓴다. 이를 쓰는 `ChoiceFilter`(`List.Choice`)는 단일/다중을 같은 트리로 표현한다. 다중 값은 leaf ID 배열이며 부모는 삼상태다. `appearance`를 바꿔도 값·검색 수명은 같다. 다중이고 필수가 아니며 서버 검색이 아닌 `List.Choice`는 필터 규칙을 따른다: 빈 선택은 제한 없음이라 전체와 모든 선택지가 체크로 보이고, 모두 고르면 `[]`로 접힌다(`listChoiceValue`). 아무것도 체크되지 않은 상태는 없다: 마지막 하나를 해제하거나 전체를 지우는 변경은 무시한다(`commitFilterSelection`). 평면 `MultiSelect`도 같은 규칙이다. 서버 검색(`search`) 모양은 검색 결과를 가지(그룹) 제목과 그룹 체크로 묶어 보이며, 그룹 체크는 지금 보이는 그 그룹의 leaf만 켜고 끈다.

- 직접 준 `nodes`는 준비된 고정 전체 선택지다. 선택지 밖 값은 표시·초안·[검색] 제출에서 정리한다. URL·진입 요청의 허용값은 별도로 검색 필드 schema 또는 `check.allowed`가 맡는다.
- `check`를 쓰면 같은 query의 로딩·실패 중에는 초안을 보존하고 성공 뒤 정리한다. 상위 `check.parents` 값이 바뀌면 하위 초안을 기본값으로 정리한다.
- 서버 `search` 함수가 돌려주는 일부 검색 결과는 전체 선택지가 아니다. 결과 밖 기존 선택을 유지하며, URL의 `check.allowed` 확인·복구 규칙은 그대로 적용한다. 일부 결과를 전체 허용값으로 취급하지 않는다.

검색 필드 `required: { message, when? }`는 필수 별표와 실행 차단의 같은 근거다. `when`은 현재 조건을 받아 조건부 필수를 정하며 `message`는 프로젝트 문구다. 비어 있으면 검색 버튼은 `aria-disabled`와 안내를 보여 키보드로 닿을 수 있고, Enter·직접 submit·URL 진입도 빈 조건으로 요청하지 않는다. 상세 필터 오류가 생기면 상세 구역을 펼친다. 직접 그리는 칸도 `useListField`의 required/value/set/issues를 쓴다.

`Choice`의 단일 선택 해제는 `clearLabel`을 지정했을 때만 제공한다. `placeholder`만으로 해제를 허용하지 않는다. 서버 검색 함수가 다시 만들어져도 진행 중 검색은 유지한다. 검색 범위가 상위 값에 따라 달라지면 `searchKey`에 해당 원시 값 배열을 전달해 이전 검색을 취소하고 다시 조회한다.

즉시 조회와 검색 후 조회, 두 조회 방식의 실제 예는 [즉시 조회 선언](../../references/apps/starter/src/features/products/state/product-list-search.ts.txt)과 [검색 후 조회 선언](../../references/apps/starter/src/features/members/state/member-list-search.ts.txt)의 gated 값 차이로 확인한다. 두 화면 모두 같은 useList와 registry list를 사용한다. 요청 수 관찰은 [회원 화면 검사](../../references/apps/starter/src/features/members/screens/MemberListScreen.test.tsx.txt)에 있다.

선택 설치의 검사 연결은 `/testing/unit/list`를 쓴다. `blocking-progress`도 설치한 경우 registry 연결이 `/testing/unit/combinations`로 실제 덮개 복사본과의 기존 조회 조합 검사를 추가한다. 패키지와 함께 검사 연결 파일·설치 기록을 새 원본에 맞춰 갱신한다.
