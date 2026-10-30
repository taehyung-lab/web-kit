# 소비 프로젝트에서 사용하기

설치·버전 고정은 [README](../README.md#설치와-업그레이드), 동작 보장은 설치한 버전의 스킬, 정확한 인자·타입은 같은 패키지의 공개 소스가 정본이다. 이 문서는 연결과 기존 구현 교체 순서만 맡는다.

## 기능을 골라 쓰기

전체 페이지를 공용으로 고정하지 않는다. 필요한 기능의 입구와 UI만 선택한다. 한 패키지에 기능이 함께 배포되는 것과 모든 기능을 사용하는 것은 다르다. 스킬이 연결돼 있어도 해당 기능을 제품에 추가하라는 뜻은 아니다.

| 프로젝트의 차이 | 어디에서 표현하나 | 실제 조립 예 |
|---|---|---|
| 같은 목록인데 검색 시작 시점이 다름 | 같은 `/list`에 조회 조건을 전달 | [즉시 조회](../references/apps/starter/src/features/products/model/list-search.ts.txt), [검색 후 조회](../references/apps/starter/src/features/members/model/list-search.ts.txt) |
| 같은 저장 폼인데 일부만 첨부·배열이 필요 | `/form` 상태를 유지하며 필요한 UI를 조합 | [복잡한 폼](../references/apps/starter/src/features/shows/screens/ShowCreateScreen.tsx.txt) |
| 같은 인증 처리인데 입력 모양이 다름 | `/auth` 진행은 공유하고 프로젝트 UI를 바꿈 | [한 칸·여섯 칸 검사](../references/apps/starter/src/shared/ui/web-kit/checks/auth.page.tsx.txt) |
| 저장 후 승인 등 업무의 성공 정의가 다름 | 프로젝트 요청 함수·완료 동작에서 연결 | [저장 후 추가 조회](../references/apps/starter/src/features/form-workflows/screens/FormWorkflowScreen.tsx.txt) |

예를 들어 A·B가 목록과 폼을 같이 쓰고, C는 즉시 조회와 첨부를 더하며, D는 목록 없이 폼을 승인 과정에 연결할 수 있다. web-kit에 A/B/C/D 분기를 만들지 않는다. 두 프로젝트만 같은 기능을 써도 공용화할 수 있지만, 특정 업무를 공유한다면 별도의 업무 책임인지 먼저 판단한다.

UI가 필요하면 registry의 해당 항목을 선택한다. `form`·`list`·`record`·`auth`를 각각 설치할 수 있으며 필요한 내부 의존과 검사 연결이 따라온다. 사용하지 않는 항목의 검사는 요구하지 않고, 채택한 항목과 그 의존의 필수 검사는 모두 실행한다. `all`은 전체 예제용이며 필수 선택이 아니다. 직접 UI를 만들 때도 채택한 공용 상태·오류·이벤트 순서와 실제 연결 검사를 유지한다.

내부 starter를 복사하면 실행 가능한 예제 앱 전체로 시작한다. 빈 최소 앱이나 기능 선택 생성기는 아니다. 예제를 제거할 때는 사용 코드·route·검사 연결·설치 항목과 의존을 함께 확인한다. 사용하는 UI를 남겨 둔 채 설치 기록만 줄이지 않는다.

## 새 프로젝트

1. 현재 스택·서버 응답 규약이 README의 적용 범위와 맞는지 확인한다. 결과 코드 의미·재발급·쿠키 계약은 서버 근거로 정한다.
2. 검증된 같은 commit의 패키지 tgz와 registry를 선택하고 [설치 안내](../README.md#설치와-업그레이드)의 tag 고정 components.json·shadcn add·설치 기록을 적용한다. 같은 버전의 스킬을 링크한다. workflow-kit은 별도 고정 버전으로 설치하며 프로젝트 지도는 정책·실행·소비 검사 위치를 가리킨다.
3. 키트 초기 연결을 한 진입점에 둔다. `createBrowserSessionStore`에 저장 key·schema·읽기 불가 정책을 선언하고 결과 코드·재발급·헤더·알림 정책을 연결한다. 다른 저장 환경만 별도 adapter를 만든다.
4. registry 복사본에 필드·컬럼·완료 의도를 선언하고 패키지 hook·Provider를 연결한다. 특수 표현도 공통 수명·이벤트 순서는 패키지 반환값을 사용한다. import 위치와 담당 스킬은 README에서 찾는다.
5. 함께 설치한 적합성 연결 검사를 자기 CI에서 실행하고 아래 web-kit-check를 필수 단계로 둔다. 화면의 URL·요청·focus·오류도 확인한다. 실제 사용 UI와 검사 대상의 일치는 검토한다. 실서버 계약을 mock이나 starter 결과로 닫지 않는다.

## 기존 프로젝트

1. 필요한 책임 하나만 골라 채택할 수 있다. 한 책임 안에서는 키트·자체 수명 처리를 섞지 않는다. 바꿀 책임과 그 기존 보장을 고른다. 예를 들어 폼 저장이면 확인 값, 저장 중 입력, 오류 focus, 이탈 정책과 저장 뒤 이동을 구분해 기록한다.
2. 현재 동작을 키트 보장·프로젝트 정책·미확인으로 나눈다. 차이가 있다는 이유로 기존 제품 동작을 삭제하거나 키트 기본값으로 승격하지 않는다.
3. 대표 사용처 하나를 키트에 연결한다. 이미 키트가 맡는 수명은 프로젝트 adapter 안에서 다시 구현하지 않는다. 필요한 보장이 키트에 없으면 그 책임을 먼저 검토한다.
4. 성공·실패·취소·늦은 응답과 기존 조건을 화면 결과로 확인한다. 확인된 책임의 이전 구현과 관련 문서·검사를 정리해 같은 책임의 활성 구현을 하나로 만든다.
5. 같은 책임의 나머지 사용처로 넓힌다. 프로젝트 고유 판단이 반복될 때만 해당 역할 스킬을 두고, 공통 조립 설명은 키트로 모은다.

## 복사본 적합성 검사

registry item은 함께 설치하는 파일 묶음이다. UI와 함께 설치된 짧은 연결 파일은 자기 복사본을 패키지의 공통 검사 함수에 넘긴다. 단언은 패키지가 소유하므로 프로젝트로 복제하지 않는다. `/testing/unit`은 jsdom(브라우저 DOM을 흉내 내는 단위 환경)에서 상태·속성·요청 수를, `/testing/browser`는 Playwright의 실제 브라우저에서 Tab·중첩 포털·배경 클릭 차단·Enter·포커스 복원을 검사한다. `/testing/fixtures`는 자기 복사본을 주입할 검사 화면을 제공한다.

선택 소비는 기능별 작은 검사 입구를 사용한다. 폼은 `/testing/unit/form`, 인증은 `/testing/unit/auth`와 `/testing/fixtures/auth`, 폼의 UI 의존은 `/testing/unit/choice`·`/testing/unit/primitives`·`/testing/unit/styles`로 연결한다. 기존 `/testing/unit`·`/testing/fixtures`는 호환 입구로 남지만 전체 검사 의존을 불러올 수 있다. form의 zod는 검사 의존이며 사용하는 폼 schema 구현을 제한하지 않는다.

## 4.1 → 5.0.0-rc.2

5.0은 **사용 계약이 깨지는 변경**(major)이다. 다음 연결을 함께 이전한다.

- **검사 연결(복사본 교정 필요):** 배포 검사 파일이 기능별 작은 입구와 조합 입구(`/testing/unit/combinations`·`/testing/fixtures/combinations`)를 쓴다. 같은 후보의 registry 검사 연결 파일을 새 원본과 대조해 갱신하고 설치 기록을 다시 만든다. 두 기능을 함께 설치한 경우에만 그 조합 검사가 필수다. 제품 UI 배치·폼 저장 상태 기계 변경은 없다. 기본 등록 보호·보호 제외·후속 확장 사용 조건은 [web-kit-form](../skills/web-kit-form/SKILL.md)이 정본이다.
- **유휴 세션(`/session/idle`):** 연장·마감·만료의 제품 정책을 키트에서 빼고 프로젝트 입력으로 옮겼다. 키트는 더 이상 스스로 활동 연장·로그인 임시 마감·첫 응답 마감 채택·재개 유예·경고 닫음을 하지 않는다. 기존 동작을 유지하려면 프로젝트가 활동 부품(`/session/activity`), 0초 처리 필수 선택, 임시 마감, 채택할 응답의 명시 전달, 재개 유예 길이, 경고 닫음 UI를 직접 연결한다. 저장 형식이 바뀌었으므로 기존 브라우저 저장값의 유지·삭제는 프로젝트가 정한다. 입력·보장·이전 대응표는 [web-kit-http](../skills/web-kit-http/SKILL.md), 결정 이유는 [0013](../references/docs/decisions/0013-session-policy-split.md)이 정본이다.

- **응답 해석(`/http`):** `createHttp`의 `response`가 필수가 됐고 `results` 입력과 `Http.request<T>`·`Unwrapped<T>`는 제거됐다. DT처럼 `results`만 넘기던 Spring 소비자는 `results: resultCodes`를 `response: springEnvelope(resultCodes)`로 바꾼다. starter처럼 손으로 `readEnvelope`·`toRequestFailure`를 합친 계약도 같은 부품으로 바꾼다. 생성 봉투 타입을 받던 mutator는 `/http`의 `SpringEnvelopeData<T>`를 가져와 `http.requestData<SpringEnvelopeData<T>>(config, options)`로 연결한다. 실제 데이터 타입을 이미 쓰는 호출은 `requestData<T>`를 유지한다. 다른 서버 형식은 자기 `ResponseContract`를 명시한다. 보장은 [web-kit-http](../skills/web-kit-http/SKILL.md), 결정 이유는 [0014](../references/docs/decisions/0014-response-contract-required.md)에 있다.

Vitest JSON과 Playwright JSON 보고서에는 검사 ID·패키지 버전·registry ref/원본 commit이 남는다. Vitest `allowOnly: false`, Playwright `forbidOnly: true`로 일부 검사만 실행하는 only를 CI에서 거절한다. 검사와 `web-kit-check`는 같은 CI 작업(job)에서 연달아 실행하고, 이전에 저장된 결과를 재사용하지 않는다. 점검 명령은 결과의 생성 시점을 확인하지 않으므로 오래된 통과 결과를 현재 복사본의 검증으로 판정할 수 없다. 설치한 모든 항목의 필수 검사를 실행한 뒤 프로젝트 루트에서 다음을 실행한다.

```sh
pnpm exec web-kit-check --installation registry-installation.json --unit .web-kit-results/unit.json --browser .web-kit-results/browser.json
```

연결 없음·필수 검사 누락/skip/실패·대상 버전 불일치는 실패다. 일반 프로젝트의 디자인 수정은 정상일 수 있어 현재 파일과 installedHash의 차이는 기본 알림이다. 설치본을 수정 없이 사용해야 하는 검사 앱은 `--strict-fingerprints`를 붙여 변경도 실패로 만든다. 선택 peer를 설치하지 않아 기능 검사를 실행하지 못했다면 "검사하지 않음"으로 기록하며 필수 검사 성공으로 간주하지 않는다.

실제 제품이 검사한 UI를 사용하는지는 점검 명령이 자동 판정하지 않는다. 사용 import와 검사 연결의 일치를 독립 검토한다. [실제 CI 연결](../references/apps/starter/package.json)과 [검사 연결 예](../references/apps/starter/src/shared/ui/web-kit/checks/form-ui.test.tsx.txt)는 조립 방식만 참고하며 제품 값은 프로젝트가 정한다.

## 3.1 → 4.0과 갱신

[이전 표](../README.md#31--40-이전)로 제거된 UI 입구를 설치한 복사본 import로 바꾼다. 일부 체크 트리의 표시/클릭 변경, 기간 timeZone·now 선택화, /choice 입구도 확인한다. 이전 원본 A·새 원본 B·현재 복사본 C를 비교하는 [갱신 절차](../README.md#복사본-갱신)를 따라 프로젝트 수정을 보존한다. --overwrite를 기본으로 쓰지 않고 적용 뒤 동일 검사를 재실행한다.

## 저장 adapter 검사

`/testing/session`의 `checkSessionStoreAdapter`에는 실제 adapter를 가짜 저장소에 연결한 새 fixture를 넘긴다. `SessionStoreAdapterFixture`의 공개 타입이 검사 환경의 정확한 모양을 정의한다.

- fixture는 빈 저장소에서 시작한다. 운영 localStorage·실제 자격증명은 사용하지 않는다.
- `credentials`는 검사기가 준 합성 토큰에 loginId 등 프로젝트가 요구하는 필수 필드를 채운다. 실제 `SessionStore<C>` 타입을 유지하며 기본 Credentials로 강제 변환하지 않는다.
- `failWrites`는 adapter 바깥의 영속 저장/삭제만 실패시킨다. adapter의 fallback 코드를 바꾸거나 테스트용 구현으로 교체하지 않는다.
- `externalWrite`는 다른 탭의 성공한 저장/삭제와 실제 알림 경로를 함께 재현한다. 이 탭의 쓰기 실패에 영향을 받지 않는다.
- `dispose`는 등록한 구독·가짜 환경을 정리한다.

검사는 실제 `createSession`으로 로그인·두 번의 재발급·외부 변경·종료를 실행한다. 저장 실패 뒤 이전 토큰 복귀, 외부 변경 누락, 종료 후 세션 복구를 잡는다. 기본 브라우저 adapter의 이벤트 판별은 키트가 검사한다. 소비자는 선택한 읽기 불가 정책과 실제 탭 연결을 확인하고, 별도 adapter는 자기 이벤트·형식 이전도 검사한다. 예외를 삼키는 것만으로 adapter 보장을 충족하지 않는다.

## 프로젝트가 추가할 것

제품 값은 제품 기록, 서버 계약은 그 계약의 근거, 반복되는 제품 고유 판단만 프로젝트 역할 스킬에 둔다. 배포된 `web-kit-*` 스킬은 설치본 링크를 유지한다. 공통 보장을 고칠 때는 키트의 코드·스킬·검사를 함께 바꾸고, 제품 차이는 프로젝트에 남긴다. 키트 변경 절차는 [유지보수](../references/docs/maintaining.md)를 따른다.
