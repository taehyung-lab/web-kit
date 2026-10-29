---
name: web-kit-list
description: 목록 필터·기간 프리셋·키워드 칩·표·페이지 이동·URL 검색 조건·필드 기본값 복구·검색 확정·페이지/정렬·조회 상태·선택지 확인·행 선택·일괄 작업·엑셀 다운로드 흐름을 만들거나 바꿀 때 읽는다. 권한 판정 연결은 web-kit-permission, 단건 상세는 web-kit-record, 요청·실패 해석은 web-kit-http로 보낸다.
---

# web-kit list · search

`/search`의 `defineSearch`, `/list`의 `useList`·`useListDownload`·`ListProvider`와 registry `list` 항목의 목록 복사본을 쓰는 기준이다. registry는 프로젝트에 설치해 소유하는 UI 원본 묶음이다. 공통 상태와 이벤트 순서는 패키지 hook이 맡는다. 인자와 타입은 설치된 소스를 따른다.

이 책임만 골라 사용할 수 있다. 선택한 한 책임 안에서는 키트 수명 처리와 자체 구현을 섞지 않는다. 선택 설치 peer(해당 기능을 쓸 때만 설치하는 동료 라이브러리)를 설치하지 않아 실행하지 못한 기능은 "검사하지 않음"으로 기록한다. 예시는 같은 버전 저장소의 파일이며 설치본 node_modules 안의 파일이 아니다.

## 화면 선언

실제 조립 예: [apps/starter/src/features/members/model/list-search.ts](../../../../apps/starter/src/features/members/model/list-search.ts). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- URL 하나에 `defineSearch` 하나를 선언한다.
  - 필드마다 schema와 default를 둔다. schema는 URL 값을 읽는 동기 Standard Schema이고 `.catch`를 붙이지 않는다. default는 제품이 정한 값 그대로다.
  - URL 표현이 값과 다르면(쉼표 목록 등) `encode`로 쓰고 schema로 읽는다.
  - 함께 맞아야 할 필드는 `groups: [{ fields, valid? }]`로 묶는다. 한 필드라도 못 읽거나 `valid`가 거짓이면(역순 기간 등) 묶음 전체가 기본값이 된다.
  - 조회 시작 조건은 화면 값이다: 들어오면 바로 조회(기본) / 필수 조건이 채워지면 조회(queryOptions `enabled`) / 검색을 눌러야 조회(`gated`).
  - 처음 누른 머리글의 정렬 방향은 `sortFirst`('asc'·'desc'·'current', 생략 시 지금 방향 유지)로 선언한다.
  - URL 값은 그 필드가 가질 수 있는 값만 남는다. 고정 목록(유형·상태·정렬 key 등)은 schema를 그 목록(`z.enum`)으로 두고, 서버 선택지에서 고르는 필드는 `check: { options(parents) → 선택지 queryOptions, allowed(data) → 가능한 값 }`을 둔다. 둘 다 아니면(`z.string` 그대로) 없는 값이 요청에 실린다.
  - `check.options`에는 필터 UI가 쓰는 선택지 queryOptions를 그대로 준다. 확인은 그 query의 observer라서 요청·상태를 필터 UI와 함께 쓴다. 상위 필드에 따라 선택지가 바뀌면 `parents`에 적는다.
- route에는 `validateSearch`와 `beforeLoad`를 연결한다. `validateSearch`는 정규 URL 표현을 내고 Router가 그대로 URL로 쓴다. 처음 진입한 주소가 정규형이 아니면(역순 기간·틀린 값·모르는 키) `beforeLoad`가 정규형으로 replace한다. 화면은 `Route.useSearch()`(URL 값)와 navigate를 `useList`에 넘기고, 값으로 읽는 일은 `useList`가 한다.
- `useList`에 넘기는 것: 조회 queryOptions 생성 함수, `rowId`, 필요하면 `selectable`, 직접 입력 기간 쌍 `periods: [[시작, 끝]]`, 제품 검증 `validateDraft`(기간 한도 등). 선택지 준비 같은 화면 조건은 queryOptions의 `enabled`(boolean)로 주면 목록 조건과 함께 지켜지고, 충족 전에는 `idle`(`not-ready`)이다.
- 페이지의 주 목록이면 `useList({ progress: 'page' })`로 선언한다. 보여 줄 결과가 아직 없고 조회(주소 값 확인 조회 포함) 중인 동안만 앱 셸의 화면 전체 진행 덮개(registry `blocking-progress`의 `BlockingProgress`와 `/dialog` 연결 hook, web-kit-form 「화면 전체 진행 덮개」)가 덮는다. 검색·정렬·페이지 이동은 이전 결과를 보인 채 조회하므로 덮지 않는다. 대화창 안 목록은 선언하지 않는다.
- 입력 초안 모양이 URL 값과 다르면(기간 preset처럼 URL에는 날짜만 있는 화면) `useList({ draft: { from(search) → 초안, to(초안) → 필터 값 } })`로 선언한다. `draft`·`patchDraft`·`validateDraft`는 그 초안 모양을 쓴다.
- 페이지·크기·정렬 필드 이름은 `defineSearch({ view: { size: 'pageSize', … } })`로 선언한다(기본 page·size·sort·order). URL key는 제품 계약이다.

## 키트 보장

실제 조립 예: [apps/starter/src/features/products/screens/ProductListScreen.test.tsx](../../../../apps/starter/src/features/products/screens/ProductListScreen.test.tsx). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- **URL:**
  - 틀린 필드와 그 묶음만 기본값으로 돌린다. 나머지 유효한 값은 유지한다.
  - 정규 URL이 아니면 replace로 바꾼다. 기본값과 같은 값은 URL에서 뺀다.
- **확정:**
  - `submit`은 입력 중 키워드를 합치고 초안을 검증한 뒤 page 1로 확정한다. 정렬·페이지 크기는 지금 값을 유지한다. 초안은 필터 조건이 바뀔 때만 새로 만들어지고, 페이지·크기·정렬만 바뀌면 고치던 초안이 남는다.
  - `periods`로 선언한 기간은 한쪽만·없는 날짜·역순이면 검색할 때 그 쌍만 기본값으로 돌리고 나머지 조건으로 확정한다(주소의 잘못된 값과 같은 규칙, 0003 §5). 검색을 막거나 문구를 띄우지 않는다. 입력 UI가 키트 `List.Period`가 아니거나 숨겨져도 지킨다. 검색을 막는 검증은 제품 규칙(`validateDraft`)만 쓴다.
  - 키워드 입력 중 글자는 `keywordInput(name, choices)` 상태에 있고 초안과 수명이 같다(페이지·정렬 이동에는 남고 필터 교체·초기화에는 지워진다). 추가를 누르지 않아도 `submit`이 trim·중복 제거해 합친다.
  - 같은 조건이면 재조회하고(진행 중인 요청이 있으면 합류한다), 다르면 URL을 바꾼다. `refresh()`도 같다.
  - `validateDraft`가 실패하면 입력·URL·결과를 유지하고 새 조회를 하지 않는다.
- **선택지 확인:**
  - 선택지가 올 때까지 조회하지 않는다. 판정은 받은 선택지로 하므로 값만 바뀌면 선택지를 다시 요청하지 않는다.
  - 판정은 지금 상위 조건의 선택지로만 한다. 이전 상위 조건의 늦은 응답은 지금 판정에 들어오지 않는다(A→B→A).
  - 선택지에 없는 값은 버리는 replace를 한 번 한다. 단일 값은 그 필드와 묶음을 기본값으로, 배열은 없는 항목만 빼고 남는 항목이 없으면 기본값으로 한다(고정 목록의 항목 복구와 같은 규칙).
  - 선택지 조회 실패면 URL을 유지하고 조회를 보류하며 `resume`을 제공한다. 같은 선택지 query를 다른 곳(필터의 다시 시도)이 다시 받아도 보류가 풀린다.
  - 기본값도 무효이거나 같은 복구가 반복되면 자동 복구를 멈춘다(`check-stuck`).
- **조회 상태:** `idle`(조회 안 함: 첫 진입 보류·확인 보류, `resume` 있음), `pending`, `failed`, `empty`, `rows`.
- **응답 전체:** 목록 응답에 다른 필드(집계 등)가 함께 있으면 그 타입 그대로 `query`에 주고 `page`로 읽는다. 같은 조회를 따로 다시 읽지 않는다.
- **결과 출처:** `isCurrent`가 false인 행은 이전 조건의 결과다. 읽기용으로만 보이고 선택·쓰기 대상으로 내보내지 않는다. 늦게 도착한 이전 조건 응답은 현재 결과·선택·상태를 덮지 않는다.
- **선택:**
  - 검색·페이지·크기·정렬이 바뀌면 선택을 비운다. 같은 조건 재조회에서 사라진 행은 선택에서 뺀다. `selectedIds`는 화면 행 순서다.
  - `selection.run`은 시작하는 순간의 ID 집합으로 실행한다. 실행 중 다시 부르면 두 번째 작업은 실행하지 않는다.
  - `run`의 결과는 `{ completedIds }`다. 같은 선택 수명에서 실제 성공 ID만 선택에서 뺀다. 거절은 throw하고 0건 성공은 빈 배열로 돌려준다. Promise resolve만으로 전체 성공을 추측하지 않는다.

- **다운로드:** `useListDownload(list, { run })`은 누른 순간 대상(`{ kind: 'all', search }` 또는 `{ kind: 'selected', ids, search }`)을 고정해 `run`에 넘긴다. `search`는 마지막으로 확정한 URL 조건이며 입력만 하고 검색하지 않은 초안은 들어가지 않는다. 진행 중 재실행, 이전 조건 결과를 보이는 동안(`isCurrent` 거짓), 선택 0건의 선택 다운로드는 시작하지 않는다(`blockOf`). 실패는 `state`에 남는다. 서버 요청 변환·파일 이름·저장·완료 안내는 `run` 안에서 소비자가 한다.

## registry 목록과 제품 선언

실제 조립 예: [apps/starter/src/features/products/screens/ProductListScreen.tsx](../../../../apps/starter/src/features/products/screens/ProductListScreen.tsx). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

`/list`의 `<ListProvider model={model}>`를 상태 전달의 기본으로 두고 registry `list`의 표시 wrapper와 부품을 조립한다. 각 부품에 `model` props를 직접 넘기는 방식도 허용하며 명시한 model을 우선한다. 복사본 `<List model={model}>` 안에 `List.Filter`·`FilterActions`·`Detail`·`Text`·`Select`·`MultiSelect`·`Period`·`Keywords`·`Result`·`Table`·`Total`·`PageSize`·`SortSelect`·`Pagination`·`Actions`·`BulkAction`·`Download`를 원하는 배치로 둔다. 부품은 context로 같은 상태를 읽으므로 필터를 위·왼쪽으로 옮겨도 조회·정렬·선택 연결을 다시 쓰지 않는다. 프로젝트 입력칸은 `useListField(name)`로 같은 초안에 연결한다.

- `Period`/`PeriodFilter`의 `timeZone`·`now`는 생략할 수 있고 기본은 브라우저 시간대·호출 순간의 `new Date()`다. 넘기면 그 값을 쓰며 요청 날짜 변환도 같은 시간대를 쓴다. 이 값으로 단축(`value` 이동 또는 `range(today)`)을 계산하고, 지금 기간과 같은 단축은 눌린 상태로 보인다. 보이는 오류 문구는 제품 검증 `validateDraft`가 그 기간의 시작 칸에 낸 문제 하나뿐이다(맞지 않는 기간은 검색할 때 기본값으로 돌아갈 뿐 문구를 띄우지 않는다). 일/월 이동은 달력 기준이며 월말을 보정한다.
- `Keywords`는 `keywordInput` 상태를 표시한다. Enter·추가·검색이 같은 정규화를 쓴다. 검색어 칸의 Enter는 [추가]이고 검색(필터 제출)은 하지 않는다(1.5 검색어 입력과 같다).
- `MultiSelect`는 `[]`를 제한 없음(전체 체크 표시)으로 쓰고 전부 고르면 `[]`로 접는다. `allLabel`을 주면 "전체" 칸을 둔다. `Select`는 빈 선택을 기본값이 없을 때 undefined로 둔다.
- `Result`는 조회 안 함·로딩·결과 없는 실패(재시도)·빈 결과를 그리고, 이전 결과를 보이는 중 실패하면 원인 · `messages.refreshFailed` 안내와 재시도를 위에 띄운다. 실패 문구는 `List renderFailure(failure, place)`가 고르고 null이면 그 자리에 아무것도 그리지 않는다(앱 경계가 이미 알린 401·403 등).
- `Table`은 컬럼(`key`·`header`·`cell`·`sort`)·선택 칸(`selectable`·`rowLabel`)·행 이동(`onOpen`, 클릭·Enter, 행 안 버튼 제외)을 받는다. 50행부터 보이는 행만 그린다(`@tanstack/react-virtual` peer). 머리글 정렬은 `toggleSort`다.
- `Total`은 이전 조건 결과를 보이는 동안 '…'이다. `Actions`는 그 동안 안의 쓰기 버튼을 통째로 잠근다.
- `BulkAction`은 확인 당시 결과와 선택이 바뀌면 실행하지 않는다. 실패는 확인창에 남고 선택은 유지된다. 성공 ID 해석·업무 거절 조건은 소비자가 반환한다.
- `Download`는 `useListDownload` 결과를 받아 종류 선택·버튼·진행·실패 문구를 그린다.
- 문구는 `messages`, 모양은 `styles.css`의 `--wk-*` 토큰과 `className`으로 바꾼다.
- `captureListReturn`/`resolveListReturn`은 목록 주소의 검색·hash를 보존하고 같은 목록 경로에서만 복귀한다. 조회 결과 출처(`isCurrent`)와는 다른 책임이다.

특수 표현은 루트의 `checkboxTreeSelection`·`validateDateRange`, `/list`의 `activateTableRow`와 연결 hook, registry `checkbox-tree`·`filter-error`를 사용한다. 서버·권한·업무 계산을 공용 UI 안으로 옮기지 않는다.

## 확인 방법

실제 조립 예: [apps/starter/src/shared/ui/web-kit/checks/list-ui.test.tsx](../../../../apps/starter/src/shared/ui/web-kit/checks/list-ui.test.tsx). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

registry 항목을 채택하면 함께 설치한 검사 연결 파일을 자기 단위·브라우저 CI에서 실행하고 `web-kit-check`를 필수 단계로 둔다. starter 통과로 대신하지 않는다. 실제 사용 UI와 검사 대상의 일치는 별도 검토로 판정한다. 설치·결과 파일 연결은 [소비 안내](../../docs/consuming.md#복사본-적합성-검사)를 따른다.

화면에서 다음을 관찰한다.

- 잘못된 URL 한 필드만 복구되고 다른 값은 유지된다. 기간·고정 목록 값·서버 선택지 값 각각에 없는 값을 넣어 본다.
- 검색할 때 맞지 않는 입력(한쪽만·역순·없는 날짜의 기간, 선택지에 없는 값)은 그 칸만 기본값으로 돌아가고 나머지 조건으로 URL이 바뀌고 요청이 나간다. 검색이 막히는 것은 제품 검증(`validateDraft`)이 실패할 때뿐이며, 그때는 URL·요청이 생기지 않는다.
- 선택지 확인 중에는 요청이 0건이다.
- 이전 결과 행은 선택할 수 없고 총건수는 '…'이다.
- 일괄 작업·다운로드는 누른 순간의 ID·확정 조건으로 실행된다. 입력만 한 필터는 다운로드 요청에 없다.
- 기간 입력칸을 바꾸거나 숨겨도 역순 기간은 그 쌍만 기본값으로 돌아간 채 요청에 들어간다(역순 값은 요청에 없다). 추가하지 않은 키워드가 요청에 들어간다.

최종 URL의 키·값·인코딩은 실제 요청에서 확인한다.

## 이름 있는 부품과 공용 선택

실제 조립 예: [apps/starter/src/features/products/screens/ProductFilters.tsx](../../../../apps/starter/src/features/products/screens/ProductFilters.tsx). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

새 화면은 `/list`의 `ListProvider`·`useListModel`·`useListField`와 registry `list`의 `FilterPanel`, `FilterActions`, `TextFilter`, `ChoiceFilter`, `PeriodFilter`, `ListResult`, `ResultTable`, `PageSize`, `Pagination`으로 조립할 수 있다. 복사본의 기존 `List.*` 표기와 같은 상태·구현을 쓴다. `useListFilterBinding`·`useListPeriodBinding`·`useBulkConfirmation` 등 패키지 연결 hook의 반환값을 표현에 연결하며 순서를 다시 구현하지 않는다. 화면은 제목·필터·업무 작업·결과로 읽히도록 나누고 열 선언과 요청 변환은 해당 책임에 둔다.

registry `choice`는 `/choice`의 `useChoiceBinding`을 쓴다. 이를 쓰는 `ChoiceFilter`(`List.Choice`)는 단일/다중을 같은 트리로 표현한다. 다중 값은 leaf ID 배열이며 부모는 삼상태다. `appearance`를 바꿔도 값·검색 수명은 같다. 선택지 조회는 검색 필드 `check.options`와 표시 트리 `check.tree`에 선언한다. 칸은 그 선언을 구독하며 URL 확인과 요청을 공유한다. 상위 `check.parents` 값이 바뀌면 하위 초안을 기본값으로 정리한다.

검색 필드 `required: { message, when? }`는 필수 별표와 실행 차단의 같은 근거다. `when`은 현재 조건을 받아 조건부 필수를 정하며 `message`는 프로젝트 문구다. 비어 있으면 검색 버튼은 `aria-disabled`와 안내를 보여 키보드로 닿을 수 있고, Enter·직접 submit·URL 진입도 빈 조건으로 요청하지 않는다. 상세 필터 오류가 생기면 상세 구역을 펼친다. 직접 그리는 칸도 `useListField`의 required/value/set/issues를 쓴다.

`Choice`의 단일 선택 해제는 `clearLabel`을 지정했을 때만 제공한다. `placeholder`만으로 해제를 허용하지 않는다. 서버 검색 함수가 다시 만들어져도 진행 중 검색은 유지한다. 검색 범위가 상위 값에 따라 달라지면 `searchKey`에 해당 원시 값 배열을 전달해 이전 검색을 취소하고 다시 조회한다.

0003 완료 기준 6의 두 조회 방식은 [즉시 조회 선언](../../../../apps/starter/src/features/products/model/list-search.ts)과 [검색 후 조회 선언](../../../../apps/starter/src/features/members/model/list-search.ts)의 gated 값 차이로 확인한다. 두 화면 모두 같은 useList와 registry list를 사용한다. 요청 수 관찰은 [회원 화면 검사](../../../../apps/starter/src/features/members/screens/MemberListScreen.test.tsx)에 있다.
