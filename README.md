# web-kit

React 19 관리자 웹 프로젝트가 함께 쓰는 공통 동작·입력 컴포넌트·사용 계약이다.
정본: https://github.com/taehyung-lab/web-kit · 패키지: `@boosterlab/web-kit` · 현재 버전: `0.3.0`.

## 제공하는 공용 기능

| import | 제공 기능 | 프로젝트가 제공하는 것 |
|---|---|---|
| `/list` | `useDraftCommit`, `usePageSelection`: 검색 초안·현재 페이지 선택 수명 | 초안 모양, URL 정체성, 검색 확정/페이지 정책 |
| `/filter` | URL 필드별 복구, 기간·사용자 검증, 접근 가능한 FilterError, CheckboxTree와 선택 엔진 | 기본값·schema·기간 변환·문구·스타일·control |
| `/form` | 전체 검증 후 제출, 서버 오류 제거/배치, 번역 참조 codec | 필드 순서/동적 경로, 번역 참조, 저장 잠금·이탈·성공 이동 |
| `/detail`, `/detail/ui` | 필수 단건 상태 판정, DetailField의 dt/dd 표현 | queryOptions·오류 분류·placeholder·상태 UI |
| `/api` | Spring 재귀 query 및 엄격한 목록 query 직렬화 | endpoint·request wrapper·응답 봉투·오류 코드·토큰·QueryClient |

루트 import는 0.1.0 목록/필터 공개 항목과 호환된다. React는 peer이며 번들에 포함하지 않는다. `/api`, `/detail`은 React를 import하지 않는다. `/form`의 TanStack Form 1.33.5 peer는 해당 기능을 사용하는 앱만 필요하다.

## 사용 기준

[공통 사용 계약](docs/contracts.md)이 목록/필터·폼·상세·API별 사용 순서와 검사 기준의 정본이다. 프로젝트 역할 스킬은 설치된 패키지의 해당 절을 먼저 읽고 로컬 adapter와 업무 조합을 지시한다. 키트에는 프로젝트별 조합 문서를 복제하지 않는다.

## 설치와 업그레이드

소스 TS/TSX 패키지다. 소비 앱의 Vite/TypeScript가 컴파일한다. 두 앱은 같은 GitHub release tarball을 `vendor/`에 보관해 개발자 로컬 경로나 설치 시 GitHub 인증에 의존하지 않는다. vendor 내부는 수정하지 않는다.

```sh
gh release download v0.3.0 --repo taehyung-lab/web-kit --pattern 'boosterlab-web-kit-0.3.0.tgz' --dir vendor
pnpm add @boosterlab/web-kit@file:vendor/boosterlab-web-kit-0.3.0.tgz
```

monorepo 하위 package에서는 manifest 위치에 맞는 상대 경로를 사용한다. package.json·lockfile·tarball을 함께 commit한다. 소스 복사·git submodule·branch 최신값 의존성은 사용하지 않는다.

공통 변경은 이 저장소에서 검사하고 버전을 올린다. `pnpm pack --pack-destination <dir>`로 산출물을 만들고 같은 소스 commit에 `v<version>` 태그와 GitHub release를 발행한다. 이후 두 앱 adapter의 typecheck·test·build를 확인하고 각각 버전을 올린다. 되돌릴 때도 이전 release 의존성과 lockfile을 함께 복원한다.

## 개발과 검증

Node 24.19.0, pnpm 10.33.0을 사용한다.

```sh
pnpm install --frozen-lockfile
pnpm check
```

키트 계약 검사와 양쪽 실제 소비자 검사는 서로 보완한다. 저장소 CI는 키트 계약을 검사하며, 실제 화면·URL·요청 mock 검사는 DT/reference에서 실행한다. 실제 서버 수용이나 브라우저 E2E를 대신하지 않는다.
