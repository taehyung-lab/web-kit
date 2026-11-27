# 새 프로젝트 시작

내부 `apps/starter`에서 앱 조립·인증·실행 기반·키트 UI 복사본과 적합성 검사만 복사해 업무 화면 없는 앱을 만든다. starter의 예시 업무(목록·폼·상세 예제, `scripts/starter/examples.json`)는 키트 회귀 검사용으로 starter에만 남고 새 프로젝트로 복사하지 않는다. 첫 업무 화면은 `web-kit-new` 골격과 스킬 계약으로 만든다(다른 업무를 본보기로 복사하지 않는다). 기능별 선택 방식은 [소비 안내](../packages/web-kit/docs/consuming.md#기능을-골라-쓰기)를 따른다. 프로젝트별 템플릿을 여러 개 만들지 않는다. 프로젝트가 자기 입구에 맞춘 화면 골격이 필요하면 그 프로젝트가 `screenTemplates`로 소유한다.

```sh
pnpm starter:create ../my-web --workflow-kit /path/to/agent-workflow-kit
```

대상은 아직 없는 폴더여야 한다. AWK는 `scripts/starter/agent-workflow-kit.version`에 적힌 커밋의 깨끗한 checkout을 지정한다(그 커밋의 발행 tag로 `git clone --branch <tag> https://github.com/taehyung-lab/agent-workflow-kit`). 명령은 checkout의 HEAD가 이 커밋인지 확인하고, 그 커밋에 붙은 발행 tag가 있으면 함께 알린다. AWK를 올릴 때는 이 파일 한 줄만 바꾼다. 이 명령은 원격 다운로드·Git 초기화·의존성 설치·발행을 하지 않는다.

명령은 현재 패키지와 starter vendor/lockfile의 일치를 먼저 확인한다. 다른 경우 유지보수자가 `pnpm starter:sync`와 `pnpm starter:check`로 후보를 맞춘다. 새 폴더에는 AWK, web-kit 스킬, 프로젝트 지도, 프로젝트용 README·CI가 들어간다. 로컬 비밀·의존성·빌드·실행 결과와 추적되지 않은 파일은 복사하지 않는다. 검사 앱의 strict 지문 검사는 유지하고 새 프로젝트에는 정상 UI 수정이 가능한 소비 검사 모드를 적용한다.

생성한 폴더에서 다음을 실행한다.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
pnpm dev:mock
```

유지보수자는 후보를 바꿀 때 새 프로젝트 수용 검사를 실행한다. 임시 폴더에 새 프로젝트를 만들어 예시 업무가 없는지, 설치·생성 코드·route 트리·`pnpm check`가 통과하는지, 키트 기본 골격으로 첫 업무의 목록·상세·등록·수정을 만들고 채우면 typecheck·lint·화면 검사가 통과하는지 확인한다.

```sh
pnpm starter:acceptance --workflow-kit /path/to/agent-workflow-kit
```

후보의 registry tag가 발행되지 않았다면 복사된 UI로만 로컬 확인한다. 새 항목 설치·갱신은 검증된 tag 발행 뒤 [설치 안내](../packages/web-kit/docs/installing.md)를 따른다. 새 프로젝트의 사용 스킬은 설치 패키지 안의 예제까지 읽을 수 있다.

발행은 후보 → starter → 실제 소비처 → 교정·독립 검증 → 실서버 확인 → 정식 발행 순서다. [유지보수](maintaining.md)가 세부 기준을 정한다.
