---
name: web-kit-permission
description: 경로 진입 차단·메뉴 숨김·버튼 비활성처럼 권한 판정을 화면에 연결하거나 바꿀 때 읽는다. 권한 목록·서버 자원 대응은 프로젝트가 맡는다. 목록 상태는 web-kit-list로 보낸다.
---

# web-kit permission

`/permission`의 권한 틀을 쓰는 기준이다. 인자와 타입은 설치된 소스를 따른다.

이 책임만 골라 사용할 수 있다. 선택한 한 책임 안에서는 키트 수명 처리와 자체 구현을 섞지 않는다. 선택 설치 peer(해당 기능을 쓸 때만 설치하는 동료 라이브러리)를 설치하지 않아 실행하지 못한 기능은 "검사하지 않음"으로 기록한다. 예시는 같은 버전 저장소의 파일이며 설치본 node_modules 안의 파일이 아니다.

## 연결

starter 실제 예 없음(검사하지 않음). 연결 위치 참고: [apps/starter/src/routes/_app.tsx](../../../../apps/starter/src/routes/_app.tsx). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다. 공통 판정의 검사 근거는 [permission.test.tsx](../../tests/permission.test.tsx)다.

- 프로젝트가 권한 상태 `{ status: 'loading' | 'failed' | 'ready', allows(check) }`를 만들어 `PermissionProvider`로 화면 위에 한 번 둔다. `check`의 모양(정책 ID, [정책, 동작] 등)과 판정 함수는 프로젝트 것이다.
- 경로 진입: route `beforeLoad`에서 `assertAllowed(access, check)`. 거부는 `AccessDeniedError`(`reason`: 권한 없음 'denied' / 아직 모름 'not-ready')이고 오류 화면이 이것으로 거부 표시를 고른다.
- 메뉴: `filterAllowed(tree, access)`. 항목의 `checks` 중 하나라도 허용이면 보이고, 자식이 모두 빠진 묶음은 지운다.
- 버튼·액션: `useAllowed(check)`로 비활성, `<Allowed check>`로 숨김.

## 키트 보장

starter 실제 예 없음(검사하지 않음). 연결 위치 참고: [apps/starter/src/app/errors.tsx](../../../../apps/starter/src/app/errors.tsx). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다. 공통 판정의 검사 근거는 [permission.test.tsx](../../tests/permission.test.tsx)다.

- 닫힘이 기본이다: Provider 없음, 불러오는 중, 조회 실패, 판정 대상 없음(정책 해석 실패), 판정 함수가 던짐은 모두 허용이 아니다.
- 진입·메뉴·버튼이 같은 `allows`를 쓰게 해 "메뉴는 보이는데 들어가면 거부" 같은 어긋남을 막는다.
- 목록·폼(`/list`·`/form`과 registry `list`·`form`)은 이 module을 import하지 않는다. 화면이 판정 결과를 부품 속성(`selectable`, 버튼 표시)으로 넘긴다.

## 확인 방법

starter 실제 예 없음(검사하지 않음). 연결 위치 참고: [apps/starter/src/app/App.tsx](../../../../apps/starter/src/app/App.tsx). 조립 방식만 참고한다. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다. 공통 판정의 검사 근거는 [permission.test.tsx](../../tests/permission.test.tsx)다.

registry 항목을 채택하면 함께 설치한 검사 연결 파일을 자기 단위·브라우저 CI에서 실행하고 `web-kit-check`를 필수 단계로 둔다. starter 통과로 대신하지 않는다. 실제 사용 UI와 검사 대상의 일치는 별도 검토로 판정한다. 설치·결과 파일 연결은 [소비 안내](../../docs/consuming.md#복사본-적합성-검사)를 따른다.

- 권한 없는 계정으로 주소를 직접 열면 거부 화면이 뜨고 화면 요청이 나가지 않는다.
- 권한 상태를 불러오는 중·실패로 두면 버튼이 눌리지 않고 메뉴가 보이지 않는다.
