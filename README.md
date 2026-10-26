# web-kit

React 19 + TanStack(Router·Query·Form) + zod 4 + axios/orval을 쓰고, 서버가 Spring 응답 봉투 `{ header: { resultCode, resultMessage }, data }`로 답하는 관리자 웹의 기본 키트다. 이 응답 규약이 아닌 서버에는 맞지 않는다. 이 스택과 스펙을 쓰면 같은 의미의 동작은 이 코드를 공용으로 쓰고, 시각 UI와 업무 정책은 프로젝트가 맡는다.

정본: https://github.com/taehyung-lab/web-kit · 패키지 `@boosterlab/web-kit` · 버전 `1.0.1` · 결정 기록 [docs/decisions](docs/decisions/).

## 구조

- **core**(루트 `.`): 외부 상태나 실행 없이 입력만으로 결과를 정하는 순수 규칙이다(실패 12종 해석, 기간 검증, 체크 트리 선택, query 직렬화). `tests/core-boundary.test.ts`는 루트에서 따라가는 파일에 라이브러리 의존이 없는지만 검사한다. 순수한지는 이 정의와 검토로 판단한다. `session`처럼 라이브러리에 의존하지 않아도 실행·부수효과가 있는 코드는 core가 아니며, 자기 subpath로 공개한다.
- **binding subpath**: core 위에 한 라이브러리를 연결한다. 다른 라이브러리가 필요해지면 subpath를 새로 추가하고, 기존 binding은 그대로 둔다.
- **skills**: module별 사용 기준이다. 코드와 같은 버전으로 배포한다.

| import | 키트가 보장하는 것 | 프로젝트가 넘기는 것 |
|---|---|---|
| `.` / `/failure` | 실패 12종, 결과 코드 표, 봉투 해석 | 서버 enum의 결과 코드 행 |
| `/session` | 세대, 시작·종료, 다른 탭 변경, 재발급 단일 비행(Web Locks) | 저장 위치 adapter, 재발급 호출 |
| `/http` | 헤더·토큰, 봉투 해제, 401 재발급 뒤 한 번 재전송, 반영 여부 판정 | 공개 경로, 운영 헤더, axios 기본값 |
| `/query` | 재시도 대상, 실패 알림 한 번, 선언한 무효화, 세션 전환 시 비움 | 재시도 횟수, 알림 표시, staleTime 등 수치 |
| `/search` · `/list` | URL 필드 복구·정규 URL·진입 주소 교정(route `validateSearch`·`beforeLoad`), 검색 확정, 선택지 확인, 결과 출처, 선택·일괄 작업 | 필드 schema·encode·기본값, 조회 함수, 필터 UI |
| `/filter` | 기간 검증, 오류 표시, 체크 트리 | checkbox·문구·스타일 |
| `/form` · `/form/ui` · `/dialog` | 제출·확인 관문·저장·기준선·서버 필드 오류·늦은 결과, Field 접근성 | schema·원본·저장 함수, 확인창·이탈 UI |
| `/record` · `/detail/ui` | 단건 네 상태와 갱신 사실, dt/dd 표현 | queryOptions, 없음·실패 표시 |
| `/api` | Spring query 직렬화 | 적용 endpoint |
| `/testing` | 프로젝트 Field·확인창·재시도 focus adapter 검사 | 자기 adapter |

React는 peer이고 번들에 포함하지 않는다. 라이브러리 peer는 그 subpath를 쓰는 앱만 필요하다.

## 스킬

| 스킬 | 언제 읽나 |
|---|---|
| `web-kit-http` | API 호출, 실패, 재발급, 로그인/로그아웃, QueryClient, 무효화 |
| `web-kit-list` | 목록 검색·조회·선택·일괄 작업 |
| `web-kit-form` | 등록·수정 폼, 확인 실행 |
| `web-kit-record` | 상세·수정 원본 단건 |

프로젝트는 설치본의 스킬을 `.agents/skills/`에 링크하고, 업무 정책 문서와 읽는 순서는 자기 AGENTS.md 지도에 둔다. 키트 문장을 프로젝트 문서에 복사하지 않는다. 링크 기준은 web-kit 의존성을 선언한 패키지의 `node_modules`다(monorepo에서 루트 호이스팅에 기대지 않는다). 예: 저장소 루트에서 `PKG=apps/admin`(단일 패키지면 `PKG=.`).

```sh
for s in "$PKG"/node_modules/@boosterlab/web-kit/skills/*/; do ln -sfn "$(python3 -c 'import os,sys;print(os.path.relpath(sys.argv[1],".agents/skills"))' "$s")" ".agents/skills/$(basename "$s")"; done
```

## 설치와 업그레이드

소스 TS/TSX 패키지라서 소비 앱의 Vite/TypeScript가 컴파일한다. 소비 앱은 GitHub release tarball을 `vendor/`에 보관한다. 개발자 로컬 경로나 설치 시 GitHub 인증에 의존하지 않기 위해서다.

```sh
gh release download v1.0.1 --repo taehyung-lab/web-kit --pattern 'boosterlab-web-kit-1.0.1.tgz' --dir vendor
pnpm add @boosterlab/web-kit@file:vendor/boosterlab-web-kit-1.0.1.tgz
```

- package.json·lockfile·tarball을 함께 commit한다. 소스 복사·submodule·branch 최신값 의존성은 쓰지 않는다.
- 공통 변경은 이 저장소에서 검사하고 버전을 올린다. `pnpm pack`으로 산출물을 만들고, 같은 commit에 `v<version>` 태그와 release를 발행한다. 발행한 버전 번호로 내용이 다른 tarball을 다시 만들지 않는다.
- 이후 소비 앱 adapter의 typecheck·test·build를 확인한다. 되돌릴 때는 이전 release와 lockfile을 함께 복원한다.

## 개발과 검증

Node 24.19.0, pnpm 10.33.0.

```sh
pnpm install --frozen-lockfile
pnpm check
```

- 키트 검사는 module 보장을 확인한다. 실제 화면·URL·요청은 소비 앱이 검사한다.
- 실제 서버 수용, 브라우저 E2E, 미확인 외부 계약(E1–E3)은 키트 검사로 대신하지 않는다.
