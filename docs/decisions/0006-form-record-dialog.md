# 0006. 폼·상세·대화창: 저장 수명은 상태가, 배치는 부품 묶음이, 포커스는 대화창이 맡는다

- 상태: 채택 (2026-10-28, 3.0 5단계 구현)
- 관련 결정: [0003](0003-web-kit-3-redesign.md) §3 form·record 행, §4 구조 규칙, 순서 5단계 행. [0005](0005-list-filter-table-permission.md)의 부품 구조(`<List model>` + `List.*`)를 폼·상세에도 쓴다. 보장 내용의 정본은 `packages/web-kit/skills/web-kit-form`·`web-kit-record`이며 여기에는 결정·이유·출처만 둔다.
- 근거 자료: DT v2 운영자 등록·수정·상세(`apps/admin/src/features/settings/screens/operator-form`·`operator-detail`)와 DT 공용(`shared/ui/form/*`·`shared/ui/dialog/*`·`shared/ui/detail/*`), 레퍼런스(`src/shared/ui/form/FormSaveDialogs.tsx`·`submit-form.ts`·`FormField.tsx`·`useInitialFocus.ts`, 약관 등록 `src/features/terms/screens/terms-form`), DT 1.5(`v1.5` 태그) 운영자 폼, web-kit 2.0 `form/ui.tsx`·`ui/dialog.tsx`·`detail-ui.tsx`, Base UI 1.7.0 `floating-ui-react/components/FloatingFocusManager.js`.

## 결정

| 항목 | DT v2 | 레퍼런스 | web-kit 2.0 | 고른 것과 이유 |
|---|---|---|---|---|
| 로직과 부품의 연결 | 키트 `useSaveForm` + DT `useAppSaveForm`(오류 문구·한 줄 규칙·이탈 등록) + 칸마다 `form` prop | 화면마다 `useConfirmedSaveForm` + 칸마다 `form` prop | `SaveForm` render prop이 typed fields를 children에 줌 | **`useSaveForm` + `<Form editor>` + `Form.*` 부품(context)**. 0005와 같은 구조라 칸·버튼·오류 줄을 옮겨도 연결을 다시 쓰지 않는다. render prop은 배치가 한 함수 안에 갇혔고, prop 연결은 칸마다 같은 배선을 반복했다. 타입은 `Form.of<Values>()`로 좁힌다 |
| 저장 성공 뒤 | `SavedDialog`를 화면이 상태로 열고 확인에서 이동. 이동 실패 뒤 저장 버튼이 다시 열림 | `FormSaveDialogs`(확인·완료 한 쌍) | `onSaved` 즉시 실행, 실패는 `completionFailure`지만 단계는 idle이라 다시 저장 가능 | **단계 `saved` + `acknowledge` 값 + `complete()`**. 0003 반례 "저장은 성공했는데 이동 실패 후 다시 저장 요청"을 상태가 막는다(완료 처리가 끝날 때까지 제출 잠금, 다시 시도는 완료 처리만). 완료 확인창은 화면 값(`acknowledge`)이다. 1.5 운영자는 확인 없이 완료 알림만, 레퍼런스 약관은 확인+완료라 둘 다 같은 코드에 값만 다르다 |
| 폼 한 줄 오류 | DT가 "필드 오류가 모두 칸에 붙었으면 한 줄 없음" 규칙을 직접 계산 | 분류 함수가 root를 따로 냄 | 저장 실패 문구 + 붙지 못한 오류 문구를 둘 다 표시 | **키트 `formFailure`가 판정**, 문구는 `renderFailure(failure, place)`(0005와 같은 규칙, `null` = 그리지 않음). 같은 규칙을 프로젝트마다 다시 계산했다 |
| 필수 별표 | zod schema를 읽어 추측(`field-required.ts`). 조건부 필수는 별표가 안 붙음 | `required` prop | `required` 값 또는 함수 | **`required` 값 또는 `(values) => boolean`**. schema 추측은 zod 내부에 묶이고 조건부 필수를 놓쳤다. 1.5 운영자 폼도 `required` prop이었다(기획사·수정 비밀번호는 조건부) |
| 선택지 상태 | `OptionsStateSlot`(불러오는 중·실패·재시도, 재시도 뒤 포커스 이동) | select에 로딩 표시만 | 없음 | **`Form.Select status onRetry`**. DT 방식이 사용자에게 가장 낫다(실패를 빈 select로 숨기지 않고 그 자리에서 다시 시도). 문구는 `renderFailure(…, 'options')` |
| 빈 선택지 | 값이 비었을 때만 둠 | 항상 둠 | 프로젝트가 선택지에 넣음 | **값이 비었을 때만**. 필수 선택을 고른 뒤 다시 비워 저장 실패를 만드는 길을 없앤다 |
| 글자 수 제한 | 길어지는 편집만 거부(IME 안전) + 글자 수 표시 | 네이티브 `maxLength` | 없음 | **DT 방식을 `Form.Text·TextArea maxLength`(+`showCount`)로**. 네이티브는 한글 조합 커밋에서 꼬리를 자른다 |
| 이탈 확인 | `UnsavedChangesProvider`(Router blocker·beforeunload·취소/이동 문구 두 벌) + `useLeaveConfirmation` | `UnsavedChangesGuard` | `FormNavigation`(판정 소유자 `createFormNavigation`, 범위·대화창 포함) | **2.0 판정 소유자 유지 + `FormGuard`(문구 두 벌은 `messages` 값) + `useLeave()`**. 판정(범위·저장 중 거부·허가 무효화)은 2.0이 가장 넓게 검사돼 있었다. DT가 쓰던 취소/이동 문구 구분과 Router 밖 이탈(같은 메뉴 다시 누르기)을 값과 훅으로 더했다 |
| 대화창 포커스 | Radix `AppDialog` | `primitives` adapter | Base UI Dialog 기본 포커스 가두기 | **키트 `Dialog`가 열리는 순간 첫 칸에 동기 포커스 + Tab 순환을 keydown에서 직접 처리**. 아래 「확인창 포커스」 |
| 저장 버튼 잠금 | `disabled` | `disabled` | 확인 대기 중 `disabled` | **`aria-disabled`**. `disabled`가 되는 순간 포커스가 본문으로 떨어져 확인창을 닫은 뒤 돌아올 자리가 사라진다 |
| 대화창 안 폼 | `FormDialog`(DT) + 제출 이벤트 전파 차단 | 화면별 | `FormDialog`(범위) | **`Form.Dialog`(범위) + `<Form>`이 제출 이벤트를 멈춤**. 중첩 모달 제출 격리 전체 검증은 6단계다 |
| 상세 | `RecordBoundary`(상태별 문구, 앱 경계 무표시), `DetailField`('-'), `UpdateHistory`(날짜 포맷 포함) | `RecordView`류 | `RecordView`·`DetailField`(class 주입)·`HistoryList` | **`<Record state>` + `Record.Fields·Field·History`**, 문구는 `renderFailure(failure, place)`·`missing`. 날짜 포맷은 프로젝트 정책이라 `History`는 이미 쓴 일시를 받는다 |
| 기본 부품 위치 | `shared/ui/dialog/AppDialog` 등 | `primitives` | `form/ui`가 다시 내보냄 | **`/ui` 입구**. 폼이 아닌 곳(목록 일괄 확인·삭제 확인)도 쓰는데 `/form/ui`에 두면 목록이 폼을 import하게 된다(0003 §4) |

### 확인창 포커스 (starter 「save confirmation traps focus」)

- 재현: 변경 전 10회 중 7회 실패.
- 원인: Base UI `FloatingFocusManager`는 팝업 앞뒤에 `data-base-ui-focus-guard` span을 **팝업 밖 형제로** 두고, 마지막 칸에서 Tab을 누르면 그 guard에 포커스를 둔 뒤 `requestAnimationFrame`에서 첫 칸으로 옮긴다(`enqueueFocus`). 그 한 프레임 동안 `document.activeElement`가 창 밖이다. 첫 포커스도 rAF라 열린 직후 Tab이 창 밖에서 시작할 수 있었고, 2.0은 확인 대기 중 저장 버튼을 `disabled`로 바꿔 포커스를 본문으로 떨어뜨렸다.
- 수정: 키트 `Dialog`가 팝업 keydown에서 끝↔끝 순환을 같은 이벤트 안에서 하고(guard에 포커스가 가지 않음), 열리는 커밋에서 첫 칸에 동기 포커스한다. 검사는 바꾸지 않았다. 수정 뒤 20회 연속 통과, Tab 처리만 빼면 10회 중 9회 실패로 돌아오는 것을 확인했다.

## 의존 방향

- `/form`(로직)·`/record`는 UI를 import하지 않는다. `/form`·`/form/ui`는 목록(`/list`·`/search`)을, 목록은 폼을 import하지 않는다. 폼·상세·`/ui`는 세션 타이머·권한을 import하지 않는다(`tests/core-boundary.test.ts`).

## DT에 남긴 공용과 이유

운영자 등록·수정·상세는 아래를 import하지 않는다. 다른 화면이 아직 쓰므로 그 화면이 키트로 옮겨질 때 지운다. 키트에 옛 API 호환 래퍼는 두지 않았다.

- `shared/ui/form/use-app-save-form.ts`·`SaveForm.tsx`·`FormField.tsx`·`FieldFeedback.tsx`·`field-required.ts`·`FormTextField.tsx`·`FormSelectField.tsx`·`options-state.tsx`·`FormErrorLine.tsx`·`FormFileField.tsx`: 공연 폼·공연 대화창(판매처 API·3차 인증)·인증 화면(로그인·2단계 인증·비밀번호 변경·인증기 등록).
- `shared/ui/form/UnsavedChangesGuard.tsx`: 공연 등록·수정과 인증 화면, 사이드바. 이행 기간에는 키트 `FormGuard`와 함께 마운트되며 각자 자기 폼만 본다.
- `shared/ui/dialog/SavedDialog.tsx`: 공연 등록·수정. `useConfirmation.tsx`·`ConfirmDialog.tsx`: 공연 상세·예매 목록. `AppDialog.tsx`: 세션·권한 모달 등 다수.
- `shared/ui/detail/RecordBoundary.tsx`·`DetailField.tsx`·`UpdateHistory.tsx`: 공연 상세·수정·3차 인증 대화창.
- 새로 둔 것: `shared/ui/form/kit-form.ts`(DT 문구표·앱 경계·필드 순서 → 키트 값), `kit-form-guard.tsx`(DT 문구의 `FormGuard`), `shared/ui/detail/kit-record.ts`. 제품 정책을 값으로 바꾸는 곳이라 키트로 옮기지 않는다.
- 바꾼 것: `shared/ui/form/form-error-message.ts`는 키트 `createFormMessages('@form-error:')`를 쓴다(같은 인코딩의 두 번째 구현을 없앰).

## 검토한 대안

| 대안 | 판단 |
|---|---|
| Base UI 포커스 가두기를 그대로 두고 검사에서 한 프레임 기다리기 | 실제 키보드 사용자도 한 프레임 동안 창 밖 요소에 포커스가 있다(스크린리더가 읽을 수 있다). 검사 완화 금지 |
| 완료 처리 실패 뒤 idle로 돌리고 "다시 저장 버튼을 숨기라"고 문서화 | 0003 반례 그대로다. 상태가 막아야 한다 |
| 필수 별표를 Standard Schema에서 추측 | 비동기·조건부 규칙을 판정할 수 없고 zod 내부 구조에 묶인다 |
| 이탈 확인을 DT `UnsavedChangesProvider` 하나로 유지하고 키트 폼이 거기에 등록 | 키트가 프로젝트 부품에 의존하게 된다. 이행 기간의 두 Provider는 각자 자기 폼만 보므로 한쪽만 묻는다 |
| `Form.Checkbox`를 Base UI Checkbox로 | 라벨 클릭·폼 제출 값·`getByLabelText`가 네이티브와 다르다. 폼 안 체크 한 개는 네이티브가 단순하다. 목록의 일부 선택(indeterminate)은 `/ui` `Checkbox`(Base UI)를 쓴다 |
