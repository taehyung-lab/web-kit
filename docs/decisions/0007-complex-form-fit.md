# 0007. 복잡한 폼: 줄 작업은 키트가 기록하고, 필수 표시는 schema에서, 파일은 상태로 보존한다

- 상태: 채택 (2026-10-28, 3.0 6단계 구현)
- 관련 결정: [0003](0003-web-kit-3-redesign.md) §3 form 행("서버 필드 오류 부착(배열 하위 경로 포함)", "모달 폼 제출 격리, 배열 행 정체성, 파일 보존"), 반례 "배열 이동 후 오류가 다른 행을 가리키거나 중첩 모달이 부모 폼도 제출한다", 순서 6단계 행. [0006](0006-form-record-dialog.md)의 부품 구조와 「필수 별표」 행을 이 기록이 대체한다. 보장 내용의 정본은 `packages/web-kit/skills/web-kit-form`이며 여기에는 결정·이유·출처만 둔다.
- 근거 자료: DT 1.5(`v1.5-baseline` `features/concerts/form/`: `components/ui/form/form-array-field.tsx`, `order-info/use-vendor-api-dialog.ts`, `basic-info/venue-seat-section.tsx`·`use-seat-layout-reset-policy.ts`, `hooks/submit/use-performance-submit-pipeline.ts`), DT v2 공연 폼(`features/performances/screens/performance-form`: `model/save-error.ts`·`round-mapping.ts`, `ui/VendorApiDialog.tsx`, `ui/fields/RoundRows.tsx`), DT 공용 `shared/ui/form/FormFileField.tsx`·`field-required.ts`, DT `product/decisions.md` 「폼」 첫 줄, TanStack Form 1.33.5 `form-core/dist/esm/metaHelper.js`·`FieldApi.js`(mount 정리), zod 4.4.3 `$ZodSuperRefineParams.when`. 사용자 결정(2026-10-28): 진행 중이면 버튼류를 잠그고 그 옆에 로딩 표시.

## 결정

| 항목 | 1.5 | DT v2 | web-kit 3.0 dev.6 | 고른 것과 이유 |
|---|---|---|---|---|
| 줄 작업과 오류 위치 | RHF `useFieldArray`(번호 경로 오류, 순서 변경 UI 없음) | TanStack `pushFieldValue`·`removeFieldValue` 직접 | `FormArrayField`가 TanStack `pushValue`·`removeValue` | **키트 `appendRow`·`removeRow`·`moveRow`(`rows.*`도 같은 함수)**. TanStack은 (1) 중첩 배열에서 경로의 첫 `[n]`(바깥 줄)을 바꿔 다른 줄의 오류를 옮기거나 지우고(`metaHelper.updateIndex`), (2) 줄 key가 고정된 화면에서는 새 이름으로 다시 마운트되는 칸의 정리(`FieldApi` mount cleanup)가 옮긴 오류를 처음 상태로 되돌린다. 키트는 값 반영을 먼저 끝내고(`flushSync`) 그 배열 바로 뒤 번호만 바꿔 오류를 옮긴다 |
| 저장 중 줄 작업 뒤 서버 오류 | 서버 오류를 칸에 붙이지 않음(토스트) | 같은 번호 경로 + 값 비교 | 같음 | **줄 작업 기록을 따라 지금 위치로**. 같은 값(예: 같은 종료 시각)을 가진 다른 줄이 그 번호로 오면 번호만 보는 방식은 그 줄에 붙인다. 줄 정체성은 키트 작업 기록으로 판단하고 값 안의 key로 추측하지 않는다(key 없는 폼도 같아야 한다). 지워진 줄의 오류는 폼 한 줄 |
| 요청 번호 ↔ 폼 번호 | — | `save-error.ts`가 서버 `events[i]` → `basic.events[i]`. 요청 변환은 완전히 빈 이벤트 줄을 빼지만(`savedEventRows`) schema가 이벤트명·연결 회차를 필수로 막아 저장 때 빠지는 줄이 없다. 등급·할인도 schema가 빈 줄을 막는다 | `fieldError(error)` | **바꾸지 않는다**. 저장 때 요청 배열 = 폼 배열임을 확인했다. 제출 값을 `fieldError`에 넘기는 입력을 검토했지만 쓰는 곳이 없어 두지 않았다. 요청이 줄을 빼고 보내는 폼이 생기면 그때 더한다 |
| 모달 하위 폼 | portal + `<form>` 없음, 확인 = 자체 검증 후 바깥 값에 씀, 닫기는 묻지 않음 | DT `FormDialog` + 제출 전파 차단 | `<Form>` 제출 전파 차단 + `Form.Dialog` 범위 | **5단계 구조 유지, 보장을 검사로 고정**(Enter·바깥 오류·바깥 dirty·결과 반영). 1.5처럼 묻지 않고 닫는 대화창은 `<Form protect={false}>` 값으로 하고 새 옵션을 두지 않는다 |
| 파일 칸 | `File[]`을 폼 상태에, 이름은 상태에서, 재마운트 가드, 저장 실패 뒤 유지 | DT `FormFileField`(비어 있음·기존·새 파일·제거, 선택 창 취소는 값 유지) | 없음 | **`Form.File` + `FormFileValue`(DT 네 상태 모델)**. 1.5의 보존 결과를 유지하면서, 선택 창 취소로 기존 파일을 잃지 않는 DT 규칙이 사용자에게 낫다. 네이티브 입력은 다시 그려지면 비므로 이름은 상태에서 그린다. 업로드는 `save`(1.5·DT 모두 저장 때 따로 올림) |
| 필수 표시 | 칸마다 `required` prop | `field-required.ts`가 zod 필드 schema를 읽음(조건부 필수 누락) | 칸마다 `required` 값·함수 | **schema 하나: 그 칸만 비운 지금 값을 schema가 거부하면 필수**(`editor.isRequired`). DT 사용자 규칙 "필수 표시는 검증 schema를 단일 출처"를 따른다. zod 내부 구조를 읽지 않고 Standard Schema 검증만 쓰므로 객체 refine의 조건부 필수(기획사 유형일 때 기획사)도 같은 규칙에서 나온다. 조건부 규칙은 다른 칸 오류가 있어도 돌게 쓴다(zod 4 `when`) |
| disabled 칸의 서버 오류 | — | field order 밖이면 한 줄 | 칸에 붙었다고 세고 칸은 숨김 → 안내 0 | **붙지 못한 오류로 센다**(5단계 독립 검증 F4). 고칠 수 없는 칸은 오류를 숨기는 규칙은 유지하고, 그 오류는 폼 한 줄로 알린다 |
| 저장 중 표시 | 버튼 `disabled`만 | 버튼 `disabled`만 | `aria-disabled`만 | **잠금 + 버튼 옆 `.wk-spinner`(문구는 `.wk-visually-hidden`)**. 사용자 결정. 4단계 다운로드 진행 표시와 같은 마크업이며 새 클래스를 만들지 않는다. 확인창·완료 확인창의 `pending`도 같은 표시 |
| 진행 표시 부품 공개(3.0.0-dev.8) | — | 공연 폼이 키트 `.wk-spinner` 마크업을 손으로 복사(`PerformanceForm.tsx`) | 표시 부품 `Pending`이 비공개(`ui/dialog.tsx`), 목록 다운로드는 같은 마크업을 따로 씀 | **`/ui`의 `Pending` 하나로 공개하고 목록 다운로드·`Form.Submit`·확인창이 같은 부품을 쓴다**. 키트 폼으로 아직 옮기지 않은 화면도 같은 부품을 써서 마크업이 갈라지지 않는다(`core-boundary.test.ts`가 `.wk-spinner`를 쓰는 소스를 `ui/pending.tsx` 하나로 고정) |
| 폼 안 Enter | 판매처 API 대화창에 `<form>`이 없어 Enter로 아무 일도 없었다. 바깥 폼 칸은 브라우저 암묵 제출, 검색어 칩 입력은 Enter = 추가(`search-field-input.tsx`) | 대화창 Enter = 대화창 확인 | `rows.enterAdds`, `List.Keywords` Enter = 추가, `Form.Dialog` 제출 격리 | **사용자 결정(2026-10-28): 폼에서 Enter는 기본적으로 제출(submit 클릭)이다. 단, [추가] 버튼이 딸린 입력칸(form-field-array, 검색어 칩 등)에서는 Enter가 제출 대신 [추가] 클릭으로 동작한다. 모달 안 입력칸의 Enter는 그 모달의 확인(모달 폼 제출)이며 바깥 폼은 제출되지 않는다.** 해석 정정(2026-10-28, 사용자 확정, 7단계 독립 검증 R6): 위 원문의 "[추가] 버튼이 딸린 입력칸"은 입력한 값을 [추가]가 목록에 넣는 칸(검색어 칩, 레퍼런스 게시판 폼의 제목 입력 + [추가])만이다. 줄마다 자기 칸이고 [추가]가 빈 줄만 더하는 배열 줄 입력(DT 공연 폼 등급명·회차 날짜 등)은 일반 칸이라 Enter = 페이지 폼 제출이다. 모달 안 칸의 Enter는 그 모달의 확인이며 바깥 폼은 제출도 검증도 되지 않는다. 판매처 API 대화창 Enter = 확인은 이 규칙이다(1.5와 다른 점: 1.5는 대화창 Enter 무반응). 키트는 새 옵션 없이 기존 값(`enterAdds`·`Form.Dialog`)으로 지키고 세 갈래를 `tests/form-enter.test.tsx`로 고정했다 |
| 구역 오류 처리(3.0.0-dev.8, 0003 §3 form 행 "오류 요약·구역 펼침·첫 오류 포커스") | `form-accordion`: 구역 기본 펼침, 머리글 「!」 배지, 제출 실패·서버 오류 때 오류 구역을 모두 열고 첫 오류에 포커스, 연 구역은 열린 채 | 공연 폼 `form-sections.tsx`(DT 전용, 같은 규칙 + 배지에 오류 수 숫자 — 승인 기록 없는 차이) | `Form.Section`은 제목·테두리만, `reveal` 값으로 프로젝트가 열어야 함 | **키트가 소유: `Form.Section fields`와 `FormSection`(키트 Form 밖의 폼용)**. 구역 구성(어느 칸이 어느 구역)만 값(`fields`, 정확한 경로나 접두)이고 열림·오류 수·제출 뒤 펼침은 키트가 한다. **사용자 결정(2026-10-28): 열고 닫는 로직은 참조 프로젝트 `use-form-sections`의 사건 방식(거절된 제출마다 — 클라이언트 검증 실패·서버 필드 오류 도착 — 오류 구역을 모두 펼치고 첫 오류에 포커스, 그 밖은 사용자 열림 상태, 제출 횟수 기록 없음), 보이는 것은 1.5(머리글 「!」, 화면 낭독기는 오류 수 `messages.sectionErrors`)**. 3.0.0-dev.8의 제출 횟수 비교 방식은 저장 중에 닫은 구역에 늦게 온 서버 오류를 펼치지 못해 3.0.0-dev.9에서 바꿨다. 접을 수 있으려면 자기 칸을 알아야 한다(오류를 숨긴 채 닫혀 있지 않게). DT `form-sections.tsx`는 지웠다 |
| 기본 여백 초기화 | — | — | `.wk-field`·`.wk-section`·`.wk-form-failure`에 클래스 우선순위 `margin: 0` | **`:where(...)`로 0 우선순위**. 클래스 우선순위 초기화가 Tailwind v4 `space-y-*`(`:where` 선택자)를 지워 DT 운영자 등록에서 오류 문구 아래에 다음 라벨이 붙었다 |

## DT에 남긴 공용과 이유

- `shared/ui/form/FormFileField.tsx`: 공연 폼 바깥(좌석배치도)이 아직 DT `useAppSaveForm`이라 키트 `Form` context가 없다. 바깥 폼을 키트로 옮길 때 `Form.File`로 바꾸고 지운다. 보존 결과는 DT 화면 테스트로 확인했다.
- `shared/ui/form/field-required.ts`: 공연 폼 등 키트로 옮기지 않은 폼이 쓴다. 키트 폼은 쓰지 않는다.
- DT 공연 판매처 API 대화창은 키트 `Form.Dialog`·`Form.Array`로 옮겼다. 바깥 공연 폼의 줄 작업 호출은 키트 `appendRow`·`removeRow`를 쓴다.
- DT 공연 폼 저장 버튼 옆 진행 표시: 바깥 폼이 DT `SaveForm`이라 `Form.Submit`이 그리지 않는다. 3.0.0-dev.8부터 키트 `/ui`의 `Pending`을 쓴다(그전에는 마크업을 복사했다). 바깥 폼을 키트로 옮기면 `Form.Submit`이 그리므로 그 줄을 지운다.

## 검토한 대안

| 대안 | 판단 |
|---|---|
| TanStack 줄 작업을 그대로 쓰고 저장 뒤 오류만 다시 계산 | 서버 오류는 다시 계산되지 않는다. 중첩 배열과 고정 key 화면에서 오류가 사라지거나 다른 줄로 간다 |
| 줄 정체성을 값 안의 `key` 필드로 판단 | key 없는 폼(목록 입력 등)에서 보장이 사라지고, 어떤 필드가 key인지 설정해야 하는 옵션이 생긴다 |
| 저장 중에는 줄 구조 변경을 막는다 | "저장 중 편집 보존" 보장을 줄인다 |
| 필수 표시를 zod 필드 schema에서 읽기(DT `field-required`) | 조건부 필수가 빠지고 zod 내부 구조에 묶인다 |
| 칸마다 `required` 값 유지 | 같은 규칙이 schema와 화면에 두 번 있어 갈라진다. DT 사용자 규칙과 맞지 않는다 |
| 파일을 고르는 즉시 업로드 | 저장하지 않고 떠나면 서버에 고아 파일이 남고, 1.5·DT 모두 저장 때 올린다 |
