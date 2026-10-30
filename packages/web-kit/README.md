# web-kit

React 19 + TanStack(Router·Query·Form) + zod 4 + axios/orval을 쓰는 웹 프로젝트의 공용 키트다. 서버 응답 구조와 코드 의미는 프로젝트의 `ResponseContract`가 해석한다. 응답 계약은 필수 입력이며 Spring 봉투 서버는 `/http`의 `springEnvelope(results)`를 선택한다. 공통 동작은 패키지 hook·Provider가, 화면 배치는 registry로 설치한 프로젝트 소유 복사본이 맡는다. registry는 복사할 UI와 공통 검사 연결 파일의 묶음이다. 업무 정책·서버 연결 차이는 프로젝트가 정한다. 현재 제공 범위는 아래 표와 `package.json` exports다([배포 결정](references/docs/decisions/0002-distribution.md)).

정본: https://github.com/taehyung-lab/web-kit · 패키지 `@boosterlab/web-kit` · 이 문서의 대상 버전 `5.0.0-rc.5`(로컬 후보, 미발행) · 결정 기록 [docs/decisions](references/docs/decisions). 이 패키지는 저장소의 `packages/web-kit`이고, 사용 예이자 소비 검사 앱은 같은 저장소의 [`apps/starter`](references/apps/starter)다.

## 구조

목록의 결과 출처와 목록 복귀 문맥은 [용어](GLOSSARY.md)에서 구분한다.

- **core**(루트 `.`): 외부 상태나 실행 없이 입력만으로 결과를 정하는 순수 규칙이다(실패 12종 해석, 기간 검증, 체크 트리 선택, query 직렬화). `tests/core-boundary.test.ts`는 루트에서 따라가는 파일에 라이브러리 의존이 없는지만 검사한다. 순수한지는 이 정의와 검토로 판단한다. `session`처럼 라이브러리에 의존하지 않아도 실행·부수효과가 있는 코드는 core가 아니며, 자기 subpath로 공개한다.
- **책임별 입구(subpath)**: `/list`·`/form`처럼 책임별 상태·hook·Provider를 공개한다. 이름을 새로 만들 때는 [공개 입구 판단](references/docs/decisions/0002-distribution.md)를 따른다.
- **registry 복사본**: 원본은 `packages/ui-registry/src`, 정의는 루트 `registry.json`, 빌드 결과는 `public/r`에 있다. 폼·필터·표·상세 등 표현을 소비 프로젝트에 설치한다. 공통 처리 순서는 패키지가 끝내고 복사본은 반환된 ref·속성·이벤트를 연결한다. 제품 실행 코드는 registry를 import하지 않는다.
- **skills**: module별 사용 기준이다. 코드와 같은 버전으로 배포한다.

| import | 키트가 보장하는 것 | 프로젝트가 넘기는 것 |
|---|---|---|
| `.` / `/failure` | 실패 12종, 결과 코드 표, 봉투 해석 | 서버 enum의 결과 코드 행 |
| `/session` | 세대, 시작·종료와 종료 순서(정리 → 안내 → 서버 로그아웃), 다른 탭 변경, 재발급 단일 비행(Web Locks) | 저장 adapter·재발급·서버 로그아웃 호출 |
| `/session/idle` | 서버 시계·세션별 마감·탭 병합·만료·멈춤/재개 장치 | 명시 마감·0초 필수 선택·선택 활동 부착과 간격·선택 재개 유예·경고 UI([web-kit-http](skills/web-kit-http/SKILL.md)) |
| `/auth` + registry `auth` | 코드 기한·종류별 단일 요청·늦은 응답 격리, 입력 오류·만료·재전송 표현 | 공유 시계·기한·자리수·서버 요청·성공 처리·문구 |
| `/session/browser` | 브라우저 저장 장애 복구·외부 이벤트 판별·해제 | 저장 key·동기 schema·읽기 불가 정책 |
| `/http` | 헤더·토큰, 필수 응답 계약·선택 Spring 해석, 401 재발급 뒤 한 번 재전송, 반영 여부 판정 | 응답 해석·코드 의미·공개 경로·운영 헤더·axios 기본값 |
| `/query` | 재시도 대상, 실패 알림 한 번, 선언한 무효화, 민감한 쓰기의 입력값 기록 지움, 세션 전환 시 비움 | 재시도 횟수, 알림 표시, staleTime 등 수치 |
| `/search` · `/list` | URL 검색 상태·검색 확정·선택 수명([web-kit-list](skills/web-kit-list/SKILL.md)) | 필드 schema·encode·기본값·조회 시작 조건·첫 정렬 방향, 조회 함수, 다운로드 요청 |
| `/list` + registry `list` | `ListProvider`·`useListModel`과 필터·기간·키워드·표·페이지·일괄 확인·다운로드 연결 hook | model, 필드·컬럼·배치·문구·실패 표현 |
| `/permission` | 진입 거부·메뉴 숨김·버튼 비활성의 닫힘 기본 판정 | 권한 상태·판정 함수·권한 목록 |
| 루트 + registry `checkbox-tree`·`filter-error` | 순수 기간·트리 계산과 오류/트리 표현 연결 | checkbox·문구·스타일 |
| `/form` · `/dialog` + registry `form`·`dialog` | 제출·확인·저장·기준선·오류·늦은 결과·이탈의 hook/Provider; 복사본 Form·FormGuard·Dialog | schema·원본·저장·완료 동작·배치·문구 |
| `/record` + registry `record`·`retry` | 단건 상태·갱신 실패·재시도 focus·마스킹; 복사본 Record·항목·이력 | queryOptions·항목·노출 정책·실패 문구 |
| `/choice` · `/dialog` + registry `inputs`·`choice`·`dialog`·`pending`·`blocking-progress` | 공통 선택·검색·대화창 포커스·진행 등록 hook과 기본 표현 | 값·문구·셸 배치·업무 행동 |
| `/api` | Spring query 직렬화 | 적용 endpoint |
| `/testing` · `/testing/unit`(기능별 하위 입구 포함) · `/testing/browser` · `/testing/fixtures` | adapter 검사, 복사본 단위·브라우저 적합성 기준·검사 화면 | 실제 복사본·연결 파일·실행 대상 버전 |
| `/testing/session` | 저장 실패·다른 탭 변경·종료의 adapter 검사(React/Form import 없음) | 자기 저장 adapter와 격리된 검사 환경 |

React·ReactDOM은 필수 peer(소비 앱이 설치하는 동료 라이브러리)이고 TanStack·axios와 검사 러너는 선택 설치다. 각 책임에서 쓰는 의존은 package.json을 따른다. Base UI는 패키지 peer가 아니라 registry 항목 의존이며 react-virtual은 `/list`의 가상 행 hook 때문에 남는다. 설치하지 않은 선택 기능은 "검사하지 않음"으로 기록한다. 루트가 React를 import하지 않는 것과 React 없는 독립 패키지는 다르다.

## 스킬

| 스킬 | 언제 읽나 |
|---|---|
| `web-kit-auth` | 로그인 전 코드 인증·기한·재전송·인증 요청 진행 |
| `web-kit-http` | API 호출, 실패, 재발급, 로그인/로그아웃, QueryClient, 무효화 |
| `web-kit-list` | 목록 검색·조회·선택·일괄 작업·엑셀 다운로드 흐름·목록 부품 |
| `web-kit-permission` | 경로 진입 차단·메뉴 숨김·버튼 비활성 연결 |
| `web-kit-form` | 등록·수정 폼(줄 추가·삭제 입력 포함), 확인 실행 |
| `web-kit-record` | 상세·수정 원본 단건 |

프로젝트는 설치본의 스킬을 `.agents/skills/`에 링크하고, 업무 정책 문서와 읽는 순서는 자기 AGENTS.md 지도에 둔다. 키트 문장을 프로젝트 문서에 복사하지 않는다. 링크 기준은 web-kit 의존성을 선언한 패키지의 `node_modules`다(monorepo에서 루트 호이스팅에 기대지 않는다). 예: 저장소 루트에서 `PKG=apps/admin`(단일 패키지면 `PKG=.`).

기능 선택은 [소비 안내의 선택 표](docs/consuming.md#기능을-골라-쓰기)에서 시작한다. 스킬의 예제 링크는 설치 패키지 안의 자동 생성 `references/`로 이어진다. 원본은 실제 starter이며 예제 복사본을 직접 수정하지 않는다. 코드 예제는 읽기용 `.txt`로 담아 검사 러너가 복사본을 실행하지 않게 한다.

기존 코드 교체와 저장 adapter 검사는 [소비 안내](docs/consuming.md)를 따른다.

```sh
mkdir -p .agents/skills
for skill in "$PKG"/node_modules/@boosterlab/web-kit/skills/web-kit-*; do
  [ -f "$skill/SKILL.md" ] || continue
  name="${skill##*/}"
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

책임 단위로 필요한 부분만 채택한다. 한 책임 안에서는 키트의 상태 수명·이벤트 처리와 자체 구현을 섞지 않는다. 배치와 디자인은 설치한 복사본에서 바꾸고 공통 동작은 패키지 hook으로 연결한다.

1. 검증된 같은 commit의 패키지 tarball(tgz 압축 파일)과 registry를 선택한다. 기존 시험판 `4.1.0`의 산출물은 tag `v4.1.0`에 있다. 발행 전 후보 검사는 저장소의 로컬 산출물을 사용한다.
2. tgz를 `vendor/`에 보관하고 설치한다. 대부분 소스 TS/TSX이므로 Vite/TypeScript가 컴파일하며 Vite에는 `optimizeDeps: { extensions: ['.tsx'] }`를 둔다. Playwright 검사 입구는 Node가 실행할 수 있는 mjs다.

```sh
pnpm add @boosterlab/web-kit@file:vendor/boosterlab-web-kit.tgz
```

3. 소비 프로젝트 `components.json`에 같은 버전 tag로 고정한 namespace(항목 이름의 출처)를 둔다. `@web-kit/form`은 이 주소의 form.json을 뜻한다.

```json
{
  "registries": {
    "@web-kit": "https://raw.githubusercontent.com/taehyung-lab/web-kit/v4.1.0/public/r/{name}.json"
  }
}
```

4. shadcn 4.19.1 CLI로 필요한 항목을 먼저 확인한 뒤 설치한다. 항목은 검사 도구(vitest·Testing Library·Playwright)를 정확한 버전의 devDependencies로 설치해 기존 버전을 바꿀 수 있으므로, `shadcn add --dry-run`으로 바뀔 의존 버전과 lockfile 영향을 먼저 확인한다. 기존 프로젝트는 자기 변경과 차이를 확인한다. `--overwrite`를 갱신 기본값으로 쓰지 않는다.

```sh
pnpm dlx shadcn@4.19.1 add @web-kit/form --dry-run
pnpm dlx shadcn@4.19.1 add @web-kit/form
```

항목의 npm·registry 의존과 단위/브라우저 검사 연결 파일도 함께 설치한다. UI는 `src/shared/ui/web-kit`에 생긴다. 기본 스타일은 설치한 `ui/styles.css`를 앱에서 한 번 import한다. 예: `@/shared/ui/web-kit/form/ui`의 Form, `@boosterlab/web-kit/form`의 useSaveForm.

5. 설치 기록을 남긴다. 패키지 `version`, registry `sourceRef`·`sourceCommit`, 항목 이름, 원본 JSON/파일 SHA-256, 원본→설치 경로, **설치 직후** 파일의 `installedHash`, 사용한 CLI·components 설정 지문을 기록한다. SHA-256은 파일 내용이 같은지 비교하는 지문이다. CLI가 import나 별칭을 바꿀 수 있어 원본과 설치 지문을 같은 값으로 가정하지 않는다. 실제 형식은 [설치 기록](references/apps/starter/registry-installation.json), 로컬 후보 설치·기록 예는 [설치 스크립트](references/scripts/install-starter-registry.mjs.txt)를 참고한다. 이 스크립트는 이 저장소 starter 전용이며 일반 프로젝트 갱신 명령이 아니다.
6. 설치한 스킬을 링크하고, 함께 설치한 검사 연결을 자기 CI에서 실행한다. [소비 안내](docs/consuming.md#복사본-적합성-검사)의 `web-kit-check`를 필수 단계로 둔다. package.json·lockfile·tgz·복사본·설치 기록·검사 연결을 함께 관리한다.

설치 기록의 installed 경로는 기록 파일이 있는 프로젝트 루트 기준으로 쓴다(starter의 기존 `apps/starter/` 접두도 점검기가 읽는다). 원본 commit은 받은 registry의 commit이며 소비 프로젝트의 현재 commit과 혼동하지 않는다. 다른 버전 조합을 검증 없이 섞지 않는다.

### 복사본 갱신

이전 원본 **A**, 받을 새 원본 **B**, 프로젝트가 고친 현재 복사본 **C**를 비교한다. 설치 기록으로 A의 tag/commit과 파일을 찾고 A와 B를 같은 CLI·설정으로 별도 작업 폴더에 설치한다. A→B는 키트 교정, A→C는 프로젝트 수정이다. 두 차이를 비교해 C의 디자인·업무 연결을 보존하며 필요한 교정을 적용한다. 충돌은 파일을 보존해 검토한다. `shadcn add --diff`는 C와 B의 차이만 보여 주므로 세 방향 비교를 대신하지 않는다.

적용 뒤 새 설치·검증 기록을 남기고 같은 단위·브라우저·점검 명령을 실행한다. 되돌릴 때는 이전 tgz·lockfile·복사본·설치 기록을 함께 복원한다. 변경 안내는 매번 **패키지만 올리면 반영 / 복사본 교정 필요**를 구분한다.

## 개발과 검증

Node 24.19.0, 빈 NODE_OPTIONS, pnpm 10.33.0. `pnpm check`는 키트·링크·registry 일치를 확인한다. `pnpm starter:sync` 후 `pnpm starter:check`는 타입·lint·단위·빌드·브라우저·strict 지문 점검을 실행한다. 처음에는 starter의 Playwright chromium 설치가 필요하다.

[즉시 조회](references/apps/starter/src/features/products/model/list-search.ts.txt)와 [검색 후 조회](references/apps/starter/src/features/members/model/list-search.ts.txt)는 같은 목록 구현의 gated 값 차이다([유지보수 완료 기준 6](references/docs/maintaining.md#완료-기준)). 예제는 조립 방식만 참고하고 필드·기본값·문구·권한은 프로젝트가 정한다.

발행 순서는 같은 commit 후보(패키지+registry) → starter → 실제 소비처 검증 → 교정·독립 검증 → 실서버 확인 → 정식 발행이다. [유지보수](references/docs/maintaining.md)가 기록·산출물 기준을 정한다. mock·starter 통과로 실제 소비처나 서버 계약 확인을 대신하지 않는다.

## 인증 단계 연결

| 입구 | 책임 | 연결 기준 |
|---|---|---|
| `/auth` | 로그인 전 코드 기한 계산과 단일 요청 진행 | [web-kit-auth](skills/web-kit-auth/SKILL.md) |
| registry `auth` | 코드 입력·남은 시간·재전송·만료 안내 복사본 | 설치 시 단위·브라우저 검사 연결 포함 |

기존 로그인 전 타이머와 제출 진행을 `/auth`로 옮긴다. 서버 요청·기한 값·문구·등록 흐름은 프로젝트가 제공한다. `/session/idle`의 `createServerClock` 객체를 인증 단계와 유휴 타이머에 함께 넘긴다. 기존 유휴 타이머 API는 clock을 생략해도 유지된다. starter 로그인은 코드 인증 단계가 없으므로 제품 흐름을 추가하지 않으며, 설치된 검사 화면에서 두 입력 모양을 확인한다.

유휴 타이머의 멈춤·재개 연결과 기존 저장값·정책 입력 이전은 [소비 안내](docs/consuming.md#시험판에서-옮겨-오기)와 [web-kit-http](skills/web-kit-http/SKILL.md)를 따른다.
