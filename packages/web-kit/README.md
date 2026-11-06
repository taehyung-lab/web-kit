# web-kit

web-kit은 React·TanStack(Query·Router·Form) 위에서 관리자 웹의 공통 동작(요청·세션·폼·목록·단건·권한)을 맡는 패키지와, 그 동작을 연결한 shadcn(Base UI)·Tailwind 복사용 UI 부품을 주는 키트다.

React 19·TanStack·zod 4·axios/orval을 쓰는 관리자 웹의 공용 키트다. 공통 상태와 처리 순서는 패키지가, 화면 배치와 업무·서버 정책은 프로젝트가 맡는다. UI는 registry(복사할 화면 소스와 검사 연결 묶음)로 설치해 프로젝트가 소유한다.

패키지는 `@boosterlab/web-kit`, 현재 버전은 `5.0.0-rc.13`(미발행 후보)이다. 정확한 공개 입구·의존 버전은 [package.json](package.json), 동작 보장은 같은 버전의 스킬이 정본이다.

## 구조

- **core**는 외부 상태나 실행 없이 입력만으로 결과를 정하는 순수 규칙이며 루트 `.`로 공개한다.
- **책임별 입구**는 `/form`·`/list`처럼 필요한 상태·hook·Provider만 선택해 쓴다.
- **UI 복사본**은 프로젝트가 배치·디자인을 바꾸고 공통 hook의 상태·이벤트를 연결한다.
- **구조 계약**은 소비 앱의 폴더 책임과 import 방향이다. 규칙은 개발 도구 입구 `/structure`(ESLint preset), 검사는 `web-kit-structure`·`web-kit-check --structure`, 골격은 `web-kit-new`가 맡는다. 런타임 소비에는 포함되지 않는다([web-kit-structure](skills/web-kit-structure/SKILL.md)).
- **AWK**는 웹과 무관한 작업 판단·검증 방법을 맡는다. 웹 사용법은 이 키트가 소유한다.

[책임별 입구와 프로젝트 입력](docs/modules.md), [용어](GLOSSARY.md), [배포 결정](references/docs/decisions/0002-distribution.md)에서 상세 구분을 찾는다. 기능별 결정 이유는 [범위](references/docs/decisions/0001-scope-and-boundaries.md)·[응답·실패](references/docs/decisions/0003-request-response-failure.md)·[세션](references/docs/decisions/0004-session-lifetime.md)·[로그인 인증 단계](references/docs/decisions/0005-auth-challenge.md)·[목록·선택·권한](references/docs/decisions/0006-list-choice-permission.md)·[폼·상세·대화창·진행](references/docs/decisions/0007-form-record-dialog-progress.md) 결정 기록에 있다. React·ReactDOM은 필수 peer이며 TanStack·axios·검사 러너는 선택 기능에 맞춰 설치한다.

## 시작과 갱신

| 하려는 일 | 안내 |
|---|---|
| 필요한 기능만 고르기·기존 구현 교체 | [소비 안내](docs/consuming.md) |
| 패키지·UI 설치, 스킬 링크, 설치 기록 | [설치 안내](docs/installing.md) |
| 프로젝트 수정을 보존하며 UI 갱신 | [복사본 갱신](docs/installing.md#복사본-갱신) |
| 현재 파일에서 새 검사 실행·결과 확인 | [검사 안내](docs/checking.md) |
| 옛 시험판에서 현재 입구로 이전 | [이전 안내](docs/migrating.md) |
| 키트 개발·검증·발행 | [유지보수](references/docs/maintaining.md) |

## 스킬

| 책임 | 읽을 스킬 |
|---|---|
| 요청·실패·세션·QueryClient | [web-kit-http](skills/web-kit-http/SKILL.md) |
| 로그인 전 코드 인증·기한·재전송 | [web-kit-auth](skills/web-kit-auth/SKILL.md) |
| 목록 검색·선택·일괄 작업·다운로드 | [web-kit-list](skills/web-kit-list/SKILL.md) |
| 등록·수정·확인·이탈 보호 | [web-kit-form](skills/web-kit-form/SKILL.md) |
| 상세·수정 원본 단건 | [web-kit-record](skills/web-kit-record/SKILL.md) |
| 진입·메뉴·버튼 권한 | [web-kit-permission](skills/web-kit-permission/SKILL.md) |
| 폴더 책임·import 방향·route 파일·구조 lint·화면 골격 | [web-kit-structure](skills/web-kit-structure/SKILL.md) |

[스킬 연결](docs/installing.md#스킬-연결)은 의존성을 선언한 패키지의 설치본을 가리킨다. 제품 정책·서버 계약·반복되는 제품 고유 판단은 프로젝트에 둔다. 사용 예는 같은 버전의 [starter](references/apps/starter)에서 가져온 읽기용 자료이며 실제 서버 검증을 대신하지 않는다.
