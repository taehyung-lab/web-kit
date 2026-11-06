# 예제 앱의 구조와 검사

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

## mock 동작

mock 모드에서는 access 토큰이 2분 뒤 만료된다. 그래서 2분 뒤 조회에서 401 → 재발급 → 재전송 흐름을 볼 수 있다(쓰기는 다시 보내지 않고 "저장 결과를 확인할 수 없습니다"로 끝난다 — 키트 결정 0003 E1).
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

`src/shared`는 `app`·`features`·`api`·`routes`를 import하지 않는다(ESLint로 검사). `features`는 `routes`를 모른다. 화면(`screens/`)은 모양과 연결만 두고 폼 schema는 `model/`에서 import하며(화면의 `zod` import 금지), 버튼·입력·선택은 맨 HTML 대신 shadcn 기본 부품(`@/shared/ui/button`·`input`·`select`·`textarea`)을, 폼 안에서는 `Form` 칸을 쓴다(둘 다 ESLint로 검사).

### 예시가 보여 주는 것

| 위치 | 보여 주는 키트 사용 |
|---|---|
| `app/web-kit.ts` | `createBrowserSessionStore`(key·schema·읽기 불가 정책 선언), 공개 요청으로 재발급, `isPublic`·`prepare`(Accept-Language)·axios 기본값, QueryClient retry·staleTime·`notify` 예시, 예시 결과 코드 행 |
| `app/auth.tsx` | 캡처한 토큰으로 로그아웃, `ended`의 `by`(local·other-tab·server)별 이동 |
| 상품 목록 | `defineSearch`(쉼표 목록 `encode`, 기간 묶음 `valid`, `view` key, 고정 목록은 `z.enum`·서버 선택지(분류)는 `check` — 없는 값은 그 필드만 기본값), route `validateSearch` + `beforeLoad`, `useList` + `ListView` 필터·표·페이지 이동·일괄 확인, `/api` 반복 키 직렬화 |
| 상품 상세 | `useRecord(options, id)`, loader는 미리 받기만, `Record`·`Record.Fields`·`Record.Field` |
| 등록·수정 | `useSaveForm` + `<Form editor>`와 `Form.of<Values>()` 부품으로 오류·선택지 상태·배열 입력을 선언(필수 표시는 schema에서 나온다). 수정은 `confirm` + `<Form confirm>`(켜면 필수), 완료 후 이동은 `onSaved`. 폼·대화창 기본 문구는 `app/AppCopyDefaults` 한 곳, 이탈 보호는 루트의 `FormGuard` 한 곳 |
| 약관 등록 예시 | 약관 등록 흐름(검증 → 저장 확인 → 저장 → 저장 완료 확인 → 상세)을 키트 값(`confirm`·`acknowledge`)과 부품 배치만으로 재현. `/terms/new` → `/terms/$termsId` |
| 공연 예시(복잡한 폼 재현) | 배열·파일·하위 폼의 복잡한 동작을 키트 값만으로 재현: 회차 줄 추가·삭제·이동(`Form.Array`, 서버 오류가 줄을 따라감), 좌석도 `Form.File`(저장 실패 뒤 보존·다시 업로드), 판매처 키 `Form.Dialog` 하위 폼(Enter가 바깥 폼을 제출하지 않음), 저장 중 진행 표시. `/shows/new` |
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
