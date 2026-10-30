# admin-web-starter

web-kit 저장소의 `apps/starter`. 새 관리자 웹의 틀이자, 키트를 바꿀 때 함께 고치는 소비 검사 앱이다. 새 프로젝트는 루트의 `pnpm starter:create`로 만든다. [저장소 README](../../README.md#새-프로젝트-시작)에 고정 AWK 입력과 실행 순서가 있다.

관리자 웹을 새로 만들 때 쓰는 기본 앱이다. 키트 연결(세션·요청·QueryClient), registry로 설치한 UI 복사본, 예시 기능 하나(상품 목록·상세·등록·수정·로그인), mock API, 화면 테스트, CI까지 갖춰 두었다. 예시 기능의 값(검색 기본값·문구·업무 규칙)은 스타터가 정한 예시이며 제품 결정이 아니다.

## 스택

| 영역 | 사용 |
|---|---|
| 화면 | React 19.2, Base UI 1.7 + Tailwind CSS 4 |
| 라우팅 | TanStack Router 1.170 (파일 route, `@tanstack/router-plugin`) |
| 데이터·폼·표 | TanStack Query 5, TanStack Form 1 |
| 계약 | zod 4, axios 1.20, orval 8 (OpenAPI → endpoint 함수) |
| 문구 | i18next 26 + react-i18next 17 (ko/en) |
| 검사 | TypeScript 5.9, ESLint 10(typescript-eslint, react-hooks), Vitest 4 + Testing Library + jsdom, msw 2 |
| 실행 | Node 24, pnpm 10.33 |

- **web-kit**: `package.json`의 `file:vendor/boosterlab-web-kit.tgz` 의존과 `.agents/skills/web-kit-*` 링크로 쓴다. `vendor/`의 검사 대상 tarball과 lockfile은 함께 커밋한다. 키트 변경 시 저장소 루트의 `pnpm starter:sync`로 다시 포장하고 설치한다.
- **agent-workflow-kit**: 이 앱에는 설치하지 않는다. web-kit 저장소 루트의 것을 쓰고, `starter:create`가 새 프로젝트에 고정 버전을 설치한다.

## 빠른 시작

```sh
(cd ../.. && pnpm starter:sync)   # 키트를 포장해 설치(의존성 설치 포함)
pnpm dev:mock      # msw mock API로 실행. 계정 admin / password
```

| 명령 | 하는 일 |
|---|---|
| `pnpm dev` | 실제 API에 붙여 개발 서버 실행(`.env.local` 필요) |
| `pnpm dev:mock` | mock API(브라우저 service worker)로 실행 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | 타입·lint·테스트 |
| `pnpm api:generate` | `openapi/sample.json` → `src/api/generated` |
| `pnpm check` | 타입·lint·단위·빌드·브라우저 검사와 strict 적합성 점검. 새 프로젝트는 일반 소비 점검을 쓴다 |
| `pnpm test:e2e` | 실제 브라우저(chromium, mock 모드) 검사. 처음 한 번 `pnpm exec playwright install chromium`. CI는 `check` 뒤에 돌린다 |

mock 모드에서는 access 토큰이 2분 뒤 만료된다. 그래서 2분 뒤 조회에서 401 → 재발급 → 재전송 흐름을 볼 수 있다(쓰기는 다시 보내지 않고 "저장 결과를 확인할 수 없습니다"로 끝난다 — 키트 결정 0001 E1).
mock 서버 상태(토큰·데이터)는 실제 서버처럼 새로고침해도 남는다(localStorage `starter.mock-server`). 처음 상태로 돌리려면 그 값을 지운다.

## 구조

```
openapi/sample.json          예시 API 명세(Spring 봉투). 실제 명세로 교체한다
src/
  app/
    web-kit.ts               키트 연결의 유일한 진입: 세션·http·QueryClient·결과 코드 표·orval mutator
    auth.tsx                 로그인·로그아웃 → session.start/end, 세션 종료(by) → 로그인 이동
    App.tsx router.tsx       provider 조립, router 생성
    errors.tsx               route 오류·없는 경로·마지막 오류 경계
    i18n.ts env.ts notices.ts
  api/generated/             orval 생성물(commit 대상, 직접 고치지 않음)
  features/
    products/                예시 기능
      api/                   queryOptions·mutation·DTO 변환·무효화 선언
      model/                 검색 선언(defineSearch)·폼 schema·요청 변환
      screens/               목록·상세·등록·수정 화면과 화면 테스트
    auth/                    로그인 화면·요청
  shared/
    ui/                      설치한 키트 UI의 소비 검사
    lib/                     실패 문구 키·폼 문구 해소
  routes/                    파일 route(validateSearch·beforeLoad·loader 미리 받기)
  mocks/                     msw handler·메모리 DB(테스트와 dev:mock 공용)
  test/                      테스트 준비·앱 렌더 도우미
docs/product/                제품 정책 문서 자리(비어 있음)
vendor/                      검사·배포에 사용하는 web-kit tarball(커밋 대상)
.agents/skills/              web-kit-*(node_modules로 가는 링크)
```

`src/shared`는 `app`·`features`·`api`·`routes`를 import하지 않는다(ESLint로 검사). `features`는 `routes`를 모른다.

### 예시가 보여 주는 것

| 위치 | 보여 주는 키트 사용 |
|---|---|
| `app/web-kit.ts` | `createBrowserSessionStore`(key·schema·읽기 불가 정책 선언), 공개 요청으로 재발급, `isPublic`·`prepare`(Accept-Language)·axios 기본값, QueryClient retry·staleTime·`notify` 예시, 예시 결과 코드 행 |
| `app/auth.tsx` | 캡처한 토큰으로 로그아웃, `ended`의 `by`(local·other-tab·server)별 이동 |
| 상품 목록 | `defineSearch`(쉼표 목록 `encode`, 기간 묶음 `valid`, `view` key, 고정 목록은 `z.enum`·서버 선택지(분류)는 `check` — 없는 값은 그 필드만 기본값), route `validateSearch` + `beforeLoad`, `useList` + `ListView` 필터·표·페이지 이동·일괄 확인, `/api` 반복 키 직렬화 |
| 상품 상세 | `useRecord(options, id)`, loader는 미리 받기만, `Record`·`Record.Fields`·`Record.Field` |
| 등록·수정 | `useSaveForm` + `<Form editor>`와 `Form.of<Values>()` 부품으로 오류·선택지 상태·배열 입력을 선언(필수 표시는 schema에서 나온다). 수정은 `confirm` + `Form.Confirm`, 완료 후 이동은 `onSaved`. 루트의 `FormGuard` 한 곳에서 이탈을 보호 |
| 약관 등록(레퍼런스 재현) | 레퍼런스 약관 등록(검증 → 저장 확인 → 저장 → 저장 완료 확인 → 상세)을 키트 값(`confirm`·`acknowledge`)과 부품 배치만으로 재현. `/terms/new` → `/terms/$termsId` |
| 공연 예시(복잡한 폼 재현) | DT 공연 폼의 복잡한 부분을 키트 값만으로 재현: 회차 줄 추가·삭제·이동(`Form.Array`, 서버 오류가 줄을 따라감), 좌석도 `Form.File`(저장 실패 뒤 보존·다시 업로드), 판매처 키 `Form.Dialog` 하위 폼(Enter가 바깥 폼을 제출하지 않음), 저장 중 진행 표시. `/shows/new` |
| 로그인 | `<Form protect={false}>`로 제품 예외를 명시. 공개 요청·토큰으로 세션 시작·자격증명 거절 문구는 제품이 연결 |
| 작성 예제 | `references`로 항목 ID와 선택 칸을 연결하고 삭제 시 정리 확인·취소를 소비한다. `secondary`와 `<Form.Submit mode="secondary">`로 필수 제목 없이 임시 저장하며, 게시와 저장 기준선·이탈 보호를 공유한다. `/form-workflows` |
| `shared/ui/adapters.test.tsx` | 설치한 Field·ConfirmDialog·RetryRegion을 공개 계약 검사로 확인 |


실패 문구는 실패 종류·`messageKey`로만 고른다. 서버 `resultMessage`는 화면에 보이지 않는다.

### 테스트

- `shared/ui/adapters.test.tsx`: 실제 Field·ConfirmDialog·RetryRegion에 `/testing`의 `checkFieldAdapter`·`checkConfirmDialogAdapter`·`checkRetryFocusAdapter`.
- 화면 테스트(실제 앱 조립 + msw, 요청·URL·focus 관찰): 목록 진입 주소 정규화, 없는 상태·정렬 값과 서버 선택지에 없는 분류의 기본값 복구, 선택지 조회 실패 시 조회 보류와 재시도, 일괄 작업의 HTTP 200 업무 거절, 등록 뒤 새 상세로 이동, 옵션 줄의 Enter 추가·삭제 표시·5줄 한도, 수정 저장의 서버 필드 오류, 상세 not-found.
- 실제 브라우저(`tests/e2e`, Playwright + mock 모드): 한 탭의 로그아웃 → 다른 탭 세션 종료, 진입 주소 교체와 요청 순서, 결과가 있을 때 재조회 실패, 저장 직후 이동에서 이탈 질문이 나오지 않음, 저장 중 바꾼 입력은 이동 때 보호됨, 입력이 있는 채 나가면 질문하고 머물면 입력 유지.
- `src/test/skill-links.test.ts`: 설치된 web-kit 스킬이 `.agents/skills`에 빠짐없이 연결되고 끊긴·남은 링크가 없는지.

## 화면 추가하기

이 저장소 안에서는 근거를 찾는 순서와 필요한 단계를 저장소 루트 `AGENTS.md`가 정한다. `src/features/products/`의 `api/` · `model/` · `screens/`가 화면 연결 예시다.

## 실제 API 연결하기

1. `openapi/sample.json`을 실제 서버 명세로 바꾸고(파일 이름을 바꾸면 `orval.config.ts`의 `input`도) `pnpm api:generate`를 돌린다. 생성물은 commit한다.
2. `src/app/web-kit.ts`의 결과 코드 표를 **서버 enum에 있는 행으로만** 다시 적는다. 예시 두 행(세션 종료 4012, 대상 없음 4040)은 지운다. 세션 종료 행은 서버 계약이 확정된 것만 둔다(web-kit 결정 기록 0001의 E1–E3).
3. `PUBLIC_PATHS`·`REISSUE_PATH`·재발급 본문, 브라우저 저장 key·자격증명 schema·읽기 불가 정책를 서버 인증 계약에 맞춘다.
4. `.env.example`을 `.env.local`로 복사해 `VITE_API_BASE_URL`·`VITE_API_TIMEOUT_MS`를 채운다. 비밀값은 commit하지 않는다.
5. 예시 기능(`features/products`, `routes/_app/products`, `mocks`의 상품 handler)을 자기 도메인으로 바꾸거나 지운다.

mock 통과나 HTTP 200만으로 서버 계약을 확인했다고 보지 않는다. 실제 서버로 401·재발급·필드 오류 모양을 따로 관찰한다.

## 키트 갱신

현재 대상 버전은 설치한 패키지와 `registry-installation.json`에서 확인한다. 정식 발행에는 main CI에서 검증한 tarball과 `verification.json`을 그대로 사용한다. `selection.run`의 결과는 실제 성공 ID인 `{ completedIds }`로 반환한다. 예시 API가 개수만 주는 부분 성공에서는 ID를 추측하지 않고 선택을 보존한다.

새 버전을 받는 방법은 각 키트 README의 업데이트·업그레이드를 따른다. 받은 뒤 이 저장소의 `pnpm check`와 `pnpm test:e2e`를 통과시킨다.

### UI 복사본 설치

화면은 `src/shared/ui/web-kit`의 소비 프로젝트 소스다. Form은 `@/shared/ui/web-kit/form/ui`, List는 `@/shared/ui/web-kit/list-ui`, 기본 입력과 대화창은 `@/shared/ui/web-kit/ui`에서 import한다. 공통 상태 hook은 계속 `@boosterlab/web-kit/form`, `/list`, `/dialog`, `/choice`에서 가져온다.

`components.json`의 `@web-kit`은 설치 기록과 같은 버전 tag에 고정한다. 아직 원격 발행 전인 후보는 저장소 루트에서 `pnpm registry:build` 후 `node scripts/install-starter-registry.mjs`로 설치한다. 이 명령은 설치 동안만 같은 checkout의 로컬 JSON을 가리키고, 실제 shadcn 4.19.1 CLI가 복사본을 만든 뒤 tag 설정을 복원한다. **재실행하면 현재 복사본을 덮어쓰므로 프로젝트 변경을 먼저 비교한다.**

`registry-installation.json`은 설치 항목·원본 버전·기준 commit·원본과 설치 파일 SHA-256·components 설정 지문을 보관한다. 갱신 시 이 기록으로 이전 원본을 찾고 새 원본과 프로젝트 복사본을 비교한다. 키트 tarball의 `starter:sync`는 UI 복사본을 갱신하지 않는다.


### 복사본 적합성 검사와 점검

registry는 UI와 함께 `src/shared/ui/web-kit/checks/*.test.tsx`, `tests/e2e/web-kit/*.spec.ts`, 검사 화면 연결 파일을 설치한다. 이 파일은 실제 복사본을 `@boosterlab/web-kit/testing/unit`, `/testing/browser`, `/testing/fixtures`의 공통 검사에 넘기며 단언은 패키지가 소유한다. 검사 화면은 `web-kit-checks/*.html`이며 제품 route에 추가하지 않는다.

`pnpm check`는 타입·lint·단위·빌드·브라우저 검사를 실행한 뒤 아래 점검을 필수로 실행한다. 처음에는 `pnpm exec playwright install chromium`이 필요하다. JSON 결과는 `.web-kit-results/`에 생성되며 git에는 넣지 않는다.

```sh
pnpm conformance:check
# 풀어 쓰면:
pnpm exec web-kit-check --installation registry-installation.json --unit .web-kit-results/unit.json --browser .web-kit-results/browser.json --strict-fingerprints
```

점검은 설치 항목별 연결 파일과 필수 검사, 누락·skip·실패, 결과의 패키지 버전·registry ref·원본 commit을 확인한다. Vitest의 `allowOnly: false`와 Playwright의 `forbidOnly: true`로 집중 실행을 CI에서 거절한다. starter는 설치 복사본을 그대로 검증하므로 지문 변경도 실패다. 일반 소비 프로젝트는 `--strict-fingerprints`를 빼면 수정된 복사본을 알림으로만 보고하고 실제 적합성 결과로 판정한다.

출력 예: `web-kit 적합성 통과: 14항목, 120개 식별자, package <version>, registry v<version>@<sourceCommit>`.
실제 제품이 이 검사 대상 복사본을 사용하는지는 이 명령이 자동 판정하지 않는다. 사용 경로와 검사 연결의 일치는 별도 검토한다. 개별 브라우저 적합성을 실행할 때는 등록 함수 위치가 패키지로 기록되므로 파일 경로 대신 `pnpm exec playwright test --grep 'B-dialog'`처럼 식별자로 선택한다.

## 5.0.0-rc.2 로컬 후보

현재 components.json은 이 저장소의 `../../public/r/{name}.json`을 가리킨다. 원격 후보 tag는 아직 발행하지 않았다. `starter:create`로 만든 독립 프로젝트는 후보 tag URL과 미발행 안내를 받으며, 로컬에 복사된 UI·vendor tarball은 쓸 수 있지만 tag 발행 전 원격 registry 추가 설치는 미확인이다. 패키지·registry 연결 검사는 같은 로컬 후보로 실행한다.
