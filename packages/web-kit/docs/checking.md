# 복사본 적합성 검사

registry item은 함께 설치하는 파일 묶음이다. UI와 함께 설치된 짧은 연결 파일은 자기 복사본을 패키지의 공통 검사 함수에 넘긴다. 단언은 패키지가 소유하므로 프로젝트로 복제하지 않는다. `/testing/unit`은 jsdom(브라우저 DOM을 흉내 내는 단위 환경)에서 상태·속성·요청 수를, `/testing/browser`는 Playwright의 실제 브라우저에서 Tab·중첩 포털·배경 클릭 차단·Enter·포커스 복원을 검사한다. `/testing/fixtures`는 자기 복사본을 주입할 검사 화면을 제공한다.

선택 소비는 기능별 작은 검사 입구를 사용한다. 폼은 `/testing/unit/form`, 인증은 `/testing/unit/auth`와 `/testing/fixtures/auth`, 폼의 UI 의존은 `/testing/unit/choice`·`/testing/unit/primitives`로 연결한다(칸·구역 여백 검사 G110은 폼 검사에 들어 있다). 키트 항목 검사는 프로젝트에 설치된 shadcn 기본 부품을 그대로 import해 실행한다. 브라우저 검사 화면은 프로젝트 테마 CSS `@/styles.css`를 읽는다. 기존 `/testing/unit`·`/testing/fixtures`는 호환 입구로 남지만 전체 검사 의존을 불러올 수 있다. form의 zod는 검사 의존이며 사용하는 폼 schema 구현을 제한하지 않는다.

## 현재 파일에서 새로 실행

Vitest JSON과 Playwright JSON에는 검사 ID·패키지 버전·registry ref/원본 commit이 남는다. Vitest `allowOnly: false`, Playwright `forbidOnly: true`를 설정한다. 프로젝트 루트에 `web-kit.check.json`을 둔다.

```json
{
  "inputs": ["index.html", "src", "tests", "package.json", "pnpm-lock.yaml", "components.json", "vitest.config.ts", "playwright.config.ts", "vite.config.ts"],
  "unit": ["pnpm", "exec", "vitest", "run"],
  "browser": ["pnpm", "exec", "playwright", "test"]
}
```

`inputs`는 실제 코드·검사·설정을 모두 포함한다. 추가 설정·검사 HTML·정적 파일이 있으면 함께 적는다. [starter의 전체 선언](../references/apps/starter/web-kit.check.json)을 참고한다. 선언한 입력과 설치 기록·실제 설치 파일·이 설정의 지문을 실행 전후 비교한다. 비밀 `.env`와 의존성·결과 폴더는 입력으로 쓰지 않는다. 단위·브라우저 보고서의 출력 위치는 각 러너에서 아래 경로로 설정한다.

```sh
pnpm exec web-kit-check --run web-kit.check.json --installation registry-installation.json --unit .web-kit-results/unit.json --browser .web-kit-results/browser.json
```

명령 배열을 셸 없이 실행한다. 이전 보고서와 실행 기록을 먼저 지워 새 결과가 없으면 실패한다. 명령 실패·검사 중 입력 변경도 실패다. 통과 결과와 입력 지문은 `.web-kit-results/run.json`에 연결된다. 러너가 생성하는 결과를 inputs에 넣지 않는다. 선택 항목에 필수 브라우저 검사가 없을 때만 `"browser": null`을 쓸 수 있으며 필수 ID 판정은 그대로 적용된다.

모노레포의 앱처럼 lockfile이 저장소 맨 위에 있으면 `inputs`에서 빼고 `"workspace": { "root": "../..", "inputs": ["pnpm-lock.yaml"] }`로 적는다. `root`는 프로젝트의 조상 폴더(`..`만으로 된 경로)이고 `workspace.inputs`는 그 안의 일반 파일만 받는다. 이 파일이 바뀌어도 새 실행이 필요하다.

출력은 선언한 입력 파일·디렉터리와 겹치지 않는 곳에 둔다. 겹치면 파일 정리와 명령 실행 전에 거절한다. 검사 입력·출력은 부모 폴더까지 실제 경로로 선언한다. 심링크(다른 경로를 가리키는 파일·폴더 링크)를 통한 별칭은 거절한다. `work`·`dist` 같은 결과 폴더의 제외는 프로젝트 루트에만 적용하므로 `src/work` 같은 실제 소스는 기록한다.

실행 후 같은 파일·결과인지 다시 확인하려면 `--run` 대신 `--verify-run web-kit.check.json`을 사용한다. `--receipt`로 실행 기록 경로를 바꿀 수 있다. 파일·설정·lockfile·보고서가 바뀌면 새 실행이 필요하다. 이 기록은 실수로 과거 결과를 재사용하는 것을 잡으며, 실제 제품이 검사 대상 UI를 쓰는지 또는 의도적으로 조작된 검사까지 증명하지 않는다.

## 구조 결과

구조 계약을 채택한 앱은 같은 명령에 `--structure web-kit.structure.json`을 붙인다. 키트가 배포한 구조 규칙만 프로젝트 파일 전체에 실행한다(프로젝트 eslint 설정·인라인 disable은 쓰지 않음). 결과는 UI 적합성과 따로 `[구조] 통과|실패: 파일 N개, 위반 N건, 예외로 남긴 위반 N건(예외 목록 N개), 규칙 web-kit-structure <버전>, 설정 …` 한 줄과 위반 목록으로 보인다. 쓰지 않는 예외도 실패다. `--structure`가 없으면 `[구조] 검사하지 않음`이며 통과로 세지 않는다. 두 결과 중 하나라도 실패면 명령이 실패한다. 구조 결과만 볼 때는 `pnpm exec web-kit-structure`를 쓴다. 규칙과 설정은 [web-kit-structure](../skills/web-kit-structure/SKILL.md)가 정본이다.

## CI에 넣을 명령

소비 프로젝트의 필수 CI(병합 전 통과해야 하는 작업)에 아래를 넣는다. 타입·lint·build 같은 기존 명령은 그대로 둔다. 단위·브라우저 러너는 `web-kit-check --run`이 위 설정의 명령으로 직접 실행하므로 따로 한 번 더 돌릴 필요가 없다. 모노레포 앱이면 각 명령을 그 앱 폴더에서 실행한다(예: `pnpm --dir apps/admin exec ...`).

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm exec web-kit-check --run web-kit.check.json --installation registry-installation.json --unit .web-kit-results/unit.json --browser .web-kit-results/browser.json --structure web-kit.structure.json
```

`--structure`는 구조 계약을 채택한 앱만 붙인다. 설치본을 고치지 않고 써야 하는 검사 앱만 마지막 명령에 `--strict-fingerprints`를 붙인다. 이 단계를 건너뛰거나 실패를 허용(`continue-on-error` 등)하면 키트 보장을 확인했다고 하지 않는다. CI 설정 변경과 검사 대상 선정은 독립 검토로 확인한다([배포 결정](../references/docs/decisions/0002-distribution.md)).

## 기존 보고서 점검

기존 `--run` 없는 명령도 유지한다. 필수 ID·버전·skip·파일 유무는 확인하지만 결과가 현재 파일에서 나온 것인지는 보장하지 않는다. 이 방식은 같은 CI 작업에서 새 검사 후 곧바로 점검하는 경우에만 쓴다. 새 소비처와 starter는 위 새 실행 경로를 사용한다.

연결 없음·필수 검사 누락/skip/실패·대상 버전 불일치는 실패다. 일반 프로젝트의 디자인 수정은 정상일 수 있어 현재 파일과 installedHash의 차이는 기본 알림이다. 설치본을 수정 없이 사용해야 하는 검사 앱은 `--strict-fingerprints`를 붙여 변경도 실패로 만든다. 선택 peer를 설치하지 않아 기능 검사를 실행하지 못했다면 "검사하지 않음"으로 기록하며 필수 검사 성공으로 간주하지 않는다.

실제 제품이 검사한 UI를 사용하는지는 점검 명령이 자동 판정하지 않는다. 사용 import와 검사 연결의 일치를 독립 검토한다. [실제 CI 연결](../references/apps/starter/package.json)과 [검사 연결 예](../references/apps/starter/src/shared/ui/web-kit/checks/form-ui.test.tsx.txt)는 조립 방식만 참고하며 제품 값은 프로젝트가 정한다.
