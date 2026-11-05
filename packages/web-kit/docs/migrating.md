# 시험판에서 옮겨 오기

5.0.0 첫 정식 기준으로 옮길 때는 사용하던 시험판에 따라 다음 연결을 함께 이전한다. 현재 검사용 후보는 5.0.0-rc.9다. 조건부 칸은 web-kit-form의 같은 조건 함수·schema·빈 값 선언을 함께 연결한다.

- **검색어·선택 칸:** 입력만 하고 [검색]을 누르면 입력 중 글자는 검색에 포함되지 않고 칸에 남는다. Enter 연결은 패키지 바인딩에서 복사본으로 이동했으므로 registry `list` 복사본을 함께 갱신한다. 기본 Enter는 추가 후 검색이며, [추가]와 Enter는 `;`로 여러 검색어를 나눈다. 전체 선택지 밖 값은 표시·검색·저장에서 빠진다. 서버 검색의 일부 결과 밖 선택은 유지한다. `Form.Choice`의 서버 선택지는 `Form.Select`와 같은 `status`·`onRetry`를 연결한다(생략은 고정 선택지 `ready`). 정리만으로 폼 원본이나 이탈 보호는 바뀌지 않는다. 보장은 [web-kit-list](../skills/web-kit-list/SKILL.md)·[web-kit-form](../skills/web-kit-form/SKILL.md), 결정 이유는 [목록·선택 결정](../references/docs/decisions/0006-list-choice-permission.md)에 있다.

- **목록 검색:** 같은 조건으로 다시 검색해도 행 체크가 모두 해제된다. 검색 응답이 성공·실패로 도착하기 전에는 이전 행을 보이면서 체크·일괄 변경·확인창 실행·다운로드를 잠근다. 배경 재조회는 선택을 유지하고 사라진 행만 정리한다. 이전 검색의 체크를 유지한다고 가정한 화면·검사를 갱신한다. 공용 `isCurrent`를 읽는 연결에는 별도 잠금 조건을 추가할 필요가 없다. 보장은 [web-kit-list](../skills/web-kit-list/SKILL.md), 결정 이유는 [목록·선택 결정](../references/docs/decisions/0006-list-choice-permission.md)에 있다.

- **검사 연결(복사본 교정 필요):** 배포 검사 파일이 기능별 작은 입구와 조합 입구(`/testing/unit/combinations`·`/testing/fixtures/combinations`)를 쓴다. 같은 후보의 registry 검사 연결 파일을 새 원본과 대조해 갱신하고 설치 기록을 다시 만든다. 두 기능을 함께 설치한 경우에만 그 조합 검사가 필수다. 제품 UI 배치·폼 저장 상태 기계 변경은 없다. 기본 등록 보호·보호 제외·후속 확장 사용 조건은 [web-kit-form](../skills/web-kit-form/SKILL.md)이 정본이다.
- **유휴 세션(`/session/idle`):** 연장·마감·만료의 제품 정책을 키트에서 빼고 프로젝트 입력으로 옮겼다. 키트는 더 이상 스스로 활동 연장·로그인 임시 마감·첫 응답 마감 채택·재개 유예·경고 닫음을 하지 않는다. 기존 동작을 유지하려면 프로젝트가 활동 부품(`/session/activity`), 0초 처리 필수 선택, 임시 마감, 채택할 응답의 명시 전달, 재개 유예 길이, 경고 닫음 UI를 직접 연결한다. 저장 형식이 바뀌었으므로 기존 브라우저 저장값의 유지·삭제는 프로젝트가 정한다. 입력·보장·이전 대응표는 [web-kit-http](../skills/web-kit-http/SKILL.md), 결정 이유는 [세션 결정](../references/docs/decisions/0004-session-lifetime.md)이 정본이다.

- **응답 해석(`/http`):** `createHttp`의 `response`가 필수가 됐고 `results` 입력과 `Http.request<T>`·`Unwrapped<T>`는 제거됐다. `results`만 넘기던 Spring 소비자는 `results: resultCodes`를 `response: springEnvelope(resultCodes)`로 바꾼다. starter처럼 손으로 `readEnvelope`·`toRequestFailure`를 합친 계약도 같은 부품으로 바꾼다. 생성 봉투 타입을 받던 mutator는 `/http`의 `SpringEnvelopeData<T>`를 가져와 `http.requestData<SpringEnvelopeData<T>>(config, options)`로 연결한다. 실제 데이터 타입을 이미 쓰는 호출은 `requestData<T>`를 유지한다. 다른 서버 형식은 자기 `ResponseContract`를 명시한다. 보장은 [web-kit-http](../skills/web-kit-http/SKILL.md), 결정 이유는 [응답 결정](../references/docs/decisions/0003-request-response-failure.md)에 있다.

- **기본 부품과 스타일(복사본 교정·화면 수정 필요):** 키트 스타일시트(`ui/styles.css`, `.wk-*`·`--wk-*`)와 키트 기본 부품(`Button`·`Input`·`TextArea`·`Select`·`Checkbox`)을 없앴다. 기본 부품은 shadcn base-nova 설치본을 쓰고 native select였던 `Select`는 shadcn Select다. 이전 대응표와 절차는 [설치 안내](installing.md#키트-스타일시트에서-shadcn-기본-부품으로-옮기기), 결정은 [배포 결정](../references/docs/decisions/0002-distribution.md#기본-부품은-shadcn-base-nova)에 있다.
- **UI 입구와 복사본:** 아래 이전 표로 제거된 UI 입구를 설치한 복사본 import로 바꾼다. 일부 체크 트리의 표시/클릭 변경, 기간 timeZone·now 선택화, /choice 입구도 확인한다. 이전 원본 A·새 원본 B·현재 복사본 C를 비교하는 [갱신 절차](installing.md#복사본-갱신)를 따라 프로젝트 수정을 보존한다. --overwrite를 기본으로 쓰지 않고 적용 뒤 동일 검사를 재실행한다.

### UI 입구 이전 표

| 이전 시험판 import | 현재 위치(기본 설치 target 기준) |
|---|---|
| `@boosterlab/web-kit/ui` | registry `ui`: `@/shared/ui/web-kit/ui` |
| `@boosterlab/web-kit/list/ui` | registry `list`: `@/shared/ui/web-kit/list-ui` |
| `@boosterlab/web-kit/form/ui` | registry `form`: `@/shared/ui/web-kit/form/ui` |
| `@boosterlab/web-kit/detail/ui` | registry `record`: `@/shared/ui/web-kit/detail-ui` |
| `@boosterlab/web-kit/filter` | registry `checkbox-tree`·`filter-error`: `@/shared/ui/web-kit/CheckboxTree`·`@/shared/ui/web-kit/search/filter-error`; 순수 계산은 패키지 루트 |
| `@boosterlab/web-kit/styles.css` | 없음: 키트 스타일시트를 없앴다. 프로젝트 shadcn 테마 CSS가 모양을 정한다([설치 안내](installing.md#키트-스타일시트에서-shadcn-기본-부품으로-옮기기)) |

위 6개 패키지 입구는 제거됐다. `/choice`는 공유 선택/검색의 `useChoiceBinding`을 공개하는 새 입구다. `/dialog`는 대화창과 진행 등록 연결을, `/form`·`/list`·`/record`는 각각의 상태·연결 hook을 제공한다.

- 목록 상태 전달은 `/list`의 `ListProvider`가 기본이며 `model` props도 허용한다. 패키지 Provider는 model·children만 받고 문구·실패 표현은 registry 표시 wrapper에 둔다.
- `Period`/`PeriodFilter`의 `timeZone`·`now`는 생략 가능하다. 기본 브라우저 시간대·현재 시각을 쓰고 넘긴 값은 그대로 쓴다. 요청 날짜 변환도 같은 시간대를 쓴다.
- 부모 아래 두 leaf 중 하나만 선택했을 때 `checkboxTreeSelection.checked`는 true에서 false로, 표시는 체크에서 `mixed`(−)로 바뀐다. 부모 클릭은 기존 선택 해제에서 모든 후손 선택으로 바뀐다. `mixed(targets)`를 indeterminate/aria-checked=mixed와 연결한다. 명시적인 set(true/false) 규칙은 유지한다. `checked`의 requireAll 인자는 타입 호환으로 받지만 이제 모두 선택됐을 때만 true다.
- 기본 Dialog 복원 교정은 패키지 갱신으로 반영된다. 중첩 대화창 위 Choice 클릭은 shadcn 팝업 층(`z-50`, 대화창보다 나중 포털)으로 지킨다. 실제 브라우저 적합성 검사를 함께 실행한다.

기존 `selection.run`의 `{ completedIds }` 계약은 유지한다. 부분 성공은 실제 성공 ID만 반환하며 Promise 완료를 전체 성공으로 해석하지 않는다. 폼의 `references`·`secondary`·확인/완료·이탈 보장은 그대로며 정확한 사용 조건은 스킬이 정본이다.

- **타입 import(복사본 교정 필요):** form/ui.tsx·list-ui.tsx·ui/dialog.tsx의 타입 전용 import를 `import type { … }`로 교정한다. 패키지 갱신만으로 기존 복사본 문법은 바뀌지 않는다. 적용 뒤 lint와 적합성 검사를 실행한다.
- **인증 실패 값(복사본 교정 필요):** `model.failure`를 `verifyFailure`·`resendFailure`로 나누고 `labels.failure`도 `labels.verifyFailure`·`labels.resendFailure`로 바꾼다. 인증 검사 연결은 `/testing/unit/auth`·`/testing/fixtures/auth`를 사용한다.

## 구조 계약 채택

구조 계약을 담은 5.0.0-rc.9부터 폴더 책임·import 방향을 사용 계약([web-kit-structure](../skills/web-kit-structure/SKILL.md))으로 배포한다. 런타임 동작은 바뀌지 않는다. 채택하는 앱은 lint·검사 결과가 달라지므로 다음 순서로 옮긴다. 키트 일부만 쓰고 채택하지 않는 앱은 이 절을 건너뛴다.

1. **연결:** [설치 안내의 구조 계약 연결](installing.md#구조-계약-연결)대로 설정·lint·CI를 붙인다. 처음 실행한 위반 목록을 그대로 예외로 옮기지 않는다. 옮길 묶음을 정하고, 이번에 옮기지 않는 파일만 파일·규칙·이유(남기는 이유와 옮길 묶음)로 적는다.
2. **runtime 분리:** http·세션·QueryClient·서버 시계·i18n 인스턴스·전역 안내 저장소처럼 feature가 쓰는 실행 기반을 `src/runtime/`으로 옮긴다. runtime에서 feature를 부르던 연결(예: 서버 로그아웃 요청을 feature api로 보냄)은 runtime 안의 직접 요청이나 app의 구독으로 바꾼다. feature 문구 모음은 app이 runtime의 i18n 인스턴스에 등록한다. orval mutator 경로도 runtime으로 바꾸고 생성 코드를 다시 만든다. 이것이 끝나야 feature → app 위반이 사라진다.
3. **대표 화면부터:** 인증 화면 → 목록·등록/수정·상세 대표 → 나머지 순서로 옮긴다. 화면의 `useSaveForm`·`useList`·`useRecord`·`useAuthChallenge`·요청·이동을 `flows/use-<행동>.ts`로 옮기고 화면은 flow 결과만 그린다. 저장(`save`)은 요청과 응답 반환만, 세션 시작·이동·후속 조회는 완료(`onSaved`)로 나눈다. 사용자 조작 중 실행해야 하던 일(권한 요청 등)은 첫 `await` 전 위치를 지킨다. 실패 의미 판정·정책 값은 `model/rules/<업무>-policy.ts`, 저장소는 `state/`, URL 목록 검색 선언은 `state/`로 옮긴다. 옮긴 파일은 바로 예외 없이 통과시킨다.
4. **route:** `<이름>.tsx`·`$id.tsx` 화면 파일을 `<이름>/index.tsx`·`$id/index.tsx`로, 로그인 전 화면을 `_public/`로 옮기고 이미 로그인한 경우의 이동 판정을 `_public/route.tsx` 한 곳에 둔다. 앱 골격은 `_app/route.tsx`(묶음 골격 파일 이름은 `route.tsx`)로 옮기고 화면 모양은 `app/shell`에 둔다. 기존 제품 URL이 이름 관례와 다르면 URL을 지킨다. 기본 loader는 지우거나 이유와 함께 예외로 남긴다. route 진입 판정이 feature 상태를 읽으면 그 feature에 `public.ts`를 만든다. route 트리를 다시 생성한다.
5. **보고:** 구조 결과(`[구조]`)와 제품 동작 보존 결과(기존 시나리오·브라우저·실서버)를 따로 센다. 파일을 옮겨 구조가 통과해도 제품 시나리오가 확인되지 않았으면 그 화면의 이전은 완료가 아니다. 남은 예외 수와 이유를 함께 보고한다.
