---
name: web-kit-form
description: 등록·수정·다이얼로그 폼의 제출·확인창·저장·dirty·서버 필드 오류·오류 focus·원본 재도착을 만들거나 바꿀 때 읽는다. 요청·실패 해석은 web-kit-http, 원본 단건 상태는 web-kit-record로 보낸다.
---

# web-kit form

`/form`의 `useSaveForm`과 `/form/ui`, 그리고 `/testing`의 폼 검사를 쓰는 기준이다. 인자와 타입은 설치된 소스를 따른다.

## 화면 선언

- schema: 동기 Standard Schema(zod 4). 비동기 검증은 받지 않는다. 폼 값의 File·Blob은 복사되지 않고 그대로 저장 함수까지 간다.
- `source { id, values }`: 원본을 폼 값으로 바꾼 것. 등록 화면이면 기본값이다.
- `save(values, submitted)`: 서버가 저장 결과를 주면 폼 값으로 바꿔 `{ saved }`로 돌려준다.
- 필요할 때만 선언하는 것:
  - `confirm`
  - `fieldError`: 서버 필드를 폼 경로와 문구로 바꾼다.
  - `reveal`: 접힌 섹션을 연다.
  - `onSaved(result)`: 이동·알림. 저장 함수가 돌려준 값을 그대로 받는다(등록 뒤 새 id 등).
- 입력 control의 id는 `fieldId(name)`을 쓰고, 같은 id를 `FieldFrame`에 넘긴다.

## 키트 보장

- 제출 흐름:
  - 제출은 `submit()` 하나다. 이미 떠 있는 blur 오류가 있어도 전체 검증을 다시 돌린다. 검증에 실패하면 저장과 확인창이 0건이고, 화면 순서상 첫 오류 입력으로 focus한다. 칸을 떠날 때의 검증은 TanStack 필드 `validators.onBlur`로 둔다.
  - 진행 중이거나 확인 대기 중일 때의 재제출은 무시한다.
  - 확인창이 있든 없든 저장 경로는 하나다. 확인창에 보여 준 snapshot S와 실행하는 S는 같다(`stage.values`).
- 성공:
  - 저장 결과가 있으면 그것이, 없으면 S가 기준선이 된다.
  - 저장 중에 입력이 그대로였다면 저장 결과를 입력에도 넣는다. 바뀌었다면 입력을 보존하고 기준선만 바꾼다.
  - `isDirty`는 현재 값이 기준선과 다른지를 뜻한다. 차이로 요청을 만드는 화면은 `baseline`을 읽는다(직접 따로 들지 않는다).
  - `onSaved`는 저장이 끝난 직후 한 번 실행된다. 재조회를 기다리지 않는다.
- 실패:
  - 실패는 `failure`에 그대로 담기고 `cancelled`만 빠진다. 입력과 기준선은 유지된다.
  - 서버 필드 오류는 제출 값과 현재 값이 같은 필드에만 붙는다. 붙지 못한 오류(저장 중 바뀐 필드, 폼 경로로 바꾸지 못한 것)는 `unattachedFieldErrors`로 나오며, 폼 수준 한 줄의 근거다. 다음 제출이 지난 서버 오류를 지운다.
  - `failure.resultUnknown`이면 반영 여부를 확인할 수 없다는 뜻이다. 다시 저장하기 전에 다시 읽기를 안내하는 일은 화면이 정한다.
- 원본 재도착(같은 `id`의 새 `values`):
  - 입력이 기준선과 같으면 교체한다.
  - 다르면 입력을 유지한다.
  - 확인 대기·저장 중이면 끝난 뒤에 판단한다.
- `id`가 바뀌거나 화면을 떠나면 진행 중이던 저장 결과(기준선·오류·focus·`onSaved`)를 적용하지 않는다.

## 프로젝트 연결

- 확인창·이탈 질문·완료 알림 UI와 문구는 프로젝트 vendor로 그린다. 저장 중 이탈을 막을지·묻을지·허용할지는 프로젝트가 정하며 키트는 `isDirty`·`isSaving`을 준다. `onSaved`가 불리는 순간 화면은 이미 저장 결과를 반영한다(저장 중 입력이 그대로면 clean, 바뀌었으면 입력을 보존한 dirty). 그러므로 저장 직후 이동에서 이탈 보호를 우회하지 않는다.
- 오류 문구는 `createFormMessages(prefix)`로 번역 참조를 저장하고, 렌더할 때 해소한다.
- 서버 필드 이름과 폼 경로의 대응은 `fieldError`가 정한다.

## 폼 없는 확인 실행

삭제·상태 변경처럼 입력 없이 확인만 받는 작업은 `/dialog`의 `useConfirmationState`에 실행 함수와 실패 처리를 연결한다. `request`로 대상을 정하고 `confirm`으로 실행한다. 실행 중에는 재실행·닫기·대상 교체가 막힌다. 성공하면 닫힌다. 실패는 `onError`가 닫기 또는 보이기를 정한다.

## 확인 방법

- `/testing`의 `checkFieldAdapter`와 `checkConfirmDialogAdapter`를 프로젝트 Field·확인창 adapter에 한 번 돌린다.
- 화면 흐름에서 관찰할 것:
  - 클라이언트 검증 실패 시 요청 0건과 첫 오류 focus
  - 저장 중 중복 요청 0건
  - 저장 중 입력 보존
  - 레코드 전환 뒤 이전 결과 미적용
- focus·키보드·Dialog는 실제 브라우저로도 확인한다.
