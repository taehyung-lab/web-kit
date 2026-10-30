# 0005. 목록·필터·표·다운로드·권한 틀: 검색 직전 보장은 상태가, 배치는 부품 묶음이 맡는다

- 상태: 채택 (2026-10-27, 3.0 4단계 구현)
- 관련 결정: [0003](0003-web-kit-3-redesign.md) §3 공용 책임, §4 구조 규칙, §5 목록 표준. 보장 내용의 정본은 `packages/web-kit/skills/web-kit-list`·`web-kit-permission`이며 여기에는 결정·이유·출처만 둔다.
- 근거 자료: DT v2 공연 목록(`apps/admin/src/features/performances/screens/performance-list`)과 DT 공용(`shared/ui/list/*`·`shared/ui/filter/*`·`shared/lib/list/use-app-list.ts`·`app/permissions/*`), 레퍼런스 회원 목록(`src/features/members/screens/member-list`)과 공용(`src/shared/lib/search-fields.ts`·`use-period-draft.ts`·`use-page-row-selection.ts`·`src/shared/ui/list/*`), web-kit 2.0 `list-ui.tsx`.

이 표는 3.0 당시 비교·선택의 근거다. `/list/ui` 등 당시 UI 입구는 현재 사용법이 아니며 4.0의 [0011](0011-web-kit-4-ui-distribution.md)이 배포 방식을 대체했다. 현재 적용은 배포 스킬·공개 타입을 따른다.

## 결정

| 항목 | DT v2 | 레퍼런스 | web-kit 2.0 | 고른 것과 이유 |
|---|---|---|---|---|
| 기간 검증·입력 중 키워드 | 화면(`Filters.tsx`)이 검색 직전 `withPendingKeyword`로 합침. 기간 검증은 URL 묶음 규칙과 `PeriodField` | `use-period-draft` 훅이 화면마다 초안 보유 | UI 부품 안의 binding(`prepare`)이 검증·합침 | **상태(`useList`)가 소유**: `periods` 선언과 `keywordInput` 상태. 맞지 않는 기간은 검색을 막지 않고 그 쌍만 기본값으로 돌린다(2026-10-28 사용자 확인; 현재 보장은 web-kit-list). 세 방식 모두 입력칸을 바꾸거나 숨기면 보장이 사라졌다(0003 반례 2개). 상태에 두면 부품 교체와 무관하다 |
| 정렬 첫 방향 | `header-sort`의 `toggleSort`가 새 열은 desc | 화면마다 다름 | `nextSort`가 현재 방향 유지로 고정 | **`defineSearch({ sortFirst })` 값**. 0003 §5가 화면 값으로 정했다. 생략 시 2.0 동작이라 기존 소비자가 바뀌지 않는다 |
| 목록 UI 조립 | `ListResult`(상태·액션 잠금)+`DataTable`(TanStack Table)+필터 부품 9종, 화면이 props로 연결 | `PagedListResult`·`DataTable`·`primitives` adapter, 1개 목록이 8~13 파일 | `ListView` render prop 하나에 typed parts | **`<List model>` + `List.*` 부품(context)**. 위치를 바꿔도 연결을 다시 쓰지 않는다(0003 반례 "배치·CSS만 바꿨는데 조립을 다시 쓴다"). render prop은 배치가 한 함수 안에 갇혔고, props 연결은 화면마다 같은 배선을 반복했다 |
| 표 | TanStack Table v9 + 50행부터 가상화 | 높이 제한만 | 단순 table | **키트 단순 table + `@tanstack/react-virtual`(optional peer) 가상화**. 컬럼 정의는 `key·header·cell·sort`면 충분했고 TanStack Table을 peer로 늘릴 이유가 없었다. 가상화는 DT 기존 보장이라 유지 |
| 체크박스 | 네이티브 input | primitives adapter | 네이티브 input | **Base UI Checkbox**(0003의 shadcn+Base UI 바탕). 일부 선택(indeterminate)을 속성으로 다룬다 |
| 실패 문구 | `errorCopyKey`·앱 경계 판정을 `ListResult`가 직접 import | 화면별 | `messages` 고정 문구 | **`renderFailure(failure, place)`**. 키트는 자리(결과·이전 결과·쓰기·다운로드)만 알고, 프로젝트가 문구와 "그리지 않음(null)"을 정한다. 앱 경계(401·403) 판정이 프로젝트 것이어서다 |
| 다운로드 | 화면이 `downloadFile`로 저장, 대상은 렌더 시점의 확정 검색 | `useMemberDownload` 훅이 화면별 | 없음 | **`useListDownload`가 누른 순간의 대상(확정 URL 조건·선택 ID)을 고정**하고 진행·실패·차단을 맡는다. 서버 요청 변환·파일명·저장·암호 안내는 프로젝트 `run`. 입력만 한 필터가 들어가지 않는 근거는 대상이 URL 값이라는 점이다 |
| 권한 | `app/permissions`의 evaluator·route-guard(자체 거부 오류)·`filter-navigation` | 없음 | 없음 | **`/permission`: 닫힘 기본 판정(`isAllowed`)·`assertAllowed`·`filterAllowed`·`useAllowed`·`Allowed`**. DT의 판정 틀은 권한 목록과 무관한 공통이라 키트로, 권한 목록·서버 prefix 대응·메뉴 ID 기록은 DT에 남겼다. 불러오는 중·실패 상태를 키트가 받는 이유는 권한을 비동기로 받는 프로젝트에서 "잠깐 열림"을 막기 위해서다(DT는 동기라 늘 ready) |

## 의존 방향

- `/list`·`/list/ui`·`/form`은 `/permission`과 세션 타이머를 import하지 않는다(`tests/core-boundary.test.ts`). 화면이 판정 결과를 `selectable`·버튼 표시로 넘긴다.
- `/list/ui`는 `/list`의 상태 모양만 읽고, 상태(`use-list.ts`)는 UI를 import하지 않는다.

## 소비 프로젝트의 이행 책임

프로젝트별 교체 화면·남겨 둔 부품·삭제 시점은 소비 프로젝트의 결정 기록에서 관리한다. 공용 패키지에는 해당 프로젝트의 경로·업무 값·화면 배치를 기준으로 넣지 않는다. 기존 구현 비교는 위 근거 표에만 남긴다.

## 검토한 대안

| 대안 | 판단 |
|---|---|
| 검증·키워드 합치기를 UI 부품에 둔 채 "부품을 바꾸면 같은 검증을 다시 연결하라"고 문서화 | 0003 반례 그대로다. 문서로 막을 수 없다 |
| TanStack Table을 키트 표의 바탕으로 | 정렬·선택·상태는 이미 `useList`가 소유해 Table의 기능을 쓰지 않는다. peer만 는다 |
| 권한을 `List`에 속성으로(`permission="download"`) | 목록이 권한 저장소를 알게 된다(0003 §4 금지). 판정 결과만 넘긴다 |
| 다운로드 대상을 렌더 시점 값으로 | 진행 중 선택·조건을 바꾸면 요청이 달라질 수 있다. 누른 순간 고정이 사용자 기대와 맞다 |
