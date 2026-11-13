# web-kit

web-kit은 React·TanStack(Query·Router·Form) 위에서 관리자 웹의 공통 동작(요청·세션·폼·목록·단건·권한)을 맡는 패키지와, 그 동작을 연결한 shadcn(Base UI)·Tailwind 복사용 UI 부품을 주는 키트다.

관리자 웹의 공용 키트와, 그 키트로 만든 시작용 앱을 함께 관리하는 저장소다. 범위·책임은 [공용 구조](docs/decisions/0001-scope-and-boundaries.md), UI 소유·배포 이유는 [배포 결정](docs/decisions/0002-distribution.md), 완료·발행 조건은 [유지보수](docs/maintaining.md)가 정한다.

```
packages/web-kit   @boosterlab/web-kit — 공통 상태·hook·Provider·적합성 검사·web-kit-check
packages/ui-registry  프로젝트에 복사할 UI와 검사 연결 원본
registry.json / public/r  설치 항목 정의 / 같은 commit에서 빌드한 배포 JSON
apps/starter       새 관리자 웹의 틀이자 키트 소비 검사 앱. 동작은 tarball, UI는 실제 registry 설치 복사본으로 쓴다
docs/              결정 기록(decisions/)과 변경·발행 기준(maintaining.md)
scripts/           starter 맞추기, registry 일치·문서 링크 검사, 검증 기록
```

응답 해석은 소비 프로젝트의 필수 입력이다. Spring 봉투 서버는 `/http`의 `springEnvelope(results)`를 선택한다. 자세한 이전 연결은 [이전 안내](packages/web-kit/docs/migrating.md)를 따른다.

starter는 기본 연결과 조립 예이며 모든 프로젝트의 고정 페이지가 아니다. 프로젝트는 기능별로 선택해 쓰고 자기 업무·서버 계약·화면을 소유한다. [페이지 일부만 다른 경우](docs/decisions/0001-scope-and-boundaries.md#페이지-일부만-다른-경우)의 책임 구분을 따른다. 공용 수정은 패키지 업데이트로 받되, UI 복사본 교정이 필요한 변경은 프로젝트 수정과 대조해 적용한다.

**5.0.0이 첫 정식 기준이며, 그 전 버전(태그 v0.x–v4.1.0)은 시험판이다.** 현재 패키지는 `5.1.0-rc.6` 로컬 후보이며 아직 정식 발행하지 않았다. 새 프로젝트에 설치하는 agent-workflow-kit(AWK)은 [scripts/starter/agent-workflow-kit.version](scripts/starter/agent-workflow-kit.version)에 고정한 커밋이다. 이 저장소 자체의 작업 기준은 [.agents/agent-workflow-kit.version](.agents/agent-workflow-kit.version)의 고정 버전을 따른다.

## 명령

Node 24.19, pnpm 10.33.

| 명령 | 하는 일 |
|---|---|
| `pnpm install` | 키트 개발 의존성 설치(workspace는 `packages/*`만) |
| `pnpm check` | 키트 타입·동작, 문서 링크, registry 원본/산출물 일치와 스크립트 검사 |
| `pnpm starter:sync` | 키트를 포장해 starter에 설치하고 starter lockfile의 키트 지문을 갱신한다. 키트를 바꾼 뒤 실행하고 결과를 같은 PR에 넣는다 |
| `pnpm starter:check` | starter가 지금 키트에 맞춰져 있는지 확인한 뒤 starter `check`를 돌린다. 단위·브라우저·빌드·복사본 strict 지문과 적합성 점검까지 포함한다 |
| `pnpm --dir apps/starter exec web-kit-structure` | starter의 구조 계약 결과만 본다(starter `check`의 web-kit-check에도 `--structure`로 포함) |

## 새 프로젝트 시작

실행 가능한 예시 앱 전체로 시작한다. 고정 AWK checkout과 생성·검사 순서는 [새 프로젝트 시작](docs/starting.md)을 따른다. 필요한 기능만 기존 앱에 넣으려면 [선택 사용](packages/web-kit/docs/consuming.md#기능을-골라-쓰기)과 [설치 안내](packages/web-kit/docs/installing.md)로 간다.

## 문서 찾기

| 하려는 일 | 읽을 곳 |
|---|---|
| 공통 책임과 프로젝트 책임 구분 | [구조 결정](docs/decisions/0001-scope-and-boundaries.md) |
| 공개 입구·기능 선택 | [패키지 안내](packages/web-kit/README.md) |
| 설치·복사본 갱신·출처 기록 | [설치 안내](packages/web-kit/docs/installing.md) |
| 현재 복사본에서 새 검사 실행 | [검사 안내](packages/web-kit/docs/checking.md) |
| 시험판의 제거된 입구 이전 | [이전 안내](packages/web-kit/docs/migrating.md) |
| 키트 변경·소비 검사·발행 | [유지보수](docs/maintaining.md) |
