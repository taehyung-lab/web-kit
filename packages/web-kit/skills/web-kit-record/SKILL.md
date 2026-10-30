---
name: web-kit-record
description: 상세·수정 원본 같은 단건 조회의 대기·없음·실패·준비됨과 갱신 실패·이력 표시·마스킹을 만들거나 바꿀 때 읽는다. 목록은 web-kit-list, 폼 저장은 web-kit-form으로 보낸다.
---

# web-kit record

`/record`의 `useRecord`·`useRetryFocus`와 registry `record`·`retry`의 복사본을 쓰는 기준이다. registry는 프로젝트에 설치해 소유하는 UI 원본 묶음이다.

이 책임만 골라 사용할 수 있다. 선택한 한 책임 안에서는 키트 수명 처리와 자체 구현을 섞지 않는다. 선택 설치 peer(해당 기능을 쓸 때만 설치하는 동료 라이브러리)를 설치하지 않아 실행하지 못한 기능은 "검사하지 않음"으로 기록한다. 예시는 같은 버전의 실제 starter 코드에서 가져와 패키지에 함께 담는다. 링크로 읽고 조립 방식만 참고한다. 예제만 따로 실행하는 용도는 아니다.

## 화면 선언

실제 조립 예: [apps/starter/src/features/products/screens/ProductDetailScreen.tsx](../../references/apps/starter/src/features/products/screens/ProductDetailScreen.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- `useRecord(queryOptions, identity)`: queryOptions와 레코드 식별을 넘긴다. 식별은 queryKey의 나머지(언어 등)와 구분된다. 상태 판정은 화면 안의 이 한 곳에서만 하고, 화면이 raw query를 다시 읽지 않는다.
- 페이지 진입 조회(상세·수정 원본)면 `useRecord(queryOptions, identity, { progress: 'page' })`로 선언한다. 보일 내용이 없고 조회 중인 동안만 앱 셸의 화면 전체 진행 덮개(registry `blocking-progress`와 `/dialog`의 진행 연결, web-kit-form 「화면 전체 진행 덮개」)가 덮는다. 언어 전환·재조회(내용 있음)·실패·취소는 덮지 않는다. 대화창 안 조회는 선언하지 않는다.
- route loader는 같은 queryOptions로 미리 받기만 한다: 기다리지 않고 실패를 삼키는 `void queryClient.query(options).catch(() => undefined)`(설치된 Query에서 `prefetchQuery`는 deprecated). `ensureQueryData`처럼 실패를 던지는 호출은 loader가 판정하게 되므로 쓰지 않는다. 기다리면 실패가 캐시에 남아 화면 mount 때 한 번 더 요청한다. 진입 대기 표시는 프로젝트가 정한다. 상태 판정은 하지 않는다. 선택지 조회도 같은 원칙이다. 선택지 실패는 그 필드 자리에 보인다.

## 키트 보장

실제 조립 예: [apps/starter/src/features/products/screens/ProductDetailScreen.test.tsx](../../references/apps/starter/src/features/products/screens/ProductDetailScreen.test.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

- 상태는 넷이다.
  - `pending`
  - `missing`: 확인된 not-found 또는 이 조회의 forbidden. 캐시보다 우선한다.
  - `failed`: 쓸 수 있는 데이터가 없다.
  - `ready`
- `ready`에만 갱신 사실이 딸린다(`refreshing`, `failure`, `retry`). 일시적인 재조회 실패는 내용을 지우지 않는다.
- 식별이 바뀌면 이전 레코드를 보이지 않는다. 식별이 같고 key의 나머지만 바뀌면(언어 전환) 내용을 유지한 채 갱신 중으로 두어 수정 폼 입력이 사라지지 않는다. 같은 식별의 캐시가 있으면 `ready`로 시작한다. 이전 식별의 응답은 적용되지 않는다.
- 숨김 근거는 이 조회의 실패뿐이다. 보조 선택지·저장·연관 목록의 forbidden은 상세를 숨기지 않는다.
- 취소는 실패로 보이지 않는다.

## registry 표시

실제 조립 예: [apps/starter/src/features/products/screens/ProductDetailScreen.tsx](../../references/apps/starter/src/features/products/screens/ProductDetailScreen.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

registry `record`의 `<Record state={useRecord(...)}>{(data) => …}</Record>`로 준비됨일 때만 내용을 그린다. 대기·없음·실패(다시 시도, 버튼이 사라지면 내용으로 focus)·재조회 실패(내용을 둔 채 알림과 다시 시도)는 복사본이 그리고 재시도 포커스 수명은 `/record`의 `useRetryFocus`가 맡는다. 없음 안내(무엇이 없는지·돌아갈 길)는 `missing` 값이다. 실패 문구는 `renderFailure(failure, place)`(place: load·missing·refresh)로 정하고, `null`이면 그 자리에 그리지 않는다(앱 경계가 이미 알린 401·403 등). 문구는 `messages`.

- `Record.Fields`·`Record.Field label`: 라벨·값 목록. null·undefined·''·false만 빈 값 표시(`messages.empty`, 기본 '-')이고 0은 그대로다.
- `Record.History entries labels empty`: 일시·변경 내용·담당자 표. 항목은 프로젝트가 서버 어휘를 해석하고 일시를 표시 형식으로 써서 넘긴다. 0건이면 빈 문구.
- 서버 DTO나 업무 action을 키트가 해석하지 않는다.

`maskText`에는 노출할 앞/뒤 문자 수를 명시한다. 유니코드 문자를 보존하며 이름·전화·권한별 노출 기준을 추측하지 않는다.

## 프로젝트 연결

실제 조립 예: [apps/starter/src/features/products/screens/ProductEditScreen.tsx](../../references/apps/starter/src/features/products/screens/ProductEditScreen.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

`missing`의 `failure.kind`(not-found / forbidden)로 문구와 이동을 정한다. `wasReady`가 false면 진입 때 없음이라, 진입 실패를 route 경계(404 페이지 등)로 보이는 프로젝트는 이 값으로 넘긴다. 판정은 `useRecord` 한 곳이고, 넘기는 것은 표시 위치다. 마스킹·날짜 포맷·빈 값 문구는 프로젝트가 정한다.

## 확인 방법

실제 조립 예: [apps/starter/src/shared/ui/web-kit/checks/record-ui.test.tsx](../../references/apps/starter/src/shared/ui/web-kit/checks/record-ui.test.tsx.txt). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다.

registry 항목을 채택하면 함께 설치한 검사 연결 파일을 자기 단위·브라우저 CI에서 실행하고 `web-kit-check`를 필수 단계로 둔다. starter 통과로 대신하지 않는다. 실제 사용 UI와 검사 대상의 일치는 별도 검토로 판정한다. 설치·결과 파일 연결은 [소비 안내](../../docs/consuming.md#복사본-적합성-검사)를 따른다.

화면에서 다음을 관찰한다.

- 캐시가 있어도 새 not-found가 내용을 가린다.
- 재조회가 실패해도 내용이 유지되고 다시 시도할 수 있다.
- 다른 레코드로 이동한 직후 이전 내용이 남지 않는다.
- 보조 조회의 forbidden이 상세를 가리지 않는다.

선택 설치의 검사 연결은 `/testing/unit/record`를 쓴다. `blocking-progress`도 설치한 경우 registry 연결이 `/testing/unit/combinations`로 실제 덮개 복사본과의 기존 조회 조합 검사를 추가한다. 패키지와 함께 검사 연결 파일·설치 기록을 새 원본에 맞춰 갱신한다.
