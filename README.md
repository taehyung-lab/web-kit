# web-kit

관리자 웹의 공용 키트와, 그 키트로 만든 시작용 앱을 함께 관리하는 저장소다. 범위·구조·완료 기준은 [4.0 배포 결정](docs/decisions/0011-web-kit-4-ui-distribution.md)와 [재설계 완료 기준](docs/decisions/0003-web-kit-3-redesign.md)이 정한다.

```
packages/web-kit   @boosterlab/web-kit — 공통 상태·hook·Provider·적합성 검사·web-kit-check
packages/ui-registry  프로젝트에 복사할 UI와 검사 연결 원본
registry.json / public/r  설치 항목 정의 / 같은 commit에서 빌드한 배포 JSON
apps/starter       새 관리자 웹의 틀이자 키트 소비 검사 앱. 동작은 tarball, UI는 실제 registry 설치 복사본으로 쓴다
docs/              결정 기록(decisions/)과 변경·발행 기준(maintaining.md)
scripts/           starter 맞추기, registry 일치·문서 링크 검사, 검증 기록
```

## 명령

Node 24.19, pnpm 10.33.

| 명령 | 하는 일 |
|---|---|
| `pnpm install` | 키트 개발 의존성 설치(workspace는 `packages/*`만) |
| `pnpm check` | 키트 타입·동작, 문서 링크, registry 원본/산출물 일치와 스크립트 검사 |
| `pnpm starter:sync` | 키트를 포장해 starter에 설치하고 starter lockfile의 키트 지문을 갱신한다. 키트를 바꾼 뒤 실행하고 결과를 같은 PR에 넣는다 |
| `pnpm starter:check` | starter가 지금 키트에 맞춰져 있는지 확인한 뒤 starter `check`를 돌린다. 단위·브라우저·빌드·복사본 strict 지문과 적합성 점검까지 포함한다 |

## 새 프로젝트 시작

1. 검증한 버전의 `apps/starter`를 새 저장소로 복사한다. 현재 `4.1.0-rc.1`은 후보이며 원격 정식 발행 전이다.
2. 발행된 키트를 받는다: `gh release download v<버전> --repo taehyung-lab/web-kit --pattern 'boosterlab-web-kit-<버전>.tgz' --dir vendor` 후 `package.json`의 `@boosterlab/web-kit`을 `file:vendor/boosterlab-web-kit-<버전>.tgz`로 바꾸고 `pnpm install`.
3. [4.0 설치 안내](packages/web-kit/README.md#설치와-업그레이드)에 따라 같은 commit의 registry를 `components.json`의 tag 고정 URL로 연결하고 shadcn 4.19.1로 필요한 항목을 설치한다. 설치 기록과 함께 설치한 검사 연결 파일을 관리한다.
4. [agent-workflow-kit](https://github.com/taehyung-lab/agent-workflow-kit)을 버전 태그로 설치하고 `AGENTS.md`의 프로젝트 지도를 그 저장소 사실로 채운다(모르는 것은 `미확인`).
5. Playwright chromium을 설치하고 `pnpm check`로 자기 복사본의 단위·브라우저·web-kit-check를 확인한 뒤 예시 기능을 실제 화면으로 바꾼다. 조립 방식만 참고하며 필드·기본값·문구·권한은 프로젝트 근거로 정한다.

책임 단위로 일부만 채택할 수 있고 한 책임 안에서는 키트·자체 수명 처리를 섞지 않는다. [3.1 → 4.0 이전](packages/web-kit/README.md#31--40-이전)과 [복사본 갱신](packages/web-kit/README.md#복사본-갱신)을 따른다. 발행은 후보 → starter → 실제 소비처 → 교정·독립 검증 → 실서버 확인 → 정식 발행 순서다. [유지보수](docs/maintaining.md)가 세부 기준을 정한다.
