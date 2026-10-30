---
name: web-kit-form
description: 등록·수정·대화창 폼의 저장·저장 뒤 추가 작업·이탈 보호 제외·저장 확인·저장 완료 확인·저장 중 표시(화면 전체 진행 덮개 포함)·이탈 보호·필드 오류·필수 표시·선택지 상태·원본 갱신·줄 추가/삭제/이동 입력·파일 칸, 폼 없는 삭제·상태 변경 확인, 기본 부품(버튼·입력·대화창)을 만들거나 바꿀 때 읽는다. 요청·실패 해석은 web-kit-http, 원본 단건 상태는 web-kit-record로 보낸다.
---

# web-kit form

`/form`의 `useSaveForm`(저장 수명)·연결 hook·Provider와 registry `form`의 `Form`·`FormGuard` 복사본을 쓰는 기준이다. registry는 프로젝트에 설치해 소유하는 UI 원본 묶음이다. 입력·대화창·진행 표시는 registry `inputs`·`dialog`·`pending`·`blocking-progress`로 설치한다. 인자와 타입은 설치된 소스를 따른다.

이 책임만 골라 사용할 수 있다. 선택한 한 책임 안에서는 키트 수명 처리와 자체 구현을 섞지 않는다. 선택 설치 peer(해당 기능을 쓸 때만 설치하는 동료 라이브러리)를 설치하지 않아 실행하지 못한 기능은 "검사하지 않음"으로 기록한다. 예시는 같은 버전의 실제 starter 코드에서 가져와 패키지에 함께 담는다. 링크로 읽고 조립 방식만 참고한다. 예제만 따로 실행하는 용도는 아니다.

## registry 폼 UI

실제 조립 예: [apps/starter/src/features/products/screens/ProductForm.tsx](../../references/apps/starter/src/features/products/screens/ProductForm.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

registry `form`의 `FormGuard`를 앱(Router 안)에 한 번 둔다. 복사본은 `/form`의 `useFormGuardBinding`과 `FormGuardProvider`, `useFormRootBinding`과 `FormBindingProvider`로 연결한다. 화면은 `const editor = useSaveForm({...})`를 만들고 `<Form editor={editor}>` 안에 부품을 원하는 배치로 둔다. 각 부품은 같은 편집 상태를 context로 읽어서, 칸·버튼·오류 줄의 위치를 바꿔도 저장·검증·focus 연결을 다시 쓰지 않는다. 칸 이름을 값 타입으로 좁히려면 `const F = Form.of<Values>()`로 같은 부품을 쓴다.

- 칸: `Form.Text`·`TextArea`·`Select`·`Checkbox`·`File`·`Array`. 입력을 프로젝트 부품으로 바꿀 때는 `Form.Field`의 render 함수가 받는 `control`(id·aria·value·change·blur)을 그 입력에 건다. 값·검증·오류 표시·첫 오류 focus는 그대로 남는다.
- 필수 표시(별표·`aria-required`)의 출처는 schema 하나다. 칸마다 `required`를 적지 않는다. 키트는 지금 값에서 그 칸만 비운 값(문자열 '', 목록 [], 체크 false, 파일 비어 있음)을 schema로 검증해 그 칸에 오류가 나면 필수로 본다(`editor.isRequired`). 그래서 다른 칸 값에 따른 조건부 필수도 같은 규칙에서 나온다. 단, 그런 규칙은 다른 칸 오류가 있어도 돌게 쓴다(zod 4: 객체 `superRefine(fn, { when: () => true })`). 기본값이면 다른 칸이 비어 있는 동안 규칙이 건너뛰어져 별표가 빠진다.
- 고칠 수 없는 칸(`disabled`)은 오류를 숨긴다. 서버 필드 오류가 그 칸으로 대응되면 칸에 붙은 것으로 세지 않고 폼 한 줄(`Form.Failure`)로 알린다.
- `Form.Text`·`TextArea`의 `maxLength`는 길어지는 편집만 거부한다(한글 조합 커밋도). 서버가 준 초과 초기값은 줄일 수 있다. `showCount`면 글자 수를 보인다.
- `Form.Select`는 값이 비었을 때만 빈 선택지(`placeholder`)를 둔다. 서버 선택지는 `status`('loading'·'ready'·`{ failure }`)와 `onRetry`로 그 칸 자리에 불러오는 중·실패·다시 시도를 보인다. `onChange`는 사용자가 고른 직후에만 불린다(함께 비울 값).
- `Form.Section`: 칸 묶음. `fields`(이 구역 칸의 정확한 경로나 접두, 예 `['order.grades']`)를 주면 접을 수 있는 구역이다. 처음엔 펼침, 머리글 버튼으로 닫고 연다(닫혀도 칸은 마운트된 채 숨김). 열림 규칙: 제출이 거절될 때마다(클라이언트 검증 실패, 서버 필드 오류 도착, `save`가 던진 `FormRejection`) 실패한 칸을 가진 구역을 모두 펼친 다음(실패 칸이 없는 구역은 그대로) 화면 순서 첫 오류 칸에 포커스한다. 저장 중에 사용자가 닫은 구역도 그 저장의 서버 오류가 오면 펼친다. 그 밖의 열고 닫기는 사용자 상태라, 펼쳐진 구역은 고쳐도 열린 채이고 사용자가 닫으면 다음 거절까지 닫힌 채다. 머리글 오류 표시는 프로젝트가 고른다. 기본: 구역 칸에 오류(클라이언트·서버)가 있으면 머리글에 「!」, 화면 낭독기는 제목과 `messages.sectionErrors(count)`(기본 `오류 N개`)를 읽는다. `errorMarker={(errorCount) => …}`를 주면 그 표시로 바꾼다(예: 보이는 "오류 2개" 배지). 바꾼 표시는 화면 낭독기가 읽을 문구까지 책임진다. 키트 `Form` 밖의 폼은 `FormSection`(`form`·`fields`·`title`·`errorLabel`, 선택 `errorMarker`)을 같은 규칙으로 쓴다. 구역 열림·오류 수를 프로젝트가 따로 만들지 않는다.
- `Form.Failure`: 폼 수준 한 줄. 칸에 붙지 못한 저장 실패와, 저장 뒤 완료 처리 실패(다시 시도 = 완료 처리만)를 보인다. 서버 필드 오류가 모두 칸에 붙은 검증 실패는 그리지 않는다. 위치는 놓는 곳이 정한다.
- `Form.File`: 값은 `FormFileValue`(`empty`·`existing{name}`·`selected{file}`·`removed`). 지금 파일 이름을 상태에서 그리고 입력의 설명으로 잇는다. 선택 창을 열었다 취소해도 값은 그대로이고, 지우는 길은 제거 버튼 하나다(기존 파일이면 `removed`). 고른 File은 다른 칸 오류·재마운트·대화창 열고 닫기·저장 실패 뒤에도 같은 객체로 남아 다시 저장하면 그대로 보낸다. 업로드와 `removed`의 요청 변환은 `save`가 한다.
- `Form.Submit`은 저장 중·확인 대기·완료 처리 중에 `aria-disabled`로 잠긴다(`disabled`로 바꾸지 않아 포커스가 남는다). `Form.Cancel`도 그동안 잠긴다. 저장 중 표시는 폼 종류로 갈린다.
  - 등록·수정 폼은 `useSaveForm({ progress: 'create' | 'edit' })`로 종류를 선언한다. 저장하는 동안(완료 창이 없으면 완료 처리·이동이 끝날 때까지) 앱 셸의 `BlockingProgress`가 화면 전체를 덮고 그 종류의 문구를 띄운다. 버튼 옆 진행 표시는 그리지 않는다. 최소 표시·지연은 없다.
  - 선언하지 않은 폼(로그인·대화창 폼)은 덮개 없이 저장 요청·완료 처리 중 버튼 바로 뒤에 진행 표시(`Pending`, 문구 `messages.saving`은 화면 낭독기용)가 선다.
  - 저장 함수가 저장 도중 사용자에게 묻는다면(예: 지워질 회차 확인) 그 물음을 `save`의 세 번째 인자 `step.waitForUser(물음)`으로 감싼다. 묻는 동안 덮개가 내려가고 답한 뒤 저장이 이어지면 다시 덮는다. 감싸지 않으면 물음 창 뒤에 "수정 중" 덮개가 남는다.
- `Form.Cancel to={...}`: 입력이 있으면 취소 문구로 한 번 묻고 이동한다. `Form.Dialog` 안이면 그 대화창을 닫는다. 저장 중이면 아무것도 하지 않는다.
- `Form.Confirm`: `useSaveForm({ confirm: true })`의 저장 전 확인창. 제출한 값(snapshot)을 children에 주고 그 값으로 저장한다. 덮개를 선언한 폼은 확인하면 닫히고 덮개가 저장 중을 맡는다(확인창 → 덮개 → 완료 창). 선언하지 않은 폼은 저장 중에 닫히지 않고 확인 버튼 옆에 진행 표시를 둔다.
- `Form.Saved`: `useSaveForm({ acknowledge: true })`의 저장 완료 확인창. 확인이 `onSaved`(보통 이동)를 한 번 실행한다. Esc·바깥 클릭으로 닫히지 않는다.
- Enter: 폼에서 Enter는 기본적으로 제출(저장 버튼 클릭)이다. 단, 입력한 값을 [추가] 버튼이 목록에 넣는 입력칸(검색어 칩, 제목 입력 + [추가]로 목록에 넣는 칸 등)에서는 Enter가 제출 대신 [추가] 클릭으로 동작한다. 줄마다 자기 칸이고 [추가]가 빈 줄만 더하는 배열 줄 입력(등급명·회차 날짜 등)은 일반 칸이라 Enter가 폼 제출이다. 모달 안 입력칸의 Enter는 그 모달의 확인(모달 폼 제출)이며 바깥 폼은 제출되지 않는다. 키트에서: 일반 칸은 `Form.Submit`이 있는 `<Form>`이 받으므로 칸에서 Enter를 막지 않는다. 값을 목록에 넣는 [추가] 칸은 `onKeyDown={rows.enterAdds(add)}`(목록 `List.Keywords`는 기본). 모달은 `Form.Dialog` 안에 자기 `<Form>`과 `Form.Submit`을 둔다.
- `Form.Dialog`: 대화창 안 하위 폼(자기 `useSaveForm`). 안쪽 제출(버튼·Enter)은 안쪽만 검증·저장하고 바깥 폼의 저장·검증 오류·확인창을 건드리지 않는다. 바깥에 오류가 있어도 안쪽 제출은 막히지 않는다. 닫기·취소는 그 안의 폼만 보고 묻는다(바깥이 dirty여도 바깥 이탈 확인은 뜨지 않는다). 하위 결과를 바깥 값에 넣으면 바깥이 dirty가 되어 이후 이탈은 바깥 기준으로 묻는다. 입력이 있어도 묻지 않고 닫는 대화창은 안쪽을 `<Form protect={false}>`로 둔다.
- 이탈: `FormGuard`가 등록된 폼 중 하나라도 입력이 기준선과 다르면 Router 이동·브라우저 이탈을 한 번 묻고, 저장 중이면 묻지 않고 막는다. 저장 성공 뒤 이동은 묻지 않는다. Router를 거치지 않는 이탈(같은 메뉴 다시 누르기)은 `useLeave()(run, reason)`로 같은 판정을 받는다. 확인 뒤 `run`이 이동하면 `ignoreBlocker: true`로 이동한다. 로그인 같은 제품 예외만 `<Form protect={false}>`. 이 값은 해당 폼의 보호 등록 자체를 제외하므로 변경 경고와 저장 중 Router·브라우저 이탈 차단이 함께 빠진다. 검증·중복 제출 잠금·기준선 처리는 남고 `Form.Cancel`의 진행 중 잠금도 유지된다. 기존 등록 화면의 보호 정책을 이 예시만으로 바꾸지 않는다.
- 문구는 `FormGuard messages`(까닭별: navigate·cancel)·`Form messages`·`formatError`(칸 오류 값 → 문구)·`renderFailure(failure, place)`(place: save·completion·options, `null`이면 그 자리에 그리지 않음), 모양은 `--wk-*` 토큰으로 바꾼다. 새 화면마다 Field·이탈 확인·확인창을 다시 만들지 않는다.

## 화면 전체 진행 덮개

실제 조립 예: [apps/starter/src/routes/_app.tsx](../../references/apps/starter/src/routes/_app.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

registry `blocking-progress`의 `BlockingProgress messages={{ loading, create, edit, delete, wait? }}`를 앱 셸(로그인 뒤 화면 골격)에 한 번 두고 셸 본문을 children으로 감싼다. 공통 등록·정리·복원은 `/dialog`의 `useBlockingProgressBinding`·`BlockingProgressProvider`가 맡고 복사본은 반환 속성과 ref를 연결한다. 문구는 프로젝트가 준다(`wait`는 둘째 줄).
- 무엇이 덮는가: 등록·수정 폼 저장(`useSaveForm({ progress })`), 확인창을 거친 삭제 실행(`useConfirmationState({ progress: 'delete' })`, 아래 「폼 없는 확인」), 페이지 진입 조회(`useList({ progress: 'page' })`·`useRecord(options, id, { progress: 'page' })` — 각 skill), 화면 고유의 진입 대기(`useBlockingProgress('loading', active)`, 예: 수정 폼을 열기 전 보조 조회). 쓰기(등록·수정·삭제)가 조회보다 앞선다. 덮개 밖(셸 없는 화면·단위 시험)에서는 아무 일도 하지 않는다.
- 덮는 동안 children은 `inert`·`aria-busy`(클릭·포커스·낭독에서 빠짐)이고, `role="status"` 영역이 문구를 읽는다. 대화창(portal)은 children 밖이라 덮개 위에서 조작된다(세션 경고·만료, 저장 완료 창). 덮개 층은 `--wk-blocking-layer`(기본 999, 키트 대화창 아래)로, 프로젝트 대화창의 층보다 낮게 둔다. 배경·글자색은 `--wk-blocking-backdrop`·`--wk-blocking-fg`. 가운데 진행 표시는 기본이 키트 원형 회전 표시이고 `indicator`(ReactNode)를 주면 그 표시로 바뀐다(덮개째 낭독기에서 숨김, 움직임 줄이기 설정은 표시를 준 프로젝트가 맞춘다).
- 닫힐 때 포커스가 문서 본문으로 밀려나 있으면(inert) 덮기 전 본문에서 마지막으로 포커스한 요소로 돌린다. 기록하는 것은 본문 DOM 안 요소뿐이라, 확인창(portal)을 거친 저장·삭제는 확인창을 연 버튼으로 돌아온다. 그 요소도 사라졌으면 본문 첫 `h1`, 없으면 본문 영역으로 돌린다(문서 본문에 두지 않는다). 본문에 포커스한 적이 없으면(첫 진입) 옮기지 않는다. 완료 창·오류 칸·대화창이 가진 포커스는 건드리지 않는다(칸 없는 저장 실패는 오류 문구가 `role=alert`로 읽히고 포커스는 저장 버튼에 돌아온다).
- 덮지 않는 것: 목록 검색·정렬·페이지 이동(이전 결과를 보인 채 조회), 단건 언어 전환·재조회, 선택지 조회(그 칸의 상태), 다운로드(버튼 잠금 + 옆 진행 표시), 선언하지 않은 쓰기(상태 변경·대화창 폼 저장·`List.BulkAction`).

## 기본 부품

실제 조립 예: [apps/starter/src/app/NoticeOutlet.tsx](../../references/apps/starter/src/app/NoticeOutlet.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

registry `inputs`는 `Button`·`Input`·`TextArea`·`Select`·`Checkbox`, `dialog`는 `Dialog`·`ConfirmDialog`·`AlertDialog`, `pending`은 `Pending`, `blocking-progress`는 `BlockingProgress`를 제공한다. 진행 등록은 `/dialog`의 `useBlockingProgress`, 대화창 연결은 `useDialogBinding`·`useConfirmBinding`·`useAcknowledgeBinding`을 쓴다. 대화창은 열린 순간 첫 칸에 포커스하고 Tab·Shift+Tab 순환을 창 안에서 같은 이벤트로 처리한다(포커스가 창 밖에 한 순간도 나가지 않는다). `ConfirmDialog`는 실행 중(`pending`) 닫기·재실행을 막고, `AlertDialog`는 확인만 받으며 연타해도 한 번만 알린다. 둘 다 `pending`이면 버튼 뒤에 진행 표시(`pendingLabel`은 화면 낭독기 문구)가 선다.
- `Pending`(`label` = 화면 낭독기 문구): 진행 중 표시 하나(회전 표시 `.wk-spinner` + `.wk-visually-hidden` 문구). 목록 다운로드·덮개를 선언하지 않은 `Form.Submit`·확인창이 쓰는 그 부품이다. 키트 폼으로 아직 옮기지 않은 화면도 같은 규칙이다: 등록·수정 저장이면 `useSaveForm`에 `progress`를 주고 버튼만 잠근다, 그 밖의 진행이면 버튼을 잠그고 바로 뒤에 이 부품을 둔다. 설치한 `Pending` 한 부품을 재사용한다.
- 칸·구역·폼 한 줄의 기본 여백 초기화는 0 우선순위(`:where`)라 프로젝트의 간격 유틸리티(`space-y-*` 등)가 그대로 적용된다.

## headless 연결

실제 조립 예: [apps/starter/src/shared/ui/web-kit/form/ui.tsx](../../references/apps/starter/src/shared/ui/web-kit/form/ui.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

headless는 화면 배치 없이 상태와 연결 함수만 쓰는 방식이다. 특수 표현도 `/form`의 `useFormRootBinding`·`useFormFieldBinding`·`useFormDialogScope`·`useFormCancel`과 Provider를 사용한다. ref는 실제 요소를 가리키는 참조이고 반환된 이벤트·속성과 함께 해당 요소에 연결한다. 제출·참조 확인·값 적용·오류 focus 순서를 복사본에서 다시 만들지 않는다. registry 폼은 이 연결을 이미 포함한다.

## 화면 선언

실제 조립 예: [apps/starter/src/features/products/screens/ProductCreateScreen.tsx](../../references/apps/starter/src/features/products/screens/ProductCreateScreen.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- schema: 동기 Standard Schema(zod 4). 비동기 검증은 받지 않는다. 폼 값의 File·Blob은 복사되지 않고 그대로 저장 함수까지 간다.
- `source { id, values }`: 원본을 폼 값으로 바꾼 것. 등록 화면이면 기본값이다.
- `save(values, submitted)`: 서버가 저장 결과를 주면 폼 값으로 바꿔 `{ saved }`로 돌려준다. 요청 전에 화면 절차가 거절하면(먼저 조회가 필요한 검사·업로드 실패·확인창 취소) `throw new FormRejection(칸 목록 [{ field, message }], root?)`. 키트가 서버 필드 오류와 같은 길로 처리하므로(아래 「실패」) 화면이 칸에 오류를 직접 붙이거나 구역을 열거나 포커스를 예약하지 않는다.
- 필요할 때만 선언하는 것:
  - `confirm`
  - `fieldError`: 서버 필드를 폼 경로와 문구로 바꾼다. 돌려준 경로는 제출 때 기준이고, 그 뒤 줄 작업은 키트가 따라간다.
  - `reveal(fields)`: 키트 구역(`Form.Section fields`·`FormSection`)이 아닌 프로젝트 고유의 접힌 영역(탭 등)을 오류 포커스 전에 연다. 거절마다(클라이언트 검증 실패·서버 필드 오류 도착(늦은 도착 포함)·`FormRejection`) 실패 칸 목록으로 한 번 불린다. 제출 횟수를 세어 열지 않는다. 키트 구역은 스스로 열린다.
  - `onSaved(result)`: 이동·알림·추가 요청. 저장 함수가 돌려준 값을 그대로 받는다(등록 뒤 새 id 등). Promise를 반환해 후속 완료까지 잠금을 유지한다. 저장 성공 뒤 후속이 실패하면 `completionFailure`이며 `Form.Failure`의 재시도(또는 `complete()`)는 저장 없이 후속만 다시 실행한다. 이미 시작한 프로젝트 async 함수 안의 추가 부수효과 취소와 여러 후속 요청 중 일부 성공의 중복 방지는 프로젝트가 책임진다.
  - `acknowledge`: 저장 뒤 사용자 확인(`complete()`)을 기다린 다음 `onSaved`를 실행한다.
- 입력 control의 id는 `fieldId(name)`을 쓰고, 같은 id를 `FieldFrame`에 넘긴다. 체크 트리(`CheckboxTree`)는 그 id를 `id`로 받으며, 검증 오류의 focus가 그 그룹으로 온다.
- 줄을 추가·삭제하는 입력은 아래 「줄 추가·삭제 입력」을 따른다.

## 선택과 추가 행동의 예제

조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

보호 제외는 [로그인](../../references/apps/starter/src/features/auth/screens/LoginScreen.tsx.txt), 저장 후 추가 조회와 완료 실패 재시도는 [작성 예제](../../references/apps/starter/src/features/form-workflows/screens/FormWorkflowScreen.tsx.txt), 완료 확인 뒤 이동은 [약관 등록](../../references/apps/starter/src/features/terms/screens/TermsCreateScreen.tsx.txt)을 참고한다. schema·서버 요청·후속 업무는 프로젝트가 정하고 저장 상태 기계를 새로 만들지 않는다. primary와 secondary의 완료 선언은 각 동작에 따로 준다.

폼과 `blocking-progress` 또는 `checkbox-tree`를 함께 설치하면 registry 검사 연결이 `/testing/unit/combinations`로 자기 UI 복사본의 조합 검사도 등록한다. 둘 중 하나만 설치한 프로젝트에는 그 조합을 요구하지 않는다. 덮개와 폼의 서버 오류 초점 브라우저 화면은 `/testing/fixtures/combinations`를 쓴다.

폼만 채택한 소비 검사는 `/testing/unit/form`과 registry가 연결한 의존 검사 입구를 쓴다. 4.1에서 4.2 후보로 올릴 때는 패키지 갱신과 함께 registry `form`·`choice`·`dialog`·`pending`·`styles`의 검사 연결 import를 새 원본과 대조해 갱신한다. 제품 UI 배치·폼 동작은 그대로다. 작은 검사 입구와 실제 최소 소비의 기준은 [소비 안내](../../docs/consuming.md#복사본-적합성-검사)를 따른다.

## 줄 추가·삭제·이동 입력

실제 조립 예: [apps/starter/src/features/shows/screens/ShowCreateScreen.tsx](../../references/apps/starter/src/features/shows/screens/ShowCreateScreen.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

연락처·회차처럼 줄을 늘렸다 줄이는 입력은 항상 `Form.Array`(부품 없이 쓰면 `FormArrayField`)로 만든다. 폼 라이브러리의 배열 필드(`mode="array"`)를 직접 조립하지 않는다.

- 줄 작업은 `rows.append`·`rows.remove`·`rows.move(from, to)`로 한다. 부품 밖(headless 화면)에서는 `/form`의 `appendRow`·`removeRow`·`moveRow(form, path, …)`를 이벤트 처리 안에서 부른다. TanStack의 `pushFieldValue`·`removeFieldValue`·`moveFieldValues`를 직접 쓰지 않는다: 중첩 배열에서 경로의 첫 번호(바깥 줄)를 바꿔 다른 줄의 오류를 옮기고, 줄 key가 고정된 화면에서는 다시 마운트되는 칸이 옮긴 오류를 지운다.
- 키트 줄 작업 뒤에는 칸 오류(클라이언트·서버)가 각자 줄을 따라간다(중첩 배열 포함). 저장 중에 줄을 지우거나 옮긴 뒤 온 서버 필드 오류는 제출한 그 줄의 지금 위치에 붙고, 그 줄이 지워졌으면 칸 대신 폼 한 줄(`unattachedFieldErrors`)로 간다. 줄 정체성은 키트 줄 작업 기록으로 판단한다(값 안의 key로 추측하지 않는다).
- React key는 값 안의 줄 식별(예: 새 줄을 만들 때 넣은 `key`)을 쓴다.

- 삭제 버튼은 `rows.canRemove`가 참일 때 각 줄에 그린다. 현재 줄 수가 `minItems`보다 클 때만 삭제할 수 있다. 최소 한 줄이 필요한 프로젝트는 `minItems={1}`을 지정한다. 최소 줄 수를 생략하면 마지막 줄도 삭제할 수 있다.
- 입력한 값을 [추가]가 새 줄로 넣는 입력칸(예: 제목 입력 + [추가])에는 `onKeyDown={rows.enterAdds(add)}`를 건다. Enter는 추가 버튼의 `add`를 그대로 부른다. 그래서 추가 버튼이 빈 값에서 오류를 보이면 Enter도 같은 오류를 보인다. 폼 제출은 하지 않고, 한글 조합 중이거나 최대 줄 수일 때는 추가하지 않는다. [추가]가 빈 줄만 더하고 줄마다 자기 칸인 배열 줄 입력에는 걸지 않는다(그 칸의 Enter는 폼 제출, 위 「Enter」).
- `rows.items`는 줄 안의 값이 바뀔 때도 새로 그려져, 추가 버튼이 낡은 값을 보지 않는다.
- 프로젝트가 정하는 것: 빈 줄의 값, 최소·최대 줄 수(`minItems`·`maxItems`), 줄의 모양과 문구.

## 키트 보장

실제 조립 예: [apps/starter/src/features/products/screens/ProductEditScreen.test.tsx](../../references/apps/starter/src/features/products/screens/ProductEditScreen.test.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

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
  - 서버 필드 오류는 화면에 있고 고칠 수 있으며 제출 값과 현재 값이 같은 필드에만 붙는다(배열 경로는 제출 뒤 줄 작업을 따라 옮긴 위치). 붙지 못한 오류(저장 중 바뀐 필드, 지워진 줄, 폼 경로로 바꾸지 못한 것, 화면에 없는 필드, disabled 칸)는 `unattachedFieldErrors`로 나온다. 다음 제출이 지난 서버 오류를 지운다.
  - `save`가 던진 `FormRejection`도 같다: 칸 문구는 서버 오류와 같은 자리에 같은 조건(제출 값 = 지금 값, 줄 작업 추적, 화면에 있고 고칠 수 있는 칸)으로 붙고, 구역·`reveal`을 펼친 뒤 화면 순서 첫 오류 칸에 포커스한다. 다음 제출이 지운다.
  - `formFailure`는 폼 수준에 보일 실패다. 서버 필드 오류가 모두 칸에 붙은 검증 실패면 `undefined`다. `FormRejection`은 root가 있거나 붙지 못한 칸이 있으면 남고, 칸이 모두 붙고 root가 없으면(칸도 없으면 조용한 중단) `undefined`다. `Form.Failure`는 `renderFailure`가 정하지 않으면 root 문구를 보인다.
  - 입력 탓인 실패(예: 로그인 아이디·비밀번호 불일치)는 `clearFailureOnEdit(failure)`가 true를 돌려주게 하면, 지금 입력이 실패한 제출 때 입력과 달라지는 동안 `failure`·`unattachedFieldErrors`에서 빠진다. 연결 실패처럼 입력과 무관한 실패는 false로 두어 남긴다. 기본은 지우지 않는다.
  - `failure.resultUnknown`이면 반영 여부를 확인할 수 없다는 뜻이다. 다시 저장하기 전에 다시 읽기를 안내하는 일은 화면이 정한다.
- 원본 재도착(같은 `id`의 새 `values`):
  - 입력이 기준선과 같으면 교체한다.
  - 다르면 입력을 유지한다.
  - 확인 대기·저장 중이면 끝난 뒤에 판단한다.
- `id`가 바뀌거나 화면을 떠나면 진행 중이던 저장 결과(기준선·오류·focus·`onSaved`)를 적용하지 않는다.

## 프로젝트 연결

실제 조립 예: [apps/starter/src/features/products/screens/ProductEditScreen.tsx](../../references/apps/starter/src/features/products/screens/ProductEditScreen.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- headless 화면도 패키지 hook·Provider의 확인창·이탈 판정을 표현에 연결한다(이탈은 `useLeave`·`FormGuard`의 판정). registry 폼을 쓰는 화면에는 별도 보호를 겹치지 않는다. `onSaved`가 불리는 순간 화면은 이미 저장 결과를 반영한다(저장 중 입력이 그대로면 clean, 바뀌었으면 입력을 보존한 dirty). 그러므로 저장 직후 이동에서 이탈 보호를 우회하지 않는다.
- 오류 문구는 `createFormMessages(prefix)`로 번역 참조를 저장하고, 렌더할 때 해소한다.
- 서버 필드 이름과 폼 경로의 대응은 `fieldError`가 정한다.

## 폼 없는 확인 실행

실제 조립 예: [apps/starter/src/features/products/screens/ProductDetailScreen.tsx](../../references/apps/starter/src/features/products/screens/ProductDetailScreen.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

삭제·상태 변경처럼 입력 없이 확인만 받는 작업은 `/dialog`의 `useConfirmationState`에 실행 함수와 실패 처리를 연결한다. `request`로 대상을 정하고 `confirm`으로 실행한다. 실행 중에는 재실행·닫기·대상 교체가 막힌다. 성공하면 닫힌다. 실패는 `onError`가 닫기 또는 보이기를 정한다. 표시는 registry `dialog`의 `ConfirmDialog`에 `state`를 연결한다. 삭제면 `progress: 'delete'`를 준다: 실행하는 동안 화면 전체 진행 덮개가 `messages.delete` 문구로 덮고 `covered`가 true이므로 확인창은 `open={state.kind === 'open' && !covered}`로 내린다(확인창 → 덮개 → 이동, 실패하면 덮개가 닫히고 확인창이 실패 문구와 함께 다시 열린다). 상태 변경 등 그 밖의 확인 실행은 선언하지 않는다(확인창 안 진행 표시).

## 확인 방법

실제 조립 예: [apps/starter/src/shared/ui/web-kit/checks/form-ui.test.tsx](../../references/apps/starter/src/shared/ui/web-kit/checks/form-ui.test.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

registry 항목을 채택하면 함께 설치한 검사 연결 파일을 자기 단위·브라우저 CI에서 실행하고 `web-kit-check`를 필수 단계로 둔다. starter 통과로 대신하지 않는다. 실제 사용 UI와 검사 대상의 일치는 별도 검토로 판정한다. 설치·결과 파일 연결은 [소비 안내](../../docs/consuming.md#복사본-적합성-검사)를 따른다.

- 프로젝트가 자기 칸 틀·확인창을 만들면 `/testing`의 `checkFieldAdapter`·`checkConfirmDialogAdapter`로 연결을 확인하고, 공통 적합성 검사를 자기 CI에서 계속 실행한다.
- 화면 흐름에서 관찰할 것:
  - 클라이언트 검증 실패 시 요청 0건과 첫 오류 focus
  - 저장 중 중복 요청 0건
  - 저장 중 입력 보존
  - 레코드 전환 뒤 이전 결과 미적용
- focus·키보드·Dialog는 실제 브라우저로도 확인한다.

## 공용 선택과 읽기 쉬운 연결

실제 조립 예: [apps/starter/src/features/products/screens/ProductForm.tsx](../../references/apps/starter/src/features/products/screens/ProductForm.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

`Form.Choice`는 같은 필드 검증·별표·오류 초점에 registry `choice`의 `Choice`를 연결한다. 공통 선택·검색 수명은 `/choice`의 `useChoiceBinding`이 맡는다. 값은 단일 leaf ID 또는 다중 leaf ID 배열이며 가지는 값이 아니다. `nodes`에 트리, `appearance`에 vertical/horizontal/dropdown/menu/search를 준다. 단일 menu에서 가지는 탐색만, 다중 트리에서 가지는 전체·일부·없음을 구분한다. `search(text, signal)`을 주면 기본 250ms 입력 정지 후 서버를 조회하며 늦은 이전 결과는 버린다. 서버 코드·선택지 내용·표시 문구는 프로젝트가 제공한다.

저장 요청 변환과 후속 처리는 `saveProduct`처럼 책임을 드러내는 이름 있는 함수로 연결한다. 한 줄 값 선택·인자 전달까지 별도 함수로 만들지는 않는다. 화면 배치, 업무 연결, 반복 UI는 책임에 따라 분리하고 파일 개수를 강제하지 않는다.

`Choice`의 단일 선택 해제는 `clearLabel`을 지정했을 때만 제공한다. `placeholder`만으로 해제를 허용하지 않는다. 서버 검색 함수가 다시 만들어져도 진행 중 검색은 유지한다. 검색 범위가 상위 값에 따라 달라지면 `searchKey`에 해당 원시 값 배열을 전달해 이전 검색을 취소하고 다시 조회한다.

## 같은 폼의 두 번째 저장

실제 조립 예: [apps/starter/src/features/form-workflows/screens/FormWorkflowScreen.tsx](../../references/apps/starter/src/features/form-workflows/screens/FormWorkflowScreen.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

`useSaveForm({ schema, save, secondary: { schema: draftSchema, save: saveDraft, onSaved } })`로 임시저장처럼 다른 검증을 선언하고 `<Form.Submit mode="secondary">임시 저장</Form.Submit>`으로 실행한다. `secondary`의 schema 출력 타입은 해당 save에 추론된다. 두 저장은 제출 잠금·오류 처리·기준선·이탈 보호를 공유한다. 기본 저장의 필수 오류가 남아 있어도 두 번째 검증이 통과하면 저장할 수 있다. 두 번째 동작의 `confirm`·`acknowledge`·`onSaved`는 기본 동작에서 상속하지 않는다. 확인창은 기존 `Form.Confirm`, 완료 확인은 `Form.Saved`를 쓴다. 실제 필수 칸·요청·성공 뒤 이동은 프로젝트 서버 계약으로 정한다.

## 폼 안 원본과 참조

실제 조립 예: [apps/starter/src/features/form-workflows/model/form.ts](../../references/apps/starter/src/features/form-workflows/model/form.ts.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

`references`에 `{ source: values => 원본ID목록, fields: values => 참조필드경로목록, onRemove, message }`를 선언한다. 참조 칸 값은 문자열 ID 또는 ID 배열이며 빈 문자열은 참조 없음이다. 원본 이름은 현재 원본에서 표시하고 이름을 ID로 삼지 않는다. 원본 칸 값 자체가 참조 기준이면 그 값을 ID로 선언한다.

- `clear`(기본): 삭제·해제·값 교체로 끊기는 참조를 세고 확인 후 원본 변경과 함께 정리한다. 단일 값은 빈 문자열, 배열은 제거된 ID만 뺀다. 연쇄 참조도 함께 정리하며 삭제될 행 안의 참조는 세지 않는다.
- `block`: 영향을 받는 참조가 있으면 변경을 적용하지 않고 `message`를 표시한다.
- `validate`: 변경은 허용하고 두 저장 모두 끊긴 참조를 칸 오류로 거절한다.

키트 `Form.Field`의 `change`, 입력 부품, `Form.Array`와 공개 줄 작업은 이 경로를 쓴다. 직접 값을 변경하는 자체 입력은 `requestFormChange(form, 변경후전체값, accepted => 값반영)`을 사용한다. `writeFormValues`는 허용된 전체 값 중 바뀐 루트 칸만 반영하는 도우미다. raw TanStack 값 변경은 확인 절차를 우회하지만 두 저장의 최종 참조 검사에서는 거절된다. 관계 선언을 바꾸는 것은 프로젝트 정책 변경이며 원본·관계 함수는 값을 수정하지 않는 순수 함수로 제공한다.

확인 중 값이 한 번이라도 달라지거나 편집 대상이 바뀌거나 폼이 내려가면 이전 확인은 취소된다. 저장·저장 확인 중에는 참조 정리 확인이 필요한 새 변경을 시작하지 않는다. 관계가 없는 기존 입력 변경과 늦은 응답 보호는 유지한다. 확인 문구는 `Form`의 `messages.referenceTitle(count)`·`referenceConfirm`, 거절 문구는 관계의 `message`로 준다.
