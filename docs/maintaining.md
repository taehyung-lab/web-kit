# 키트 변경과 검증

사용 동작의 정본은 `packages/web-kit/skills/`, 변경 이유는 `docs/decisions/`, 현재 공개 경로·타입은 `packages/web-kit/package.json`과 `src/`, UI 원본·설치 항목은 `packages/ui-registry`·`registry.json`이다. 4.0 경계와 배포 결정은 [0011](decisions/0011-web-kit-4-ui-distribution.md)을 따른다. 이 문서는 변경·호환성·발행 판단만 맡는다.

## 변경 순서

1. 영향받는 기존 보장과 새 요구를 정하고, 정상 결과와 위반 결과를 구별할 검사를 고른다. 제품 정책은 키트 기본값으로 채우지 않는다.
2. 코드를 바꿀 때 해당 스킬도 대조한다. 사용자가 찾는 작업이 늘거나 책임이 이동하면 description과 README의 진입 안내도 확인한다.
3. 저장소 루트의 `pnpm check`로 키트 보장·스킬 조립 예 링크·registry 원본/산출물 일치를 확인한다. adapter 검사 도구를 추가하거나 바꾸면 정상 adapter뿐 아니라 관찰한 결함을 가진 adapter도 거절하는지 확인한다.
4. 아래 버전 기준으로 번호를 정하고 그 번호로 포장한 산출물을 소비 검사에 넣는다. 현재 연결된 소비자와, 호환성이 달라진 경우 짝지은 소비자 revision을 구분한다.
5. 실제로 검사한 버전·환경·입력·결과·미확인을 기록한다. 새로운 interface가 기존 예제에서 사용되지 않으면 예제 통과만으로 새 기능의 소비 검사를 완료했다고 하지 않는다.

## 버전 기준

| 변경 | 올릴 부분 | 예 |
|---|---|---|
| 공개 사용 조건·동작의 호환성이 깨짐 | major | 필수 입력 추가, 기존 입력 의미 변경, 기존 import 제거, 실패 종류/상태에 새 값을 추가해 소비자의 완전 분기가 달라짐, 필수 peer 호환 범위 축소 |
| 기존 사용을 유지하는 선택적 기능 | minor | 새 공개 module·선택 입력·registry 항목·adapter 검사 추가 |
| 기존 보장 복구·실행 조건을 바꾸지 않는 문서 정정 | patch | 문서와 구현 불일치 정리, 원래 보장에 어긋난 오류 수정 |

코드가 그대로여도 스킬에 새로운 필수 행동을 요구하면 사용 계약 변경이다. 이를 문서 수정이라는 이유로 patch로 숨기지 않는다. 기존 보장의 의미가 불명확하거나 동작을 보존하던 소비자에게 영향이 있으면 변경 이유와 이전 방법을 함께 정한다.

## 소비 검사와 발행

키트와 소비 검사 앱 `apps/starter`는 같은 저장소에 있다. starter는 workspace 구성원이 아니며 키트 소스가 아니라 포장한 tarball로만 키트를 쓴다(`scripts/sync-starter.mjs`). 키트를 바꾸면 `pnpm starter:sync`로 starter를 다시 맞추고, starter vendor tarball(`apps/starter/vendor/boosterlab-web-kit.tgz`)·사용 코드·lockfile을 같은 PR에 넣는다. `pnpm starter:check`와 CI는 커밋된 vendor tarball의 풀어 낸 내용이 그 commit의 키트를 포장한 내용과 다르거나 lockfile 지문이 그 tarball과 다르면 실패한다. pnpm pack의 바이트는 OS마다 달라질 수 있어 내용으로 비교하고, lockfile·소비 검사·발행은 커밋된 tarball 하나를 쓴다. UI는 실제 shadcn CLI로 registry 원본을 설치한 프로젝트 복사본을 쓴다. 공통 상태 수명·이벤트 순서는 패키지가 소유한다. UI 원본을 바꾸면 registry:build와 설치·기록 갱신도 하고, starter:check의 단위·브라우저·web-kit-check strict 점검을 통과시킨다.

starter 통과만으로 소비 검증을 끝내지 않는다. 실제 소비처의 대표 흐름은 [0003](decisions/0003-web-kit-3-redesign.md)의 완료 기준으로 판정한다.

발행 순서는 **같은 commit 후보(패키지+registry) → starter → 실제 소비처 검증 → 교정·독립 검증 → 실서버 확인 → 정식 발행**이다(합의 12). 실제 소비처 또는 실서버 확인이 남으면 후보 준비 완료와 발행 가능을 구분한다. 현재 CI의 consumer가 통과하면 다음을 `web-kit-tarball` artifact에 남긴다.

- 검사한 tarball
- `verification.json`: 저장소 commit·패키지 버전·tarball SHA-256·실행 식별자

registry JSON은 같은 commit의 `public/r`에 보관하고 tag 고정 raw URL로 배포한다. 패키지와 registry가 같은 commit인지, 소비처가 어떤 원본/설치 지문과 검사 결과를 썼는지는 설치 기록·검사 보고서와 함께 확인한다. 현재 verification.json 자동 기록은 위 패키지 산출물 범위이며 registry/소비 검증을 저절로 완료했다고 해석하지 않는다.

발행은 모든 순서를 확인한 main의 해당 키트 commit에서 통과한 산출물 그대로 한다. 번호가 맞는 tag와 release에 올리고 다시 pack하지 않는다. 발행한 번호로 내용이 다른 산출물을 만들지 않는다.
사용법이 바뀌는 변경은 이전 소비자의 실패와 새 소비자의 통과를 구분한다. 새 소비자가 아직 준비되지 않았다면 키트 내부 검사만으로 소비 검증 완료나 발행 가능을 선언하지 않는다. 프로젝트 연결이 별도 범위인 작업에서는 키트 준비 완료와 미수행 소비 검사를 따로 보고한다.

## 복사본 업데이트 안내

변경마다 발행 안내를 **패키지만 올리면 반영 / 복사본 교정 필요**로 구분한다. 후자에는 이전/새 registry tag·항목·변경 파일과 포커스/이벤트 연결의 교정 이유를 적는다. 원본 A와 B를 같은 CLI·설정으로 설치해 차이를 만들고 현재 프로젝트 C의 수정과 함께 비교한다. 디자인 diff를 보존하며 필요한 교정만 적용하고, 충돌 파일은 보존해 검토한다. --overwrite를 기본 갱신법으로 안내하지 않는다. 적용 뒤 단위·브라우저·web-kit-check를 다시 실행한다. [소비 갱신 안내](../packages/web-kit/README.md#복사본-갱신)가 실행 절차다.

## 스킬 탐색 확인

파일·링크 검사는 패키지 누락과 깨진 참조를 잡는다. description의 실제 선택 품질은 요청을 받은 새 에이전트가 필요한 책임을 읽었는지로 본다. workflow-kit의 선택 평가 방법을 사용하고 스킬마다 별도 절차를 복제하지 않는다.

form description을 바꾼 경우 등록 화면뿐 아니라 「입력 없이 삭제 확인 추가」, 「확인창 adapter 변경」, 「저장하지 않고 이동」처럼 다른 진입 요청도 확인한다. 단순 색 수정이 저장 수명 전체의 변경으로 확대되지 않는지도 본다. 모델·도구·노출된 스킬이 다른 평가를 같은 결과로 합치지 않는다.
