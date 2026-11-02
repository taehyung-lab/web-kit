# admin-web-starter

web-kit의 실행 예이자 포장 산출물 소비 검사 앱이다. 공통 동작은 vendor tarball, 화면은 registry에서 실제 설치한 복사본으로 사용한다. 예시 필드·문구·업무 규칙은 제품 정책이 아니다.

## 빠른 시작

Node 24.19.0, pnpm 10.33.0. 저장소 루트에서 실행한다.

```sh
pnpm starter:sync
pnpm --dir apps/starter dev:mock
```

mock 계정은 `admin` / `password`다. 새 프로젝트를 만들려면 [생성 안내](../../docs/starting.md)를 따른다. 이 검사 앱 자체에는 AWK를 따로 설치하지 않고 저장소 루트 기준을 쓴다.

## 검사

`pnpm starter:check`는 현재 후보 일치 확인 후 타입·lint·빌드·전체 단위·브라우저·strict 적합성을 실행한다. 처음에는 앱 폴더에서 `pnpm exec playwright install chromium`이 필요하다. 검사 실행 선언은 [web-kit.check.json](web-kit.check.json)이다.

`pnpm conformance:check`는 단위·브라우저를 새로 실행하고 현재 입력과 결과를 묶는다. 일반 소비처와 달리 starter는 원본 그대로를 확인하므로 복사본 지문 변경도 실패한다. 사용 UI와 검사 대상의 일치는 별도 검토한다.

## 필요한 문서

| 하려는 일 | 읽을 곳 |
|---|---|
| 구조·스택·예제와 검사 범위 | [예제 안내](docs/examples.md) |
| 실제 서버 명세·인증 연결 | [서버 연결](docs/server.md) |
| 공용 기능 선택과 프로젝트 책임 | [소비 안내](../../packages/web-kit/docs/consuming.md) |
| UI 설치·수정본 보존·출처 기록 | [설치 안내](../../packages/web-kit/docs/installing.md) |
| 새 검사 실행·필수 결과 판정 | [검사 안내](../../packages/web-kit/docs/checking.md) |
| 시험판의 제거된 입구 이전 | [이전 안내](../../packages/web-kit/docs/migrating.md) |

키트를 바꾸면 같은 PR에서 vendor tarball·lockfile·사용 코드를 맞춘다. UI 원본을 바꾸면 루트의 `pnpm registry:build`와 `node scripts/install-starter-registry.mjs`로 검사 앱 복사본·설치 기록을 맞춘 뒤 다시 검사한다. 이 재설치는 검사 앱용으로 원본을 덮어쓰므로 일반 프로젝트 갱신에는 설치 안내의 비교 절차를 쓴다.

현재 registry는 같은 checkout의 로컬 후보를 사용한다. 아직 정식 발행하지 않았으며 mock·starter 통과가 실제 서버 통과를 뜻하지 않는다. [발행 조건](../../docs/maintaining.md#완료-기준)은 별도로 확인한다.
