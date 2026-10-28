# web-kit

관리자 웹의 공용 키트와, 그 키트로 만든 시작용 앱을 함께 관리하는 저장소다. 범위·구조·완료 기준은 [0003 재설계 결정](docs/decisions/0003-web-kit-3-redesign.md)이 정한다.

```
packages/web-kit   @boosterlab/web-kit — 공통 동작과 기본 UI. 사용법은 packages/web-kit/README.md
apps/starter       새 관리자 웹의 틀이자 키트 소비 검사 앱. 키트를 포장한 tarball로만 쓴다
docs/              결정 기록(decisions/)과 변경·발행 기준(maintaining.md)
scripts/           starter 맞추기, 검증 기록
```

## 명령

Node 24.19, pnpm 10.33.

| 명령 | 하는 일 |
|---|---|
| `pnpm install` | 키트 개발 의존성 설치(workspace는 `packages/*`만) |
| `pnpm check` | 키트 typecheck·test와 스크립트 검사 |
| `pnpm starter:sync` | 키트를 포장해 starter에 설치하고 starter lockfile의 키트 지문을 갱신한다. 키트를 바꾼 뒤 실행하고 결과를 같은 PR에 넣는다 |
| `pnpm starter:check` | starter가 지금 키트에 맞춰져 있는지 확인한 뒤 starter `check`를 돌린다. 브라우저 검사는 `apps/starter`에서 `pnpm test:e2e` |

## 새 프로젝트 시작

1. `apps/starter`를 새 저장소로 복사한다(예: `npx degit taehyung-lab/web-kit/apps/starter my-admin`).
2. 발행된 키트를 받는다: `gh release download v<버전> --repo taehyung-lab/web-kit --pattern 'boosterlab-web-kit-<버전>.tgz' --dir vendor` 후 `package.json`의 `@boosterlab/web-kit`을 `file:vendor/boosterlab-web-kit-<버전>.tgz`로 바꾸고 `pnpm install`.
3. [agent-workflow-kit](https://github.com/taehyung-lab/agent-workflow-kit)을 버전 태그로 설치하고 `AGENTS.md`의 프로젝트 지도를 그 저장소 사실로 채운다(모르는 것은 `미확인`).
4. `pnpm check`로 확인한 뒤 예시 기능(상품)을 실제 화면으로 바꾼다.
