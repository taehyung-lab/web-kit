---
name: web-kit-structure
description: 새 feature·화면·route를 추가하거나, 화면에 있던 요청·저장·이동 같은 업무 처리를 옮기거나, 상수·공용 함수·파일 자리를 정할 때 먼저 읽는다. app·runtime·routes·features(api·forms·rules·storage·search·hooks·pages)·shared의 책임과 import 방향, route 파일 규칙, 구조 lint(@boosterlab/web-kit/structure)·골격 생성기(web-kit-new)·web-kit-check 구조 결과를 정한다. 각 공통 동작의 사용법은 web-kit-form·list·record·auth·http로 보낸다.
---

# web-kit structure

키트를 쓰는 관리자 웹의 폴더 책임과 의존 방향을 정한 사용 계약이다. 제품 값(도메인 이름·URL·문구·코드)은 프로젝트가 소유한다. 아래 예의 상품·회원은 starter의 예시 도메인이다.

적용 범위: starter와 구조 계약을 채택한 앱은 필수다. 키트 기능 일부만 쓰는 앱은 채택하지 않을 수 있다. 채택한 앱은 새로 만들거나 옮긴 파일을 바로 이 규칙으로 두고, 아직 옮기지 않은 파일만 이유를 적은 예외로 남긴다. 구조 통과는 import 방향·자리·이름만 확인한 것이며 제품 동작을 보존했다는 뜻이 아니다. 두 결과를 따로 센다.

## 앱 폴더

실제 조립 예: [apps/starter/src/runtime/web-kit.ts](../../references/apps/starter/src/runtime/web-kit.ts.txt), [apps/starter/src/app/App.tsx](../../references/apps/starter/src/app/App.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

| 폴더 | 맡는 것 | 하지 않는 것 |
|---|---|---|
| `app/` | 앱 조립: Provider·router 생성·전역 오류·전역 안내 표시·앱 골격(`app/shell`)·세션 변화에 따른 이동(`app/session`)·feature 문구 등록 | 화면 하나의 저장·검색·승인 업무 |
| `runtime/` | 설정된 실행 기반: http·세션·QueryClient·서버 시계·i18n 인스턴스·전역 안내 저장소, 서버 응답 계약·저장 key | feature·route·app import, 업무 순서, 화면 목적지 |
| `routes/` | URL ↔ 화면 연결, search·params 검증, 진입 판정 | 요청·저장·요청 변환·화면 상태. 기본 loader, 검사 파일 |
| `api/generated/` | 명세에서 생성한 타입·endpoint(커밋) | 손 수정 |
| `features/<도메인>/` | 아래 층 | 다른 feature 내부 import, app·routes import |
| `shared/` | 도메인과 무관한 UI(shadcn 부품·registry 복사본)와 함수 | app·runtime·routes·features·생성 코드 import |

runtime을 app에서 나누는 이유: feature가 http·세션을 쓰려고 app을 import하고 app이 다시 feature를 조립하면 양방향 의존이 된다. feature는 runtime을, app은 feature와 runtime을 안다. runtime이 feature를 불러야 할 것 같으면 그 일은 업무이므로 app이 구독·연결한다(예: 세션 종료 → 로그인 화면 이동은 `app/session`).

## feature 층

실제 조립 예: [apps/starter/src/features/products/hooks/use-product-create.ts](../../references/apps/starter/src/features/products/hooks/use-product-create.ts.txt), [apps/starter/src/features/products/pages/ProductCreatePage.tsx](../../references/apps/starter/src/features/products/pages/ProductCreatePage.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

필요한 책임의 폴더만 만든다. 빈 폴더·빈 파일을 미리 만들지 않는다.

| 자리 | 맡는 것 | 하지 않는 것 |
|---|---|---|
| `api/` | 요청 함수·요청/응답 DTO 모양·DTO → 앱 모델 변환, `queryOptions`·query key·mutation hook과 `meta.invalidates` | 세션 시작·화면 이동·안내창·업무 성공 효과, 상태·업무 hook·화면 import, JSX |
| `<도메인>.ts` (역할 `data`) | 순수 도메인 타입·계산. 예: `product.ts`의 상품 타입 | React·라우터·Query·axios·키트 실행 입구, 브라우저 전역, api·runtime·storage·search 값, hooks·pages 의존 |
| `forms/` | 순수 폼 schema·빈 값·원본 ↔ 폼 값·요청 변환·서버 필드 오류 대응 | data와 같은 실행·JSX 금지 |
| `rules/` | 순수 정책 값·판정·실패 의미 | data와 같은 실행·JSX 금지 |
| `search/` | URL 검색 선언·목록 조건·상세에서 목록으로 돌아올 조건. 서버 선택지 확인도 여기서 연결 | hooks·pages import, 키트 목록 상태의 복제 |
| `storage/` | 여러 화면이 공유하거나 저장·복원하는 상태와 수명, 키트 저장소의 프로젝트 설정 | hooks·pages import, 키트가 가진 상태 수명의 복제 |
| `permissions.ts` (역할 `storage`) | 권한 판정을 실행 환경·세션과 연결 | 순수 규칙으로 취급하거나 pages에서 값 import |
| `hooks/` | 행동 단위 hook(`use-<행동>.ts`). api·순수 코드·search·storage·runtime·키트 hook을 조립하고 화면에 필요한 상태·동작을 반환 | JSX, pages import, 키트 수명의 재구현 |
| `pages/` | hook 호출, JSX 배치, 문구, 열·칸·표시 부품, 표시 상태·UI binding | api·생성 코드·runtime·storage·search 값 import, zod, 업무 수명 hook, 업무 결과에 따른 이동 |
| `messages.ts` | 도메인 문구 원문. 앱의 문구 등록에서 가져온다 | 키트 기본 문구로 올리기 |
| `public.ts` | feature 밖(다른 feature·route 진입 판정)이 쓰는 연결만. 첫 외부 사용이 생길 때 만든다 | 내부 전체 재export, 다른 feature 내부 경로 우회 |

URL 목록 검색은 `search/`에 둔다. 목록·상세 사이에 남길 URL 형식이며 서버 선택지 확인은 api query를 연결하므로 순수 데이터가 아니다. route는 이 선언의 `validateSearch`·`beforeLoad`를 쓴다.

처음 읽는 사람이 찾을 이름을 쓴다. `model/` 없이 `product.ts` 옆에 `product.test.ts`를 둘 수 있다. 필요한 책임의 폴더만 만들고, 한 페이지에서만 쓰는 열·필터·배지·formatter는 그 페이지 가까이 `pages/` 안에 둔다. 파일을 감싸기만 하는 hook이나 중간 컴포넌트는 추가하지 않는다. 페이지의 대표 export는 `ProductListPage`처럼 `Page`로 끝내고, 그 안의 부분은 `ProductFilters`·`ProductDetailsSection`처럼 실제 역할로 이름 짓는다. 기존 `model/`·`state/`·`flows/`·`screens/`·`i18n.ts`는 새로 만들거나 옮기는 코드의 자리가 아니다.

## 의존 방향

실제 조립 예: [apps/starter/src/features/auth/public.ts](../../references/apps/starter/src/features/auth/public.ts.txt), [apps/starter/src/routes/_app/route.tsx](../../references/apps/starter/src/routes/_app/route.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- `app → features·runtime·shared`, `routes → features(pages·search·storage·순수 코드·public.ts)·app`, `pages → hooks·순수 코드·shared`, `hooks → api·순수 코드·search·storage·runtime`, `search·storage → api·순수 코드`, `api → 생성 코드·runtime·순수 타입`, `runtime → 키트·외부 라이브러리·shared`. `shared`는 위쪽을 모른다.
- 다른 feature는 그 feature의 `public.ts`만 import한다. public.ts가 재export한 대상도 실제 출처의 층으로 판정한다(화면이 public.ts를 거쳐 다른 feature의 api를 가져오면 위반).
- 타입 전용 import(`import type`)는 실행을 만들지 않으므로 실행 금지(화면 → api 타입, 순수 코드 → 생성 DTO 타입)에서는 허용한다. 구조를 알면 안 되는 방향(shared → feature, runtime → feature, storage·search·hooks → pages)은 타입도 금지다.
- 제품 코드(app·runtime·routes·features·shared)는 mock·검사 도우미(`support`로 설정한 폴더)를 import하지 않는다. 실행 진입(`src/main.tsx`)과 검사 파일은 구조 방향 검사에서 빠진다.

## 상수와 이름

실제 조립 예: [apps/starter/src/features/products/rules/product-list-policy.ts](../../references/apps/starter/src/features/products/rules/product-list-policy.ts.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- 값의 자리는 사용 횟수가 아니라 의미·수명·소유자로 정한다. 한 함수에서만 쓰면 그 함수 옆, 폼의 빈 값·길이 제한은 그 `forms/` 파일, 여러 흐름이 쓰는 제품 판정 값은 `rules/<업무>-policy.ts`, 저장 key는 그 상태 파일, 숫자 → 표시 문자열은 화면의 이름 있는 formatter, 제품 의미가 없는 공용 계산만 `shared/lib`.
- `utils`·`helpers`·`constants`·`common`·`misc` 같은 이름의 파일·폴더를 만들지 않는다. 무엇이든 담게 되어 자리를 잃는다. 책임으로 이름 짓는다.
- 정책 값에는 출처(서버 명세·제품 결정)를 주석으로 남긴다. 키트 기본값으로 올리지 않는다.

## 업무 hook 모양

실제 조립 예: [apps/starter/src/features/auth/hooks/use-login-flow.ts](../../references/apps/starter/src/features/auth/hooks/use-login-flow.ts.txt), [apps/starter/src/features/products/hooks/use-product-list.ts](../../references/apps/starter/src/features/products/hooks/use-product-list.ts.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- 업무 hook은 화면이 그리는 데 필요한 것만 돌려준다. 예: `useLoginFlow({ redirect }) → { editor }`, 안내가 있는 로그인이면 `{ editor, alert, dismissAlert }`. 토큰·setter·임의 query를 그대로 내보내면 화면이 업무를 다시 조립하게 되므로 인터페이스를 줄인다.
- 저장과 완료를 나눈다. `useSaveForm`의 `save`는 요청만 하고 응답(또는 `{ saved }`)을 돌려준다. 세션 시작·다음 화면 이동·후속 조회는 `onSaved`에 둔다. 그래야 이동이 실패해도 키트가 완료만 다시 시도하고 요청을 다시 보내지 않는다([web-kit-form](../web-kit-form/SKILL.md)). 완료 단계는 다시 실행돼도 같은 결과가 되게 쓴다(같은 토큰으로 세션 세대를 또 열지 않기 등).
- 키트가 맡은 수명(저장 중복 방지·완료 재시도·목록 확정 검색·단건 상태·인증 기한·늦은 응답 무시)을 업무 hook에서 다시 만들지 않는다. 업무 hook은 업무의 실제 순서와 프로젝트 효과만 소유한다. 판정(이 실패가 자격증명 거절인가)은 `rules`, 그 결과를 어떤 문구·버튼으로 그릴지는 화면이 정한다.
- 사용자 조작 안에서 실행해야 하는 일(브라우저 권한 요청 등)은 업무 hook으로 옮겨도 첫 `await` 전 같은 동기 구간에서 실행한다. effect·요청 뒤로 미루지 않는다.
- 같은 내용이 준비된 뒤에만 필요한 조회는 그 부분이 쓰는 별도 업무 hook으로 둔다(없는 상세에서 보조 선택지를 조회하지 않기).

## 화면이 쓰는 것

실제 조립 예: [apps/starter/src/features/products/pages/ProductListPage.tsx](../../references/apps/starter/src/features/products/pages/ProductListPage.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- 허용: 업무 hook 호출, registry UI와 shadcn 부품, `useTranslation`, `useState` 같은 표시 상태, 업무 hook이 준 editor·list·state를 부품에 넘기기, `editor.form` 값 읽기·칸 값 넣기 같은 UI binding, `<Link>`, route가 넘긴 이동 콜백 호출.
- 금지(구조 lint가 막는다): api·생성 코드·runtime·storage·search 값 import, `zod`, `axios`·`@tanstack/react-query`, 키트 실행 입구(`/http`·`/session*`·`/query`·`/api`), `useSaveForm`·`useList`·`useRecord`·`useAuthChallenge`, `useNavigate`·`useRouter`·`redirect`. 맨 `<button>`·`<input>`·`<select>`·`<textarea>`는 app·features·routes 어디서도 쓰지 않는다.
- `onClick={async () => { await 요청(); 저장소.쓰기(); 이동(); }}`처럼 업무를 잇는 처리는 업무 hook으로 옮긴다. lint는 import를 막을 뿐 화면 안 effect의 업무 의미까지 판정하지 않으므로 검토에서 본다.

## route 파일

실제 조립 예: [apps/starter/src/routes/_public/route.tsx](../../references/apps/starter/src/routes/_public/route.tsx.txt), [apps/starter/src/routes/_app/products/index.tsx](../../references/apps/starter/src/routes/_app/products/index.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- 모든 화면은 URL 폴더와 정해진 파일 이름을 쓴다. 목록·상세·단일 화면은 `<폴더>/index.tsx`, 등록은 `new.tsx`, 수정은 `$<id>/edit.tsx`. 예: `/terms/$termsId` → `terms/$termsId/index.tsx`, `/form-workflows` → `form-workflows/index.tsx`. `terms/$termsId.tsx`·`form-workflows.tsx` 같은 형태는 쓰지 않는다.
- 기존 제품 URL을 보존해야 하면 이름 관례보다 URL이 우선한다. URL 조각마다 폴더를 만들고 마지막을 `index.tsx`로 둔다(예: `/a/b/c` → `a/b/c/index.tsx`).
- 화면은 진입 판정과 골격이 같은 무리마다 route 묶음(`_<이름>/`, 주소에 나타나지 않음)으로 나누고, 그 판정과 골격 연결은 묶음의 `route.tsx` 한 곳에 둔다. 묶음 이름은 프로젝트가 역할이 읽히게 정한다(예: 로그인 전 `_public`, 로그인 뒤 `_authenticated`; starter는 `_public`·`_app`). 로그인 전 묶음은 "이미 로그인했으면 앱 첫 경로로" 판정을, 로그인 뒤 묶음은 "세션이 없으면 로그인으로" 판정을 맡는다. 골격이 다른 화면 무리는 별도 묶음으로 만든다. 묶음 골격 파일 이름은 `route.tsx`다.
- 같은 화면을 여러 URL에서 쓰면 route는 URL·진입 조건·문맥(검증한 params·search·이동 콜백)만 넘기고 화면은 features에 하나만 둔다.
- 골격 안의 없는 경로는 로그인 뒤 묶음의 `$.tsx`(예: `_authenticated/$.tsx`)가 골격을 둔 채 없음 화면을 그린다.
- route에 검사 파일을 두지 않는다. 기본 loader를 두지 않는다. 조회 상태 판정은 화면 업무 hook의 `useRecord`·`useList` 한 곳이 한다. 꼭 필요한 loader는 이유와 함께 예외로 남긴다.
- 진입 판정이 feature 상태를 읽으면 그 feature의 `public.ts`를 쓴다(예: `isSignedIn`).

## 검사 경계

실제 조립 예: [apps/starter/src/features/products/pages/ProductCreatePage.test.tsx](../../references/apps/starter/src/features/products/pages/ProductCreatePage.test.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

| 자리 | 확인할 것 | 대신 증명하지 못하는 것 |
|---|---|---|
| data·forms·rules 순수 단위 검사 | trim·빈 값·조건부 필수·요청 변환·코드 분류 | 화면 연결·서버 수용 |
| 업무 hook(msw + 앱 조립 `src/test/app.tsx`) | 제출 1회당 요청 1회, 응답별 분기, 완료 재시도에 요청 재전송 없음, 늦은 결과 무시 | 포커스·Tab·OS 권한 |
| 화면 그리기 | 입력·클릭·오류 표시·잠금 | 실제 서버 계약 |
| 제품 시나리오(브라우저·실서버) | URL 진입·redirect·세션·실제 요청·서버 반영 | 실행하지 못한 외부 조건 |
| 구조 검사 | import 방향·자리·파일 이름 | 업무 의미·제품 동작 보존 |

구조 통과·키트 UI 적합성 통과·제품 시나리오 통과는 서로 대신하지 않는다. mock 경계까지만 본 것, 환경 때문에 못 한 것, 실행하지 않은 것을 통과와 따로 보고한다.

## 구조 검사 연결

실제 조립 예: [apps/starter/eslint.config.js](../../references/apps/starter/eslint.config.js.txt), [apps/starter/web-kit.structure.json](../../references/apps/starter/web-kit.structure.json). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- 프로젝트 루트에 `web-kit.structure.json`을 둔다. 프로젝트가 정하는 것은 경로와 예외뿐이다: `src`, `alias`(생성기가 쓰는 import 접두어), `tsconfig`(paths 별칭 해소 기준), `routes`, `generated`·`generatedModels`(생성 endpoint·생성 모델), `support`(mock·검사 도우미), `exceptions`.
- `eslint.config.js`에서 TypeScript 파서 설정 뒤에 `...webKitStructure({ root: import.meta.dirname })`(`@boosterlab/web-kit/structure`)를 둔다. 규칙(`web-kit-structure/*`)을 끄거나 줄이지 않는다. 필요한 개발 의존은 `eslint`·`typescript`·`typescript-eslint`다(키트의 선택 peer라 런타임만 쓰는 앱에는 설치되지 않는다).
- 규칙은 TypeScript 해석기로 import 대상을 실제 파일로 해소한다. 별칭·상대 경로·`export … from`·import 후 export·`export *`·동적 `import()`·`require`를 따라 정의된 파일의 층으로 판정한다.
- 예외는 `{ "file": "src/…", "rule": "layer-import", "reason": "옮기지 않은 이유와 옮길 묶음" }`처럼 파일·규칙·이유를 하나씩 적는다. 폴더 단위·규칙 전체 예외는 없다. 새로 만들거나 옮긴 파일에는 예외를 두지 않는다. 위반이 없어진 예외는 지운다(남아 있으면 검사가 실패한다). 인라인 `eslint-disable`은 구조 검사에서 무시된다.
- `web-kit-structure`는 구조 결과만, `web-kit-check --structure web-kit.structure.json`은 구조 결과와 UI 적합성 결과를 각각 `[구조]`·`[UI 적합성]`으로 보이고 하나라도 실패면 실패다. `--structure`가 없으면 `[구조] 검사하지 않음`이며 통과로 세지 않는다. 구조 계약을 채택한 앱은 필수 CI에 `--structure`를 넣는다([검사 안내](../../docs/checking.md)).

## 새 화면 골격

실제 조립 예: [apps/starter/src/features/members/hooks/use-member-list.ts](../../references/apps/starter/src/features/members/hooks/use-member-list.ts.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- `pnpm exec web-kit-new --feature <도메인> --kind list|form|detail --url <URL> [--entity <단수 이름>] [--group <_묶음>] [--dry-run]`을 프로젝트 루트에서 실행한다. `--group`이 없으면 `web-kit.structure.json`의 `screenGroup` 묶음에 만들고, 둘 다 없거나 그 묶음에 `route.tsx`가 없으면 아무것도 쓰지 않고 실패한다(진입 판정 없는 화면을 만들지 않는다). form은 URL이 `/new`면 등록, `/$<id>/edit`면 수정 골격이다.
- 같은 feature의 공유 파일(앱 모델·단건 query·폼 schema)은 이미 있으면 그대로 쓰고, 화면 파일이 다른 내용으로 이미 있으면 아무 파일도 쓰지 않고 실패한다. 같은 입력으로 다시 실행하면 바뀌는 것이 없다.
- 생성기는 완료를 만들지 않는다. 서버 endpoint·필드·화면 배치·저장 뒤 목적지는 `TODO_web_kit_new_*`라는 선언되지 않은 이름으로 남아 채우기 전에는 typecheck가 실패한다. 성공 응답을 지어내지 않고 검사 파일(건너뛴 검사 포함)을 만들지 않는다. 문구 등록·메뉴·route 트리 재생성은 직접 한다.
- 생성한 파일 수·화면 수는 완료 수가 아니다. 화면은 제품 근거(원문·결정·시나리오)로 채우고 그 행동을 확인하는 검사를 직접 작성한 뒤에 완료로 센다.

## 확인 방법

실제 조립 예: [apps/starter/package.json](../../references/apps/starter/package.json). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- `pnpm lint`(편집 중 빠른 확인)와 필수 CI의 `web-kit-check --run … --structure web-kit.structure.json`.
- 구조 검사가 통과해도 화면 안 effect의 업무 의미, 업무 hook이 키트 수명을 복제했는지, 제품 동작이 보존됐는지는 검토와 제품 검사로 따로 확인한다.
