# 공용 책임과 공개 입구

## 구조

목록의 결과 출처와 목록 복귀 문맥은 [용어](../GLOSSARY.md)에서 구분한다.

- **core**(루트 `.`): 외부 상태나 실행 없이 입력만으로 결과를 정하는 순수 규칙이다(실패 12종 해석, 시간대별 날짜 경계·기간 검증, 체크 트리 선택, query 직렬화). `tests/core-boundary.test.ts`는 루트에서 따라가는 파일에 라이브러리 의존이 없는지만 검사한다. 순수한지는 이 정의와 검토로 판단한다. `session`처럼 라이브러리에 의존하지 않아도 실행·부수효과가 있는 코드는 core가 아니며, 자기 subpath로 공개한다.
- **책임별 입구(subpath)**: `/list`·`/form`처럼 책임별 상태·hook·Provider를 공개한다. 이름을 새로 만들 때는 [공개 입구 판단](../references/docs/decisions/0002-distribution.md)를 따른다.
- **registry 복사본**: 원본은 `packages/ui-registry/src`, 정의는 루트 `registry.json`, 빌드 결과는 `public/r`에 있다. 폼·필터·표·상세 등 표현을 소비 프로젝트에 설치한다. 공통 처리 순서는 패키지가 끝내고 복사본은 반환된 ref·속성·이벤트를 연결한다. 제품 실행 코드는 registry를 import하지 않는다.
- **skills**: module별 사용 기준이다. 코드와 같은 버전으로 배포한다.

| import | 키트가 보장하는 것 | 프로젝트가 넘기는 것 |
|---|---|---|
| `/failure` | 실패 12종, 결과 코드 표, 봉투 해석, 인증 거절 판정(`RequestFailure.rejectsAuthentication`) | 서버 enum의 결과 코드 행 |
| `.`(루트) | 앱 안 이동 주소 판정(`safeAppPath`), 날짜·기간·트리 선택 같은 순수 계산 | 이동에서 제외할 경로 |
| `/session` | 세대, 시작·종료와 종료 순서(정리 → 안내 → 서버 로그아웃), 다른 탭 변경, 재발급 단일 비행(Web Locks), 재발급 응답 전용 종료 표 적용 | 저장 adapter·재발급·서버 로그아웃 호출, 선택 재발급 종료 표(`reissueEnd`) |
| `/session/idle` | 서버 시계·HTTP `Date` 시계 차이(`clockOffsetFromDate`)·세션별 마감·탭 병합·만료·멈춤/재개 장치 | 명시 마감·0초 필수 선택·선택 활동 부착과 간격·선택 재개 유예·경고 UI([web-kit-http](../skills/web-kit-http/SKILL.md)) |
| `/auth` + registry `auth` | 코드 기한·종류별 단일 요청·늦은 응답 격리, 입력 오류·만료·재전송 표현 | 공유 시계·기한·자리수·서버 요청·성공 처리·문구 |
| `/session/browser` | 브라우저 저장 장애 복구·외부 이벤트 판별·해제 | 저장 key·동기 schema·읽기 불가 정책 |
| `/http` | 헤더·토큰, 필수 응답 계약·선택 Spring 해석, 401 재발급 뒤 한 번 재전송, 반영 여부 판정 | 응답 해석·코드 의미·공개 경로·운영 헤더·axios 기본값 |
| `/query` | 재시도 대상, 실패 알림 한 번, 선언한 무효화, 민감한 쓰기의 입력값 기록 지움, 세션 전환 시 비움 | 재시도 횟수, 알림 표시, staleTime 등 수치 |
| `/search` · `/list` | URL 검색 상태·검색 확정·선택 수명([web-kit-list](../skills/web-kit-list/SKILL.md)) | 목록 검색 정책(주소 키·표현·보기 수·미추가 검색어·기간 진입 규칙)과 칸 종류 값, 또는 필드 schema·encode·기본값, 조회 시작 조건, 조회 함수, 다운로드 요청 |
| `/list` + registry `list` | `ListProvider`·`useListModel`과 필터·기간·키워드·표·페이지·일괄 확인·다운로드 연결 hook | model, 필드·컬럼·배치·문구·실패 표현 |
| `/permission` | 진입 거부·메뉴 숨김·버튼 비활성의 닫힘 기본 판정 | 권한 상태·판정 함수·권한 목록 |
| 루트 `calendarDayBounds` | 명시한 날짜·시간대의 시작/다음 날 시작, 입력 오류·없는 날짜 구별 | 시간대 선택·표시·서버 종료 정밀도·실패 연결 |
| 루트 + registry `checkbox-tree`·`filter-error` | 순수 기간·트리 계산과 오류/트리 표현 연결 | checkbox·문구·스타일 |
| `/form` · `/dialog` + registry `form`·`dialog` | 제출·확인·저장·기준선·오류·늦은 결과·이탈의 hook/Provider; 복사본 Form·FormGuard·Dialog | schema·원본·저장·완료 동작·배치·문구 |
| `/record` + registry `record`·`retry` | 단건 상태·갱신 실패·재시도 focus·마스킹; 복사본 Detail·항목·이력 | queryOptions·항목·노출 정책·실패 문구 |
| `/choice` · `/dialog` + registry `choice`·`dialog`·`pending`·`blocking-progress`(기본 부품은 shadcn base-nova, 검사 연결 `inputs`) | 공통 선택·검색·대화창 포커스·진행 등록 hook과 기본 부품 조합 | 값·문구·셸 배치·업무 행동·테마 |
| `/api` | Spring query 직렬화 | 적용 endpoint |
| `/testing` · `/testing/unit`(기능별 하위 입구 포함) · `/testing/browser` · `/testing/fixtures` | adapter 검사, 복사본 단위·브라우저 적합성 기준·검사 화면 | 실제 복사본·연결 파일·실행 대상 버전 |
| `/structure`(개발 도구) · bin `web-kit-structure`·`web-kit-new` | 실제 import 대상을 해소한 구조 역할 판정(ESLint 규칙), 구조 결과, 완료를 만들지 않는 화면 골격 | `web-kit.structure.json`의 경로·별칭·생성 코드·예외. 선택 peer `eslint`·`typescript`·`typescript-eslint` |
| `/testing/session` | 저장 실패·다른 탭 변경·종료의 adapter 검사(React/Form import 없음) | 자기 저장 adapter와 격리된 검사 환경 |

### 선택 규칙(전체·부모·자식·빈 선택)을 쓰려면

같은 값 모델(저장하는 것은 맨 아래 leaf 값 목록, 부모·전체 표시는 계산)을 UI마다 다른 의미로 쓴다. 필터의 빈 선택=전체와 폼의 명시 선택은 합치지 않는다([결정 0006](../references/docs/decisions/0006-list-choice-permission.md)).

| 하려는 일 | import | registry 항목 |
|---|---|---|
| 체크 트리: 전체·부모 삼상태·자식 (명시 선택) | 루트 `checkboxTreeSelection`·`treeLeaves` | `checkbox-tree` 또는 `choice` |
| 선택지 일부만 보일 때(서버 검색) 한 그룹 토글, 다른 선택 보존 | 루트 `toggleWithin` | `choice`(검색 모양) |
| 목록 필터: 비면 전체로 보이고 마지막 하나는 해제되지 않음 | `/search` `viewFilterSelection`·`commitFilterSelection`, `/list` `listChoiceValue` | `list` |
| 선택 칸 5가지 모양 + 서버 검색 + 그룹 | `/choice` `useChoiceBinding` | `choice` |
| 등록·수정 폼의 선택 칸 (빈 값=미선택, 필수는 저장 때 오류) | `/form` | `form` + `choice` |

고정 `options`와 서버 `check` 중 무엇을 쓸지는 [목록 선택지 연결](../skills/web-kit-list/SKILL.md#고정-선택지와-서버-선택지-고르기)에서 고른다. 서버 선택지는 기존 `ChoiceFilter`가 조회 상태와 URL 확인을 함께 연결한다.

React·ReactDOM은 필수 peer(소비 앱이 설치하는 동료 라이브러리)이고 TanStack·axios와 검사 러너는 선택 설치다. 각 책임에서 쓰는 의존은 package.json을 따른다. Base UI는 패키지 peer가 아니라 registry 항목 의존이며 react-virtual은 `/list`의 가상 행 hook 때문에 남는다. 설치하지 않은 선택 기능은 "검사하지 않음"으로 기록한다. 루트가 React를 import하지 않는 것과 React 없는 독립 패키지는 다르다.


## 인증 단계 연결

| 입구 | 책임 | 연결 기준 |
|---|---|---|
| `/auth` | 로그인 전 코드 기한 계산과 단일 요청 진행 | [web-kit-auth](../skills/web-kit-auth/SKILL.md) |
| registry `auth` | 코드 입력·남은 시간·재전송·만료 안내 복사본 | 설치 시 단위·브라우저 검사 연결 포함 |

기존 로그인 전 타이머와 제출 진행을 `/auth`로 옮긴다. 서버 요청·기한 값·문구·등록 흐름은 프로젝트가 제공한다. `/session/idle`의 `createServerClock` 객체를 인증 단계와 유휴 타이머에 함께 넘긴다. 기존 유휴 타이머 API는 clock을 생략해도 유지된다. starter 로그인은 코드 인증 단계가 없으므로 제품 흐름을 추가하지 않으며, 설치된 검사 화면에서 두 입력 모양을 확인한다.

유휴 타이머의 멈춤·재개 연결과 기존 저장값·정책 입력 이전은 [소비 안내](migrating.md)와 [web-kit-http](../skills/web-kit-http/SKILL.md)를 따른다.
