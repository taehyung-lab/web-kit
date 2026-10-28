---
name: web-kit-form
description: 등록·수정·대화창 폼의 저장·저장 확인·저장 완료 확인·이탈 보호·필드 오류·선택지 상태·원본 갱신·줄 추가/삭제 입력, 폼 없는 삭제·상태 변경 확인, 기본 부품(버튼·입력·대화창)을 만들거나 바꿀 때 읽는다. 요청·실패 해석은 web-kit-http, 원본 단건 상태는 web-kit-record로 보낸다.
---

# web-kit form

`/form`의 `useSaveForm`(저장 수명)과 `/form/ui`의 `Form` 묶음 부품·`FormGuard`, `/ui`의 기본 부품, `/testing`의 폼 검사를 쓰는 기준이다. 인자와 타입은 설치된 소스를 따른다.

## 기본 폼 UI

앱(Router 안)에 `FormGuard`를 한 번 둔다. 화면은 `const editor = useSaveForm({...})`를 만들고 `<Form editor={editor}>` 안에 부품을 원하는 배치로 둔다. 각 부품은 같은 편집 상태를 context로 읽어서, 칸·버튼·오류 줄의 위치를 바꿔도 저장·검증·focus 연결을 다시 쓰지 않는다. 칸 이름을 값 타입으로 좁히려면 `const F = Form.of<Values>()`로 같은 부품을 쓴다.

- 칸: `Form.Text`·`TextArea`·`Select`·`Checkbox`·`Array`. 입력을 프로젝트 부품으로 바꿀 때는 `Form.Field`의 render 함수가 받는 `control`(id·aria·value·change·blur)을 그 입력에 건다. 값·검증·오류 표시·첫 오류 focus는 그대로 남는다.
- `required`는 별표와 `aria-required`만 맡는다(검증은 schema). 조건부 필수는 같은 업무 조건을 `(values) => boolean`으로 준다. schema에서 필수를 추측하지 않는다.
- 고칠 수 없는 칸(`disabled`)은 오류를 숨긴다.
- `Form.Text`·`TextArea`의 `maxLength`는 길어지는 편집만 거부한다(한글 조합 커밋도). 서버가 준 초과 초기값은 줄일 수 있다. `showCount`면 글자 수를 보인다.
- `Form.Select`는 값이 비었을 때만 빈 선택지(`placeholder`)를 둔다. 서버 선택지는 `status`('loading'·'ready'·`{ failure }`)와 `onRetry`로 그 칸 자리에 불러오는 중·실패·다시 시도를 보인다. `onChange`는 사용자가 고른 직후에만 불린다(함께 비울 값).
- `Form.Failure`: 폼 수준 한 줄. 칸에 붙지 못한 저장 실패와, 저장 뒤 완료 처리 실패(다시 시도 = 완료 처리만)를 보인다. 서버 필드 오류가 모두 칸에 붙은 검증 실패는 그리지 않는다. 위치는 놓는 곳이 정한다.
- `Form.Submit`은 저장 중·확인 대기·완료 처리 중에 `aria-disabled`로 잠긴다(`disabled`로 바꾸지 않아 포커스가 남는다).
- `Form.Cancel to={...}`: 입력이 있으면 취소 문구로 한 번 묻고 이동한다. `Form.Dialog` 안이면 그 대화창을 닫는다. 저장 중이면 아무것도 하지 않는다.
- `Form.Confirm`: `useSaveForm({ confirm: true })`의 저장 전 확인창. 제출한 값(snapshot)을 children에 주고 그 값으로 저장한다. 저장 중에는 닫히지 않는다.
- `Form.Saved`: `useSaveForm({ acknowledge: true })`의 저장 완료 확인창. 확인이 `onSaved`(보통 이동)를 한 번 실행한다. Esc·바깥 클릭으로 닫히지 않는다.
- `Form.Dialog`: 대화창 안 폼. 닫기·취소는 그 안의 폼만 보고 묻는다. 안쪽 제출은 바깥 폼을 제출하지 않는다.
- 이탈: `FormGuard`가 등록된 폼 중 하나라도 입력이 기준선과 다르면 Router 이동·브라우저 이탈을 한 번 묻고, 저장 중이면 묻지 않고 막는다. 저장 성공 뒤 이동은 묻지 않는다. Router를 거치지 않는 이탈(같은 메뉴 다시 누르기)은 `useLeave()(run, reason)`로 같은 판정을 받는다. 확인 뒤 `run`이 이동하면 `ignoreBlocker: true`로 이동한다. 로그인 같은 제품 예외만 `<Form protect={false}>`.
- 문구는 `FormGuard messages`(까닭별: navigate·cancel)·`Form messages`·`formatError`(칸 오류 값 → 문구)·`renderFailure(failure, place)`(place: save·completion·options, `null`이면 그 자리에 그리지 않음), 모양은 `--wk-*` 토큰으로 바꾼다. 새 화면마다 Field·이탈 확인·확인창을 다시 만들지 않는다.

## 기본 부품

`/ui`: `Button`·`Input`·`TextArea`·`Select`·`Checkbox`·`Dialog`·`ConfirmDialog`·`AlertDialog`. 대화창은 열린 순간 첫 칸에 포커스하고 Tab·Shift+Tab 순환을 창 안에서 같은 이벤트로 처리한다(포커스가 창 밖에 한 순간도 나가지 않는다). `ConfirmDialog`는 실행 중(`pending`) 닫기·재실행을 막고, `AlertDialog`는 확인만 받으며 연타해도 한 번만 알린다.

## headless 연결

특수 표현 때문에 `useSaveForm`을 부품 없이 쓰는 경우 아래 계약에 맞춰 연결한다. 기본 폼 UI는 이 연결을 이미 포함한다.

## 화면 선언

- schema: 동기 Standard Schema(zod 4). 비동기 검증은 받지 않는다. 폼 값의 File·Blob은 복사되지 않고 그대로 저장 함수까지 간다.
- `source { id, values }`: 원본을 폼 값으로 바꾼 것. 등록 화면이면 기본값이다.
- `save(values, submitted)`: 서버가 저장 결과를 주면 폼 값으로 바꿔 `{ saved }`로 돌려준다.
- 필요할 때만 선언하는 것:
  - `confirm`
  - `fieldError`: 서버 필드를 폼 경로와 문구로 바꾼다.
  - `reveal`: 접힌 섹션을 연다.
  - `onSaved(result)`: 이동·알림. 저장 함수가 돌려준 값을 그대로 받는다(등록 뒤 새 id 등).
  - `acknowledge`: 저장 뒤 사용자 확인(`complete()`)을 기다린 다음 `onSaved`를 실행한다.
- 입력 control의 id는 `fieldId(name)`을 쓰고, 같은 id를 `FieldFrame`에 넘긴다. 체크 트리(`CheckboxTree`)는 그 id를 `id`로 받으며, 검증 오류의 focus가 그 그룹으로 온다.
- 줄을 추가·삭제하는 입력은 아래 「줄 추가·삭제 입력」을 따른다.

## 줄 추가·삭제 입력

연락처처럼 줄을 늘렸다 줄이는 입력은 항상 `FormArrayField`로 만든다. 폼 라이브러리의 배열 필드(`mode="array"`)를 직접 조립하지 않는다.

- 삭제 버튼은 `rows.canRemove`가 참일 때 각 줄에 그린다. 현재 줄 수가 `minItems`보다 클 때만 삭제할 수 있다. 최소 한 줄이 필요한 프로젝트는 `minItems={1}`을 지정한다. 최소 줄 수를 생략하면 마지막 줄도 삭제할 수 있다.
- 줄 안 입력의 `onKeyDown`에 `rows.enterAdds(add)`를 건다. Enter는 추가 버튼의 `add`를 그대로 부른다. 그래서 추가 버튼이 빈 값에서 오류를 보이면 Enter도 같은 오류를 보인다. 폼 제출은 하지 않고, 한글 조합 중이거나 최대 줄 수일 때는 추가하지 않는다.
- `rows.items`는 줄 안의 값이 바뀔 때도 새로 그려져, 추가 버튼이 낡은 값을 보지 않는다.
- 프로젝트가 정하는 것: 빈 줄의 값, 최소·최대 줄 수(`minItems`·`maxItems`), 줄의 모양과 문구.

## 키트 보장

- 제출 흐름:
  - 제출은 `submit()` 하나다. 이미 떠 있는 blur 오류가 있어도 전체 검증을 다시 돌린다. 검증에 실패하면 저장과 확인창이 0건이고, 화면 순서상 첫 오류 입력으로 focus한다. 칸을 떠날 때의 검증은 TanStack 필드 `validators.onBlur`로 둔다.
  - 진행 중이거나 확인 대기 중일 때의 재제출은 무시한다.
  - 확인창이 있든 없든 저장 경로는 하나다. 확인창에 보여 준 snapshot S와 실행하는 S는 같다(`stage.values`).
- 성공:
  - 저장 결과가 있으면 그것이, 없으면 S가 기준선이 된다.
  - 저장 중에 입력이 그대로였다면 저장 결과를 입력에도 넣는다. 바뀌었다면 입력을 보존하고 기준선만 바꾼다.
  - `isDirty`는 현재 값이 기준선과 다른지를 뜻한다. 차이로 요청을 만드는 화면은 `baseline`을 읽는다(직접 따로 들지 않는다).
  - 저장이 끝나면 단계는 `saved`다. `onSaved`는 그 직후(`acknowledge`면 `complete()` 때) 한 번 실행되고 재조회를 기다리지 않는다. 끝날 때까지(Promise면 settle까지) 제출은 잠긴다.
  - 완료 처리(`onSaved`) 실패는 `completionFailure`이며 성공한 저장을 되돌리지 않는다. 단계는 `saved`에 남아 다시 저장 요청이 나가지 않고, `complete()`가 완료 처리만 다시 한다.
- 실패:
  - 실패는 `failure`에 그대로 담기고 `cancelled`만 빠진다. 입력과 기준선은 유지된다.
  - 서버 필드 오류는 화면에 있고 제출 값과 현재 값이 같은 필드에만 붙는다. 붙지 못한 오류(저장 중 바뀐 필드, 폼 경로로 바꾸지 못한 것, 화면에 없는 필드)는 `unattachedFieldErrors`로 나온다. 다음 제출이 지난 서버 오류를 지운다.
  - `formFailure`는 폼 수준에 보일 실패다. 서버 필드 오류가 모두 칸에 붙은 검증 실패면 `undefined`다.
  - 입력 탓인 실패(예: 로그인 아이디·비밀번호 불일치)는 `clearFailureOnEdit(failure)`가 true를 돌려주게 하면, 지금 입력이 실패한 제출 때 입력과 달라지는 동안 `failure`·`unattachedFieldErrors`에서 빠진다. 연결 실패처럼 입력과 무관한 실패는 false로 두어 남긴다. 기본은 지우지 않는다.
  - `failure.resultUnknown`이면 반영 여부를 확인할 수 없다는 뜻이다. 다시 저장하기 전에 다시 읽기를 안내하는 일은 화면이 정한다.
- 원본 재도착(같은 `id`의 새 `values`):
  - 입력이 기준선과 같으면 교체한다.
  - 다르면 입력을 유지한다.
  - 확인 대기·저장 중이면 끝난 뒤에 판단한다.
- `id`가 바뀌거나 화면을 떠나면 진행 중이던 저장 결과(기준선·오류·focus·`onSaved`)를 적용하지 않는다.

## 프로젝트 연결

- headless 화면만 확인창·이탈 연결을 직접 맡는다(이탈은 `useLeave`·`FormGuard`의 판정을 쓴다). 기본 UI를 쓰는 화면에는 별도 보호를 겹치지 않는다. `onSaved`가 불리는 순간 화면은 이미 저장 결과를 반영한다(저장 중 입력이 그대로면 clean, 바뀌었으면 입력을 보존한 dirty). 그러므로 저장 직후 이동에서 이탈 보호를 우회하지 않는다.
- 오류 문구는 `createFormMessages(prefix)`로 번역 참조를 저장하고, 렌더할 때 해소한다.
- 서버 필드 이름과 폼 경로의 대응은 `fieldError`가 정한다.

## 폼 없는 확인 실행

삭제·상태 변경처럼 입력 없이 확인만 받는 작업은 `/dialog`의 `useConfirmationState`에 실행 함수와 실패 처리를 연결한다. `request`로 대상을 정하고 `confirm`으로 실행한다. 실행 중에는 재실행·닫기·대상 교체가 막힌다. 성공하면 닫힌다. 실패는 `onError`가 닫기 또는 보이기를 정한다. 표시는 `/ui`의 `ConfirmDialog`에 `state`를 연결한다.

## 확인 방법

- 프로젝트가 자기 칸 틀·확인창을 만들면 `/testing`의 `checkFieldAdapter`와 `checkConfirmDialogAdapter`를 한 번 돌린다.
- 화면 흐름에서 관찰할 것:
  - 클라이언트 검증 실패 시 요청 0건과 첫 오류 focus
  - 저장 중 중복 요청 0건
  - 저장 중 입력 보존
  - 레코드 전환 뒤 이전 결과 미적용
- focus·키보드·Dialog는 실제 브라우저로도 확인한다.
