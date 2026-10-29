# web-kit

React 19 + TanStack(Router·Query·Form) + zod 4 + axios/orval을 쓰는 웹 프로젝트의 공용 키트다. 서버 응답 구조와 코드 의미는 프로젝트의 `ResponseContract`가 해석한다. 기존 Spring 응답 봉투 도우미도 선택해서 쓸 수 있다. 공통 동작은 패키지 hook·Provider가, 화면 배치는 registry로 설치한 프로젝트 소유 복사본이 맡는다. registry는 복사할 UI와 공통 검사 연결 파일의 묶음이다. 업무 정책·서버 연결 차이는 프로젝트가 정한다. 현재 제공 범위는 아래 표와 `package.json` exports다([4.0 배포 결정](../../docs/decisions/0011-web-kit-4-ui-distribution.md)).

정본: https://github.com/taehyung-lab/web-kit · 패키지 `@boosterlab/web-kit` · 이 문서의 대상 버전 `4.1.0-rc.3` 후보(아직 정식 발행 전) · 결정 기록 [docs/decisions](../../docs/decisions/). 이 패키지는 저장소의 `packages/web-kit`이고, 사용 예이자 소비 검사 앱은 같은 저장소의 [`apps/starter`](../../apps/starter)다.

## 구조

목록의 결과 출처와 목록 복귀 문맥은 [용어](GLOSSARY.md)에서 구분한다.

- **core**(루트 `.`): 외부 상태나 실행 없이 입력만으로 결과를 정하는 순수 규칙이다(실패 12종 해석, 기간 검증, 체크 트리 선택, query 직렬화). `tests/core-boundary.test.ts`는 루트에서 따라가는 파일에 라이브러리 의존이 없는지만 검사한다. 순수한지는 이 정의와 검토로 판단한다. `session`처럼 라이브러리에 의존하지 않아도 실행·부수효과가 있는 코드는 core가 아니며, 자기 subpath로 공개한다.
- **책임별 입구(subpath)**: `/list`·`/form`처럼 책임별 상태·hook·Provider를 공개한다. 이름을 새로 만들 때는 [0011 판단표](../../docs/decisions/0011-web-kit-4-ui-distribution.md)를 따른다.
- **registry 복사본**: 원본은 `packages/ui-registry/src`, 정의는 루트 `registry.json`, 빌드 결과는 `public/r`에 있다. 폼·필터·표·상세 등 표현을 소비 프로젝트에 설치한다. 공통 처리 순서는 패키지가 끝내고 복사본은 반환된 ref·속성·이벤트를 연결한다. 제품 실행 코드는 registry를 import하지 않는다.
- **skills**: module별 사용 기준이다. 코드와 같은 버전으로 배포한다.

| import | 키트가 보장하는 것 | 프로젝트가 넘기는 것 |
|---|---|---|
| `.` / `/failure` | 실패 12종, 결과 코드 표, 봉투 해석 | 서버 enum의 결과 코드 행 |
| `/session` | 세대, 시작·종료와 종료 순서(정리 → 안내 → 서버 로그아웃), 다른 탭 변경, 재발급 단일 비행(Web Locks) | 저장 adapter·재발급·서버 로그아웃 호출 |
| `/session/idle` | `createServerClock`으로 로그인 전후 서버 시계 보정 공유, 유휴 마감(로그인과 서버 연장만 변경: 경고 밖 활동은 서버 연장, 경고 안은 연장 버튼만, API 응답·재발급은 연장 안 함), 경고 구간·대기, 활동 연장, 대표 탭, 만료 종료 | 시간 정책·저장 key·서버 연장 호출·응답의 서버 시각 표본·경고 디자인 |
| `/auth` + registry `auth` | 코드 기한·종류별 단일 요청·늦은 응답 격리, 입력 오류·만료·재전송 표현 | 공유 시계·기한·자리수·서버 요청·성공 처리·문구 |
| `/session/browser` | 브라우저 저장 장애 복구·외부 이벤트 판별·해제 | 저장 key·동기 schema·읽기 불가 정책 |
| `/http` | 헤더·토큰, 봉투 해제, 401 재발급 뒤 한 번 재전송, 반영 여부 판정 | 응답 해석·코드 의미·공개 경로·운영 헤더·axios 기본값 |
| `/query` | 재시도 대상, 실패 알림 한 번, 선언한 무효화, 민감한 쓰기의 입력값 기록 지움, 세션 전환 시 비움 | 재시도 횟수, 알림 표시, staleTime 등 수치 |
| `/search` · `/list` | URL 필드 복구·정규 URL·진입 주소 교정(route `validateSearch`·`beforeLoad`), 검색 확정(맞지 않는 기간 쌍은 기본값으로 정리·입력 중 키워드 포함), 정렬 전이, 선택지 확인, 결과 출처, 선택·일괄 작업, 다운로드 대상 고정 | 필드 schema·encode·기본값·조회 시작 조건·첫 정렬 방향, 조회 함수, 다운로드 요청 |
| `/list` + registry `list` | `ListProvider`·`useListModel`과 필터·기간·키워드·표·페이지·일괄 확인·다운로드 연결 hook | model, 필드·컬럼·배치·문구·실패 표현 |
| `/permission` | 진입 거부·메뉴 숨김·버튼 비활성의 닫힘 기본 판정 | 권한 상태·판정 함수·권한 목록 |
| 루트 + registry `checkbox-tree`·`filter-error` | 순수 기간·트리 계산과 오류/트리 표현 연결 | checkbox·문구·스타일 |
| `/form` · `/dialog` + registry `form`·`dialog` | 제출·확인·저장·기준선·오류·늦은 결과·이탈의 hook/Provider; 복사본 Form·FormGuard·Dialog | schema·원본·저장·완료 동작·배치·문구 |
| `/record` + registry `record`·`retry` | 단건 상태·갱신 실패·재시도 focus·마스킹; 복사본 Record·항목·이력 | queryOptions·항목·노출 정책·실패 문구 |
| `/choice` · `/dialog` + registry `inputs`·`choice`·`dialog`·`pending`·`blocking-progress` | 공통 선택·검색·대화창 포커스·진행 등록 hook과 기본 표현 | 값·문구·셸 배치·업무 행동 |
| `/api` | Spring query 직렬화 | 적용 endpoint |
| `/testing` · `/testing/unit` · `/testing/browser` · `/testing/fixtures` | adapter 검사, 복사본 단위·브라우저 적합성 기준·검사 화면 | 실제 복사본·연결 파일·실행 대상 버전 |
| `/testing/session` | 저장 실패·다른 탭 변경·종료의 adapter 검사(React/Form import 없음) | 자기 저장 adapter와 격리된 검사 환경 |

React·ReactDOM은 필수 peer(소비 앱이 설치하는 동료 라이브러리)이고 TanStack·axios와 검사 러너는 선택 설치다. 각 책임에서 쓰는 의존은 package.json을 따른다. Base UI는 패키지 peer가 아니라 registry 항목 의존이며 react-virtual은 `/list`의 가상 행 hook 때문에 남는다. 설치하지 않은 선택 기능은 "검사하지 않음"으로 기록한다. 루트가 React를 import하지 않는 것과 React 없는 독립 패키지는 다르다.

## 스킬

| 스킬 | 언제 읽나 |
|---|---|
| `web-kit-http` | API 호출, 실패, 재발급, 로그인/로그아웃, QueryClient, 무효화 |
| `web-kit-list` | 목록 검색·조회·선택·일괄 작업·엑셀 다운로드 흐름·목록 부품 |
| `web-kit-permission` | 경로 진입 차단·메뉴 숨김·버튼 비활성 연결 |
| `web-kit-form` | 등록·수정 폼(줄 추가·삭제 입력 포함), 확인 실행 |
| `web-kit-record` | 상세·수정 원본 단건 |

프로젝트는 설치본의 스킬을 `.agents/skills/`에 링크하고, 업무 정책 문서와 읽는 순서는 자기 AGENTS.md 지도에 둔다. 키트 문장을 프로젝트 문서에 복사하지 않는다. 링크 기준은 web-kit 의존성을 선언한 패키지의 `node_modules`다(monorepo에서 루트 호이스팅에 기대지 않는다). 예: 저장소 루트에서 `PKG=apps/admin`(단일 패키지면 `PKG=.`).

기존 코드 교체와 저장 adapter 검사는 [소비 안내](docs/consuming.md)를 따른다.

```sh
mkdir -p .agents/skills
for name in web-kit-http web-kit-list web-kit-permission web-kit-form web-kit-record; do
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

4.0은 책임 단위로 필요한 부분만 채택한다. 한 책임 안에서는 키트의 상태 수명·이벤트 처리와 자체 구현을 섞지 않는다. 배치와 디자인은 설치한 복사본에서 바꾸고 공통 동작은 패키지 hook으로 연결한다.

1. 검증된 같은 commit의 패키지 tarball(tgz 압축 파일)과 registry를 선택한다. 현재 후보 `4.1.0-rc.3`의 원격 tag/release는 아직 없으므로 아래 tag 예시는 발행 뒤 사용한다. 후보 검사는 저장소의 로컬 산출물을 사용한다.
2. tgz를 `vendor/`에 보관하고 설치한다. 대부분 소스 TS/TSX이므로 Vite/TypeScript가 컴파일하며 Vite에는 `optimizeDeps: { extensions: ['.tsx'] }`를 둔다. Playwright 검사 입구는 Node가 실행할 수 있는 mjs다.

```sh
pnpm add @boosterlab/web-kit@file:vendor/boosterlab-web-kit.tgz
```

3. 소비 프로젝트 `components.json`에 같은 버전 tag로 고정한 namespace(항목 이름의 출처)를 둔다. `@web-kit/form`은 이 주소의 form.json을 뜻한다.

```json
{
  "registries": {
    "@web-kit": "https://raw.githubusercontent.com/taehyung-lab/web-kit/v4.1.0-rc.3/public/r/{name}.json"
  }
}
```

4. shadcn 4.19.1 CLI로 필요한 항목을 먼저 확인한 뒤 설치한다. 항목은 검사 도구(vitest·Testing Library·Playwright)를 정확한 버전의 devDependencies로 설치해 기존 버전을 바꿀 수 있으므로, `shadcn add --dry-run`으로 바뀔 의존 버전과 lockfile 영향을 먼저 확인한다. 기존 프로젝트는 자기 변경과 차이를 확인한다. `--overwrite`를 갱신 기본값으로 쓰지 않는다.

```sh
pnpm dlx shadcn@4.19.1 add @web-kit/form --dry-run
pnpm dlx shadcn@4.19.1 add @web-kit/form
```

항목의 npm·registry 의존과 단위/브라우저 검사 연결 파일도 함께 설치한다. UI는 `src/shared/ui/web-kit`에 생긴다. 기본 스타일은 설치한 `ui/styles.css`를 앱에서 한 번 import한다. 예: `@/shared/ui/web-kit/form/ui`의 Form, `@boosterlab/web-kit/form`의 useSaveForm.

5. 설치 기록을 남긴다. 패키지 `version`, registry `sourceRef`·`sourceCommit`, 항목 이름, 원본 JSON/파일 SHA-256, 원본→설치 경로, **설치 직후** 파일의 `installedHash`, 사용한 CLI·components 설정 지문을 기록한다. SHA-256은 파일 내용이 같은지 비교하는 지문이다. CLI가 import나 별칭을 바꿀 수 있어 원본과 설치 지문을 같은 값으로 가정하지 않는다. 실제 형식은 [설치 기록](../../apps/starter/registry-installation.json), 로컬 후보 설치·기록 예는 [설치 스크립트](../../scripts/install-starter-registry.mjs)를 참고한다. 이 스크립트는 이 저장소 starter 전용이며 일반 프로젝트 갱신 명령이 아니다.
6. 설치한 스킬을 링크하고, 함께 설치한 검사 연결을 자기 CI에서 실행한다. [소비 안내](docs/consuming.md#복사본-적합성-검사)의 `web-kit-check`를 필수 단계로 둔다. package.json·lockfile·tgz·복사본·설치 기록·검사 연결을 함께 관리한다.

설치 기록의 installed 경로는 기록 파일이 있는 프로젝트 루트 기준으로 쓴다(starter의 기존 `apps/starter/` 접두도 점검기가 읽는다). 원본 commit은 받은 registry의 commit이며 소비 프로젝트의 현재 commit과 혼동하지 않는다. 다른 버전 조합을 검증 없이 섞지 않는다.

### 복사본 갱신

이전 원본 **A**, 받을 새 원본 **B**, 프로젝트가 고친 현재 복사본 **C**를 비교한다. 설치 기록으로 A의 tag/commit과 파일을 찾고 A와 B를 같은 CLI·설정으로 별도 작업 폴더에 설치한다. A→B는 키트 교정, A→C는 프로젝트 수정이다. 두 차이를 비교해 C의 디자인·업무 연결을 보존하며 필요한 교정을 적용한다. 충돌은 파일을 보존해 검토한다. `shadcn add --diff`는 C와 B의 차이만 보여 주므로 세 방향 비교를 대신하지 않는다.

적용 뒤 새 설치·검증 기록을 남기고 같은 단위·브라우저·점검 명령을 실행한다. 되돌릴 때는 이전 tgz·lockfile·복사본·설치 기록을 함께 복원한다. 변경 안내는 매번 **패키지만 올리면 반영 / 복사본 교정 필요**를 구분한다.

### rc.3 변경 안내

**패키지만 올리면 반영(문서·검사)**: 같은 행 ID가 돌아오는 검색 변경의 선택 초기화 검사를 보강하고, 같은 CI 작업에서 새 검사 결과로 점검하는 조건과 registry 설치의 검사 도구 버전 영향을 명시했다. 실행 동작과 registry 원본은 그대로이며 복사본 교정은 필요 없다.

### rc.2 변경 안내

**복사본 교정 필요(문법만, 동작 변화 없음)**: registry의 타입 전용 import를 `import type { … }`로 교정했다. rc.1 복사본의 form/ui.tsx·list-ui.tsx·ui/dialog.tsx에 같은 변경을 적용하거나 A/B/C 비교로 rc.2 원본을 반영한다. 패키지만 올리면 이미 설치한 복사본의 문법은 바뀌지 않는다. 적용 뒤 소비처 lint와 같은 적합성 검사를 다시 실행한다. 원본은 이제 `pnpm registry:lint`로 TypeScript·React 및 엄격한 타입 import 규칙을 검사한다.

## 3.1 → 4.0 이전

| 3.1 import | 4.0 위치(기본 설치 target 기준) |
|---|---|
| `@boosterlab/web-kit/ui` | registry `ui`: `@/shared/ui/web-kit/ui` |
| `@boosterlab/web-kit/list/ui` | registry `list`: `@/shared/ui/web-kit/list-ui` |
| `@boosterlab/web-kit/form/ui` | registry `form`: `@/shared/ui/web-kit/form/ui` |
| `@boosterlab/web-kit/detail/ui` | registry `record`: `@/shared/ui/web-kit/detail-ui` |
| `@boosterlab/web-kit/filter` | registry `checkbox-tree`·`filter-error`: `@/shared/ui/web-kit/CheckboxTree`·`@/shared/ui/web-kit/search/filter-error`; 순수 계산은 패키지 루트 |
| `@boosterlab/web-kit/styles.css` | registry `styles`: `@/shared/ui/web-kit/ui/styles.css` |

위 6개 패키지 입구는 제거됐다. `/choice`는 공유 선택/검색의 `useChoiceBinding`을 공개하는 새 입구다. `/dialog`는 대화창과 진행 등록 연결을, `/form`·`/list`·`/record`는 각각의 상태·연결 hook을 제공한다.

- 목록 상태 전달은 `/list`의 `ListProvider`가 기본이며 `model` props도 허용한다. 패키지 Provider는 model·children만 받고 문구·실패 표현은 registry 표시 wrapper에 둔다.
- `Period`/`PeriodFilter`의 `timeZone`·`now`는 생략 가능하다. 기본 브라우저 시간대·현재 시각을 쓰고 넘긴 값은 그대로 쓴다. 요청 날짜 변환도 같은 시간대를 쓴다.
- 부모 아래 두 leaf 중 하나만 선택했을 때 `checkboxTreeSelection.checked`는 3.1의 true에서 false로, 표시는 체크에서 `mixed`(−)로 바뀐다. 부모 클릭은 기존 선택 해제에서 모든 후손 선택으로 바뀐다. `mixed(targets)`를 indeterminate/aria-checked=mixed와 연결한다. 명시적인 set(true/false) 규칙은 유지한다. `checked`의 requireAll 인자는 타입 호환으로 받지만 이제 모두 선택됐을 때만 true다.
- 기본 Dialog 복원 교정은 패키지 갱신으로 반영된다. 중첩 대화창 위 Choice 클릭 교정은 복사본 Positioner의 `wk-choice-positioner`와 CSS 표시층도 적용해야 한다. 실제 브라우저 적합성 검사를 함께 실행한다.

기존 `selection.run`의 `{ completedIds }` 계약은 유지한다. 부분 성공은 실제 성공 ID만 반환하며 Promise 완료를 전체 성공으로 해석하지 않는다. 폼의 `references`·`secondary`·확인/완료·이탈 보장은 그대로며 정확한 사용 조건은 스킬이 정본이다.

## 개발과 검증

Node 24.19.0, 빈 NODE_OPTIONS, pnpm 10.33.0. `pnpm check`는 키트·링크·registry 일치를 확인한다. `pnpm starter:sync` 후 `pnpm starter:check`는 타입·lint·단위·빌드·브라우저·strict 지문 점검을 실행한다. 처음에는 starter의 Playwright chromium 설치가 필요하다.

[즉시 조회](../../apps/starter/src/features/products/model/list-search.ts)와 [검색 후 조회](../../apps/starter/src/features/members/model/list-search.ts)는 같은 목록 구현의 gated 값 차이다(0003 완료 기준 6). 예제는 조립 방식만 참고하고 필드·기본값·문구·권한은 프로젝트가 정한다.

발행 순서는 같은 commit 후보(패키지+registry) → starter → 실제 소비처 검증 → 교정·독립 검증 → 실서버 확인 → 정식 발행이다. [유지보수](../../docs/maintaining.md)가 기록·산출물 기준을 정한다. mock·starter 통과로 실제 소비처나 서버 계약 확인을 대신하지 않는다.

## 4.1 인증 단계 추가

| 입구 | 책임 | 연결 기준 |
|---|---|---|
| `/auth` | 로그인 전 코드 기한 계산과 단일 요청 진행 | [web-kit-auth](skills/web-kit-auth/SKILL.md) |
| registry `auth` | 코드 입력·남은 시간·재전송·만료 안내 복사본 | 설치 시 단위·브라우저 검사 연결 포함 |

기존 로그인 전 타이머와 제출 진행을 `/auth`로 옮긴다. 서버 요청·기한 값·문구·등록 흐름은 프로젝트가 제공한다. `/session/idle`의 `createServerClock` 객체를 인증 단계와 유휴 타이머에 함께 넘긴다. 기존 유휴 타이머 API는 clock을 생략해도 유지된다. starter 로그인은 코드 인증 단계가 없으므로 제품 흐름을 추가하지 않으며, 설치된 검사 화면에서 두 입력 모양을 확인한다.
