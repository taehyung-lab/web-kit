---
name: web-kit-list
description: 목록 화면의 URL 검색 조건·필드 기본값 복구·검색 확정·페이지/정렬·조회 상태·선택지 확인·행 선택·일괄 작업을 만들거나 바꿀 때 읽는다. 단건 상세는 web-kit-record, 요청·실패 해석은 web-kit-http로 보낸다.
---

# web-kit list · search

`/search`의 `defineSearch`, `/list`의 `useList`, `/filter`의 입력 표현을 쓰는 기준이다. 인자와 타입은 설치된 소스를 따른다.

## 화면 선언

- URL 하나에 `defineSearch` 하나를 선언한다.
  - 필드마다 schema와 default를 둔다. schema는 URL 값을 읽는 동기 Standard Schema이고 `.catch`를 붙이지 않는다. default는 제품이 정한 값 그대로다.
  - URL 표현이 값과 다르면(쉼표 목록 등) `encode`로 쓰고 schema로 읽는다.
  - 함께 맞아야 할 필드는 `groups: [{ fields, valid? }]`로 묶는다. 한 필드라도 못 읽거나 `valid`가 거짓이면(역순 기간 등) 묶음 전체가 기본값이 된다.
  - 첫 진입에 조회하지 않는 목록이면 `gated`를 둔다.
  - URL 값은 그 필드가 가질 수 있는 값만 남는다. 고정 목록(유형·상태·정렬 key 등)은 schema를 그 목록(`z.enum`)으로 두고, 서버 선택지에서 고르는 필드는 `check: { options(parents) → 선택지 queryOptions, allowed(data) → 가능한 값 }`을 둔다. 둘 다 아니면(`z.string` 그대로) 없는 값이 요청에 실린다.
  - `check.options`에는 필터 UI가 쓰는 선택지 queryOptions를 그대로 준다. 확인은 그 query의 observer라서 요청·상태를 필터 UI와 함께 쓴다. 상위 필드에 따라 선택지가 바뀌면 `parents`에 적는다.
- route에는 `validateSearch`와 `beforeLoad`를 연결한다. `validateSearch`는 정규 URL 표현을 내고 Router가 그대로 URL로 쓴다. 처음 진입한 주소가 정규형이 아니면(역순 기간·틀린 값·모르는 키) `beforeLoad`가 정규형으로 replace한다. 화면은 `Route.useSearch()`(URL 값)와 navigate를 `useList`에 넘기고, 값으로 읽는 일은 `useList`가 한다.
- `useList`에 넘기는 것: 조회 queryOptions 생성 함수, `rowId`, 필요하면 `selectable`과 `validateDraft`(역순 기간 같은 입력 검증). 선택지 준비 같은 화면 조건은 queryOptions의 `enabled`(boolean)로 주면 목록 조건과 함께 지켜지고, 충족 전에는 `idle`(`not-ready`)이다.
- 입력 초안 모양이 URL 값과 다르면(기간 preset처럼 URL에는 날짜만 있는 화면) `useList({ draft: { from(search) → 초안, to(초안) → 필터 값 } })`로 선언한다. `draft`·`patchDraft`·`validateDraft`는 그 초안 모양을 쓴다.
- 페이지·크기·정렬 필드 이름은 `defineSearch({ view: { size: 'pageSize', … } })`로 선언한다(기본 page·size·sort·order). URL key는 제품 계약이다.

## 키트 보장

- **URL:**
  - 틀린 필드와 그 묶음만 기본값으로 돌린다. 나머지 유효한 값은 유지한다.
  - 정규 URL이 아니면 replace로 바꾼다. 기본값과 같은 값은 URL에서 뺀다.
- **확정:**
  - `submit`은 초안을 검증한 뒤 page 1로 확정한다. 초안은 필터 조건이 바뀔 때만 새로 만들어지고, 페이지·크기·정렬만 바뀌면 고치던 초안이 남는다.
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
- **결과 출처:** `isCurrent`가 false인 행은 이전 조건의 결과다. 읽기용으로만 보이고 선택·쓰기 대상으로 내보내지 않는다.
- **선택:**
  - 검색이 바뀌면 선택을 비운다. 사라진 행은 선택에서 뺀다.
  - `selection.run`은 시작하는 순간의 ID 집합으로 실행한다. 실행 중 다시 부르면 두 번째 작업은 실행하지 않는다.
  - 성공 뒤 선택 정리는 같은 선택 수명일 때만 한다.

## 프로젝트 연결

- 필터 UI(기간 preset, 키워드 행)와 검색어 문구는 프로젝트가 맡는다.
- 표·가상화·정렬 표현은 프로젝트 vendor로 그린다.
- `FilterError`의 id는 입력의 aria-describedby에 연결한다.
- `CheckboxTree`에는 프로젝트 checkbox를 넘긴다.
- 행 클릭은 `activateTableRow`에 연결한다.
- 부분 성공의 의미와 일괄 작업 문구는 프로젝트가 정한다.

## 확인 방법

화면에서 다음을 관찰한다.

- 잘못된 URL 한 필드만 복구되고 다른 값은 유지된다. 기간·고정 목록 값·서버 선택지 값 각각에 없는 값을 넣어 본다.
- 잘못된 입력이면 URL과 요청이 생기지 않는다.
- 선택지 확인 중에는 요청이 0건이다.
- 이전 결과 행은 선택할 수 없다.
- 일괄 작업은 고정한 ID로 실행된다.

최종 URL의 키·값·인코딩은 실제 요청에서 확인한다.
