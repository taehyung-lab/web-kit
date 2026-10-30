# web-kit

관리자 웹의 공용 키트와, 그 키트로 만든 시작용 앱을 함께 관리하는 저장소다. 범위·책임은 [공용 구조](docs/decisions/0003-web-kit-3-redesign.md), UI 소유·배포 이유는 [4.0 결정](docs/decisions/0011-web-kit-4-ui-distribution.md), 완료·발행 조건은 [유지보수](docs/maintaining.md)가 정한다.

```
packages/web-kit   @boosterlab/web-kit — 공통 상태·hook·Provider·적합성 검사·web-kit-check
packages/ui-registry  프로젝트에 복사할 UI와 검사 연결 원본
registry.json / public/r  설치 항목 정의 / 같은 commit에서 빌드한 배포 JSON
apps/starter       새 관리자 웹의 틀이자 키트 소비 검사 앱. 동작은 tarball, UI는 실제 registry 설치 복사본으로 쓴다
docs/              결정 기록(decisions/)과 변경·발행 기준(maintaining.md)
scripts/           starter 맞추기, registry 일치·문서 링크 검사, 검증 기록
```

starter는 기본 연결과 조립 예이며 모든 프로젝트의 고정 페이지가 아니다. 프로젝트는 기능별로 선택해 쓰고 자기 업무·서버 계약·화면을 소유한다. [페이지 일부만 다른 경우](docs/decisions/0003-web-kit-3-redesign.md#페이지-일부만-다른-경우)의 책임 구분을 따른다. 공용 수정은 패키지 업데이트로 받되, UI 복사본 교정이 필요한 변경은 프로젝트 수정과 대조해 적용한다.

최신 발행: web-kit `4.1.0`(tag `v4.1.0`, 패키지 tgz·registry `public/r`가 같은 commit). 함께 쓰는 agent-workflow-kit(AWK)은 tag `v1.0.0`(= commit `c55ccc2`)이다. 4.0.0은 따로 발행하지 않았다.

## 명령

Node 24.19, pnpm 10.33.

| 명령 | 하는 일 |
|---|---|
| `pnpm install` | 키트 개발 의존성 설치(workspace는 `packages/*`만) |
| `pnpm check` | 키트 타입·동작, 문서 링크, registry 원본/산출물 일치와 스크립트 검사 |
| `pnpm starter:sync` | 키트를 포장해 starter에 설치하고 starter lockfile의 키트 지문을 갱신한다. 키트를 바꾼 뒤 실행하고 결과를 같은 PR에 넣는다 |
| `pnpm starter:check` | starter가 지금 키트에 맞춰져 있는지 확인한 뒤 starter `check`를 돌린다. 단위·브라우저·빌드·복사본 strict 지문과 적합성 점검까지 포함한다 |

## 새 프로젝트 시작

내부 `apps/starter`를 실행 가능한 예시 앱으로 복사한다. 기능별 선택 방식은 [소비 안내](packages/web-kit/docs/consuming.md#기능을-골라-쓰기)를 따른다. 최소 빈 앱이나 프로젝트별 템플릿을 여러 개 만들지 않는다.

```sh
pnpm starter:create ../my-web --workflow-kit /path/to/agent-workflow-kit
```

대상은 아직 없는 폴더여야 한다. AWK는 tag `v1.0.0`의 깨끗한 checkout을 지정한다(`git clone --branch v1.0.0 https://github.com/taehyung-lab/agent-workflow-kit`). `scripts/starter/agent-workflow-kit.version`에는 그 tag의 커밋 `c55ccc2dc1f6616979e2f904dac738efbcb35bc3`이 적혀 있다. 명령은 checkout의 HEAD가 이 커밋인지 확인하고, checkout에 `v1.0.0` tag가 있으면 그 tag도 같은 커밋으로 해소되는지 확인한다. 이 명령은 원격 다운로드·Git 초기화·의존성 설치·발행을 하지 않는다.

명령은 현재 패키지와 starter vendor/lockfile의 일치를 먼저 확인한다. 다른 경우 유지보수자가 `pnpm starter:sync`와 `pnpm starter:check`로 후보를 맞춘다. 새 폴더에는 AWK, web-kit 스킬, 프로젝트 지도, 프로젝트용 README·CI가 들어간다. 로컬 비밀·의존성·빌드·실행 결과와 추적되지 않은 파일은 복사하지 않는다. 검사 앱의 strict 지문 검사는 유지하고 새 프로젝트에는 정상 UI 수정이 가능한 소비 검사 모드를 적용한다.

생성한 폴더에서 다음을 실행한다.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
pnpm dev:mock
```

후보의 registry tag가 발행되지 않았다면 복사된 UI로만 로컬 확인한다. 새 항목 설치·갱신은 검증된 tag 발행 뒤 [설치 안내](packages/web-kit/README.md#설치와-업그레이드)를 따른다. 새 프로젝트의 사용 스킬은 설치 패키지 안의 예제까지 읽을 수 있다.

발행은 후보 → starter → 실제 소비처 → 교정·독립 검증 → 실서버 확인 → 정식 발행 순서다. [유지보수](docs/maintaining.md)가 세부 기준을 정한다.
