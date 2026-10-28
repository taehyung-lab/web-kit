# web-kit

React 19 + TanStack(Router·Query·Form) + zod 4 + axios/orval을 쓰고, 서버가 Spring 응답 봉투 `{ header: { resultCode, resultMessage }, data }`로 답하는 관리자 웹의 기본 키트다. 이 응답 규약이 아닌 서버에는 맞지 않는다. 같은 의미의 동작과 선택적 공통 기본 UI를 키트가 제공하고, 제품 표현·업무 정책·서버 연결 차이는 프로젝트가 맡는다. 현재 제공 범위는 아래 표와 `package.json` exports다([3.0 재설계 결정](../../docs/decisions/0003-web-kit-3-redesign.md)).

정본: https://github.com/taehyung-lab/web-kit · 패키지 `@boosterlab/web-kit` · 최신 발행 `2.0.0` · 개발 중 `3.0.0` · 결정 기록 [docs/decisions](../../docs/decisions/). 이 패키지는 저장소의 `packages/web-kit`이고, 사용 예이자 소비 검사 앱은 같은 저장소의 [`apps/starter`](../../apps/starter)다.

## 구조

목록의 결과 출처와 목록 복귀 문맥은 [용어](GLOSSARY.md)에서 구분한다.

- **core**(루트 `.`): 외부 상태나 실행 없이 입력만으로 결과를 정하는 순수 규칙이다(실패 12종 해석, 기간 검증, 체크 트리 선택, query 직렬화). `tests/core-boundary.test.ts`는 루트에서 따라가는 파일에 라이브러리 의존이 없는지만 검사한다. 순수한지는 이 정의와 검토로 판단한다. `session`처럼 라이브러리에 의존하지 않아도 실행·부수효과가 있는 코드는 core가 아니며, 자기 subpath로 공개한다.
- **binding subpath**: core 위에 한 라이브러리를 연결한다. 다른 라이브러리가 필요해지면 subpath를 새로 추가하고, 기존 binding은 그대로 둔다.
- **공통 기본 UI**: 동작 module을 소비하는 선택적 표현이다. 동작은 특정 기본 UI를 import하지 않는다. 폼·필터·표·페이지 이동·상세 상태·이력 표시를 제공한다. 별도 core/UI 패키지 분리는 실제 설치·배포 필요가 생기면 판단한다.
- **skills**: module별 사용 기준이다. 코드와 같은 버전으로 배포한다.

| import | 키트가 보장하는 것 | 프로젝트가 넘기는 것 |
|---|---|---|
| `.` / `/failure` | 실패 12종, 결과 코드 표, 봉투 해석 | 서버 enum의 결과 코드 행 |
| `/session` | 세대, 시작·종료와 종료 순서(정리 → 안내 → 서버 로그아웃), 다른 탭 변경, 재발급 단일 비행(Web Locks) | 저장 adapter·재발급·서버 로그아웃 호출 |
| `/session/idle` | 유휴 마감(로그인·명시적 연장만 변경), 경고 구간·대기, 활동 연장, 대표 탭, 만료 종료 | 시간 정책·저장 key·서버 연장 호출·응답의 서버 시각 표본·경고 디자인 |
| `/session/browser` | 브라우저 저장 장애 복구·외부 이벤트 판별·해제 | 저장 key·동기 schema·읽기 불가 정책 |
| `/http` | 헤더·토큰, 봉투 해제, 401 재발급 뒤 한 번 재전송, 반영 여부 판정 | 공개 경로, 운영 헤더, axios 기본값 |
| `/query` | 재시도 대상, 실패 알림 한 번, 선언한 무효화, 민감한 쓰기의 입력값 기록 지움, 세션 전환 시 비움 | 재시도 횟수, 알림 표시, staleTime 등 수치 |
| `/search` · `/list` | URL 필드 복구·정규 URL·진입 주소 교정(route `validateSearch`·`beforeLoad`), 검색 확정, 선택지 확인, 결과 출처, 선택·일괄 작업 | 필드 schema·encode·기본값, 조회 함수 |
| `/list/ui` · `/filter/ui` | 검색·초기화·기간·키워드·표·페이지 이동·일괄 확인 | 필드·시간대·컬럼·성공한 ID·문구 |
| `/filter` | 기간 검증, 오류 표시, 체크 트리 | checkbox·문구·스타일 |
| `/form` · `/form/ui` · `/dialog` | 제출·확인 관문·저장·기준선·서버 필드 오류·늦은 결과, 기본 필드·단일 확인·이탈 조정 | schema·원본·저장 함수·완료 의도·문구 |
| `/record` · `/detail/ui` | 단건 상태·재시도·항목·이력 표현·선언적 마스킹 | queryOptions·업무 항목·노출 정책 |
| `/api` | Spring query 직렬화 | 적용 endpoint |
| `/testing` | 프로젝트 Field·확인창·재시도 focus adapter 검사 | 자기 UI adapter |
| `/testing/session` | 저장 실패·다른 탭 변경·종료의 adapter 검사(React/Form import 없음) | 자기 저장 adapter와 격리된 검사 환경 |

React는 peer이고 번들에 포함하지 않는다. 현재 React·ReactDOM peer는 필수이며 TanStack·axios·Base UI peer는 optional이다. 루트 소스가 React를 import하지 않는 것과 React 없는 독립 패키지인 것은 다르다.

## 스킬

| 스킬 | 언제 읽나 |
|---|---|
| `web-kit-http` | API 호출, 실패, 재발급, 로그인/로그아웃, QueryClient, 무효화 |
| `web-kit-list` | 목록 검색·조회·선택·일괄 작업 |
| `web-kit-form` | 등록·수정 폼(줄 추가·삭제 입력 포함), 확인 실행 |
| `web-kit-record` | 상세·수정 원본 단건 |

프로젝트는 설치본의 스킬을 `.agents/skills/`에 링크하고, 업무 정책 문서와 읽는 순서는 자기 AGENTS.md 지도에 둔다. 키트 문장을 프로젝트 문서에 복사하지 않는다. 링크 기준은 web-kit 의존성을 선언한 패키지의 `node_modules`다(monorepo에서 루트 호이스팅에 기대지 않는다). 예: 저장소 루트에서 `PKG=apps/admin`(단일 패키지면 `PKG=.`).

기존 코드 교체와 저장 adapter 검사는 [소비 안내](docs/consuming.md)를 따른다.

```sh
mkdir -p .agents/skills
for name in web-kit-http web-kit-list web-kit-form web-kit-record; do
  link=".agents/skills/$name"
  if [ -e "$link" ] || [ -L "$link" ]; then
    printf '%s\n' "기존 경로를 확인하세요: $link" >&2
    continue
  fi
  ln -s "../../$PKG/node_modules/@boosterlab/web-kit/skills/$name" "$link"
done
```

기존 같은 이름의 스킬이 있으면 덮어쓰지 않고 출처를 확인한다. 업그레이드 뒤 링크가 설치한 버전의 `SKILL.md`로 해소되는지 확인한다. 프로젝트 역할 스킬은 반복되는 제품 고유 판단이 있을 때만 둔다. 공통 조립법은 키트 스킬이 맡고 제품 근거·검사 위치는 프로젝트 지도에서 찾는다.

## 설치와 업그레이드

소스 TS/TSX 패키지라서 소비 앱의 Vite/TypeScript가 컴파일한다. 소비 앱은 GitHub release tarball을 `vendor/`에 보관한다. 개발자 로컬 경로나 설치 시 GitHub 인증에 의존하지 않기 위해서다.

아래 명령은 발행된 2.0.0을 설치한다. 개발 중인 3.0.0은 소비 검증과 발행 전까지 이 명령을 바꾸지 않는다.

```sh
gh release download v2.0.0 --repo taehyung-lab/web-kit --pattern 'boosterlab-web-kit-2.0.0.tgz' --dir vendor
pnpm add @boosterlab/web-kit@file:vendor/boosterlab-web-kit-2.0.0.tgz
```

- package.json·lockfile·tarball을 함께 commit한다. 소스 복사·submodule·branch 최신값 의존성은 쓰지 않는다.
- 공통 변경의 버전 기준·소비자 revision 선택·산출물 식별·발행 순서는 [유지보수](../../docs/maintaining.md)가 정한다. CI는 tarball을 같은 commit의 `apps/starter`에 설치해 검사하고 그 산출물과 검증 기록을 남긴다.
- 발행 뒤 각 소비 앱은 release 파일로 갱신하고 자기 adapter의 typecheck·test·build를 확인한다. 되돌릴 때는 이전 release와 lockfile을 함께 복원한다.

## 2.0 이전 시 확인

`selection.run`은 `{ completedIds }` 결과를 요구한다. Promise가 끝났다는 이유만으로 전부 성공으로 보던 동작을 제거했으므로 major 버전이다. 실패·거절은 throw하고, 부분 성공은 실제 성공 ID만 반환한다. 기존 import 경로는 유지한다.

기본 UI 사용 시 `@base-ui/react@1.7.0`을 설치하고 앱 진입에서 `@boosterlab/web-kit/styles.css`를 한 번 import한다. `FormNavigation`은 Router 안에 한 번 설치한다. 기본 UI를 채택한 화면은 중복된 이탈 차단·확인창·필드 배선을 제거한다. Vite 8의 TSX 소스 소비는 `optimizeDeps.extensions: ['.tsx']`로 사전 변환 대상에 포함한다.

## 개발과 검증

Node 24.19.0, pnpm 10.33.0.

```sh
pnpm install --frozen-lockfile
pnpm check
```

- 키트 검사는 module 보장을 확인한다. 실제 화면·URL·요청은 소비 앱이 검사한다.
- 실제 서버 수용, 브라우저 E2E, 미확인 외부 계약(E1–E3)은 키트 검사로 대신하지 않는다.
