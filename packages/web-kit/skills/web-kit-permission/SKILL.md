---
name: web-kit-permission
description: 경로 진입 차단·메뉴 숨김·버튼 비활성처럼 권한 판정을 화면에 연결하거나 바꿀 때 읽는다. 권한 목록·서버 자원 대응은 프로젝트가 맡는다. 목록 상태는 web-kit-list로 보낸다.
---

# web-kit permission

`/permission`의 권한 틀을 쓰는 기준이다. 인자와 타입은 설치된 소스를 따른다.

## 연결

- 프로젝트가 권한 상태 `{ status: 'loading' | 'failed' | 'ready', allows(check) }`를 만들어 `PermissionProvider`로 화면 위에 한 번 둔다. `check`의 모양(정책 ID, [정책, 동작] 등)과 판정 함수는 프로젝트 것이다.
- 경로 진입: route `beforeLoad`에서 `assertAllowed(access, check)`. 거부는 `AccessDeniedError`(`reason`: 권한 없음 'denied' / 아직 모름 'not-ready')이고 오류 화면이 이것으로 거부 표시를 고른다.
- 메뉴: `filterAllowed(tree, access)`. 항목의 `checks` 중 하나라도 허용이면 보이고, 자식이 모두 빠진 묶음은 지운다.
- 버튼·액션: `useAllowed(check)`로 비활성, `<Allowed check>`로 숨김.

## 키트 보장

- 닫힘이 기본이다: Provider 없음, 불러오는 중, 조회 실패, 판정 대상 없음(정책 해석 실패), 판정 함수가 던짐은 모두 허용이 아니다.
- 진입·메뉴·버튼이 같은 `allows`를 쓰게 해 "메뉴는 보이는데 들어가면 거부" 같은 어긋남을 막는다.
- 목록·폼(`/list`·`/list/ui`·`/form`)은 이 module을 import하지 않는다. 화면이 판정 결과를 부품 속성(`selectable`, 버튼 표시)으로 넘긴다.

## 확인 방법

- 권한 없는 계정으로 주소를 직접 열면 거부 화면이 뜨고 화면 요청이 나가지 않는다.
- 권한 상태를 불러오는 중·실패로 두면 버튼이 눌리지 않고 메뉴가 보이지 않는다.
