---
name: web-kit-record
description: 상세·수정 원본 같은 단건 조회의 대기·없음·실패·준비됨과 갱신 실패·이력 표시·마스킹을 만들거나 바꿀 때 읽는다. 목록은 web-kit-list, 폼 저장은 web-kit-form으로 보낸다.
---

# web-kit record

`/record`의 `useRecord`와 `/detail/ui`를 쓰는 기준이다.

## 화면 선언

- `useRecord(queryOptions, identity)`: queryOptions와 레코드 식별을 넘긴다. 식별은 queryKey의 나머지(언어 등)와 구분된다. 상태 판정은 화면 안의 이 한 곳에서만 하고, 화면이 raw query를 다시 읽지 않는다.
- route loader는 같은 queryOptions로 미리 받기만 한다: 기다리지 않고 실패를 삼키는 `void queryClient.query(options).catch(() => undefined)`(설치된 Query에서 `prefetchQuery`는 deprecated). `ensureQueryData`처럼 실패를 던지는 호출은 loader가 판정하게 되므로 쓰지 않는다. 기다리면 실패가 캐시에 남아 화면 mount 때 한 번 더 요청한다. 진입 대기 표시는 프로젝트가 정한다. 상태 판정은 하지 않는다. 선택지 조회도 같은 원칙이다. 선택지 실패는 그 필드 자리에 보인다.

## 키트 보장

- 상태는 넷이다.
  - `pending`
  - `missing`: 확인된 not-found 또는 이 조회의 forbidden. 캐시보다 우선한다.
  - `failed`: 쓸 수 있는 데이터가 없다.
  - `ready`
- `ready`에만 갱신 사실이 딸린다(`refreshing`, `failure`, `retry`). 일시적인 재조회 실패는 내용을 지우지 않는다.
- 식별이 바뀌면 이전 레코드를 보이지 않는다. 식별이 같고 key의 나머지만 바뀌면(언어 전환) 내용을 유지한 채 갱신 중으로 두어 수정 폼 입력이 사라지지 않는다. 같은 식별의 캐시가 있으면 `ready`로 시작한다. 이전 식별의 응답은 적용되지 않는다.
- 숨김 근거는 이 조회의 실패뿐이다. 보조 선택지·저장·연관 목록의 forbidden은 상세를 숨기지 않는다.
- 취소는 실패로 보이지 않는다.

## 기본 표시

`RecordView`에 `useRecord` 결과를 주고 ready 내용만 children에서 그린다. 없음·실패·재시도와 retry 버튼 제거 후 focus를 공통 처리한다. 문구·missingAction·renderFailure는 제품이 선언한다. `HistoryList`에는 이미 해석한 항목·변경값을 전달한다. 서버 DTO나 업무 action을 키트가 해석하지 않는다.

`maskText`에는 노출할 앞/뒤 문자 수를 명시한다. 유니코드 문자를 보존하며 이름·전화·권한별 노출 기준을 추측하지 않는다.

## 프로젝트 연결

`missing`의 `failure.kind`(not-found / forbidden)로 문구와 이동을 정한다. `wasReady`가 false면 진입 때 없음이라, 진입 실패를 route 경계(404 페이지 등)로 보이는 프로젝트는 이 값으로 넘긴다. 판정은 `useRecord` 한 곳이고, 넘기는 것은 표시 위치다. `DetailField`에 label과 value class를 넘긴다. 빈 값·마스킹·날짜 포맷은 프로젝트가 정한다.

## 확인 방법

화면에서 다음을 관찰한다.

- 캐시가 있어도 새 not-found가 내용을 가린다.
- 재조회가 실패해도 내용이 유지되고 다시 시도할 수 있다.
- 다른 레코드로 이동한 직후 이전 내용이 남지 않는다.
- 보조 조회의 forbidden이 상세를 가리지 않는다.
