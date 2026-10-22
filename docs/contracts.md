# 공통 사용 계약

이 문서가 web-kit 코드와 같은 버전으로 배포되는 공통 사용 기준이다. 각 프로젝트의 역할 스킬은 해당 절을 읽은 뒤 프로젝트 adapter·조합·차이만 정한다. API 타입과 함수 인자는 src export를 따른다.

작업 절차는 agent-workflow-kit, 웹의 공통 동작과 사용법은 web-kit, 업무 필드·기본값·권한·서버 계약·화면 조립은 프로젝트가 소유한다. 같은 문장을 프로젝트 문서에 복사하지 않고 설치된 버전의 이 문서를 참조한다.

## list

목록·필터·트리·행 선택을 만들거나 바꿀 때 읽는다.

1. 화면은 URL schema·기본값·codec과 요청 mapper를 선언한다. `recoverUrlField`는 못 읽은 필드만 기본값 해소 단계에 맡기며 다른 유효 필드는 유지한다. 배열의 부분 복구와 날짜 쌍의 묶음은 프로젝트 codec이 정한다.
2. `useDraftCommit`으로 확정 검색 정체성과 입력 초안을 연결한다. URL로 확정값이 바뀌면 그 값으로 초안을 만들고, 검색 버튼/Enter는 최신 초안을 검증한 뒤에만 확정한다. `useFilterValidation`과 `useDateRangeValidation`의 실패는 입력·기존 URL·결과를 유지하며 새 검색 확정을 막는다. URL 복구용 schema를 직접 입력 검증으로 쓰지 않는다.
3. `FilterError`의 id를 해당 입력의 aria-describedby에 연결한다. 기간 검증은 빈 기간을 허용하고 한쪽 누락·존재하지 않는 날짜·역순을 거절한다. 타임존·프리셋·업무 제한·문구는 프로젝트가 제공한다.
4. `CheckboxTree`는 프로젝트 checkbox 렌더와 스타일을 받아 그린다. 선택값은 leaf ID다. 자식 하나라도 선택이면 부모 체크, 모든 leaf 선택 때만 전체 체크다. 체크된 부모 클릭은 후손 모두 해제, 해제된 부모 클릭은 모두 선택이다. 빈 값=전체 같은 저장 표현은 adapter가 변환한다.
5. 행 선택은 `/list`의 `usePageSelection`에 현재 페이지의 선택 가능한 stable ID·확정 검색 resetKey·잠금 여부를 제공한다. 검색 변경은 선택을 비우고 재조회에서 사라진 ID는 영구 제거한다. 잠금은 사용자 토글을 막되 성공 후 명시적 clear는 허용한다. 출력은 선택 순서이며 화면 순서가 필요하면 adapter가 현재 행 순서로 투영한다. 업무 적격 판정·행 액션·선택 해제 시점은 프로젝트가 소유한다.

검사: 잘못된 URL 한 필드의 복구와 다른 값 유지, 잘못된 직접 입력의 오류/URL/새 요청 차단, 트리 부모/전체 상태, 검색 변경·재조회·잠금 중 행 선택을 실제 adapter/화면에서 확인한다. 목록 조회·표 전체·FilterPanel은 아직 키트 export가 아니므로 프로젝트 조합을 따른다.

## form

등록·수정·다이얼로그 폼을 만들거나 바꿀 때 읽는다.

1. 화면이 schema·기본값·입력→요청 mapper·오류 필드 순서·저장 후 행동을 선언한다. 프로젝트 useSaveForm이 기준선·dirty·저장 잠금·이탈·포커스 수명을 조합한다. 해당 hook 전체가 키트에 있는 것으로 간주하지 않는다.
2. 저수준 제출은 `/form`의 `submitForm`이다. blur 단계에서 실패해도 submit 단계의 전체 검증을 실행한 후 handleSubmit으로 들어간다. 화면은 프로젝트 submit.run을 통해 잠금·이탈 처리와 함께 사용한다.
3. 서버 거절을 프로젝트에서 폼 경로와 안전한 문구 참조로 분류한다. `clearFormServerErrors`는 지정 경로의 onServer만 지우고 입력과 다른 검증 오류는 보존한다. `setFormServerErrors`는 프로젝트가 정렬한 경로에 문구 참조를 붙이고 그 순서를 반환한다. root 표시·첫 오류 노출/포커스는 프로젝트가 맡는다.
4. `createFormMessages(prefix)`의 encode로 오류 문구를 번역 참조로 저장하고 resolve로 해소한다. prefix는 기존 프로젝트와 호환되는 marker를 전달한다. key는 namespace를 포함하고 모든 지원 locale에 존재해야 하며 치환값은 문자열·숫자만 사용한다. marker 문자열은 검증 상태 안에서만 보관하고 화면에는 resolve 결과를 표시한다. 서버 요청에는 marker를 넣지 않는다. 렌더 시 해소하며 언어 변경만으로 입력·dirty·검증 시점·focus를 바꾸지 않는다. 서버 원문은 표시 문구로 쓰지 않는다.
5. 필드 control ID에는 폼 정체성을 포함하고 라벨·오류·포커스가 같은 ID를 사용한다. 필수 표시 방식, 벤더 control, 등록/수정의 기본값 갱신 정책은 프로젝트 조합을 따른다.

검사: 클라이언트 실패의 저장 0건, 수정 후 정상 제출, 서버 오류 갱신 후 입력/다른 오류 보존, 동적 경로/첫 오류 focus, 언어 변경과 저장 중 중복 요청 차단을 프로젝트 공개 흐름에서 관찰한다.

## detail

상세·수정 원본의 필수 단건과 라벨/값 표시를 만들거나 바꿀 때 읽는다.

1. 프로젝트 query adapter가 데이터·isPending과 분류된 오류 배치를 `/detail`의 `resolveRequiredRecord`에 전달한다. 순서는 incident 위임 → not-found → 사용 가능한 데이터 → 데이터 없는 none 위임 → pending → error다. 정상 데이터는 undefined와 구별한다. 데이터 없는 완료를 not-found로 추측하지 않는다.
2. 프로젝트가 queryOptions·placeholder·retry·상태 UI를 연결한다. 오류의 incident/none/local 분류와 route loader 사용 여부는 프로젝트 소유다. 화면이 상태 판정을 다시 구현하지 않고 프로젝트 adapter 결과로 내용을 조립한다.
3. `/detail/ui`의 `DetailField`는 dl 내부의 dt/dd 의미 구조를 제공한다. 프로젝트 adapter가 label·children·root/label/value class를 전달한다. 빈 값 표시·줄바꿈·마스킹·날짜 포맷·상태별 액션은 프로젝트가 정한다.

검사: 캐시가 있어도 새 not-found가 내용을 가리는지, 일반 재조회 실패는 데이터 유지인지, 앱 위임이 프로젝트 정책과 맞는지, label/value 의미 구조와 빈 값/0/줄바꿈을 확인한다.

## api

요청 query 직렬화를 만들거나 바꿀 때 읽는다.

1. `/api`에서 실제 서버 계약에 맞는 직렬화를 선택한다. `serializeSpringParams`는 재귀 객체, `serializeFlatListParams`는 단일 깊이 목록 객체 배열을 지원한다. 후자는 미지원 중첩 값을 TypeError로 거절한다. 프로젝트가 request wrapper 해제와 적용 endpoint를 정한다.
2. 두 직렬화는 primitive 배열을 같은 키 반복, 객체 배열을 인덱스+점 경로로 보내며 null/undefined를 생략하고 빈 문자열·0·false를 보존한다. URLSearchParams가 키와 값을 인코딩한다.
3. 서버 응답 봉투·오류 코드·헤더·인증·refresh·QueryClient·생성 클라이언트·무효화는 프로젝트 소유다. 업무 요청 mapper는 서버 타입으로 끝내고 화면 전용 값을 전송하지 않는다.

검사: 최종 URL의 키/값/인코딩과 미지원 입력 거절, 실제 요청 adapter의 적용 범위를 확인한다. mock 통과·HTTP 200만으로 서버 필터 바인딩을 확인했다고 하지 않는다.

## 변경과 배포

공통 동작·사용법은 web-kit에서 기존 책임을 수정하고 코드·계약 검사와 함께 새 버전으로 배포한다. 프로젝트 역할 스킬은 설치본을 참조하고 로컬 차이만 수정한다. 같은 버전의 tarball·manifest·lockfile을 함께 갱신하고 양쪽 adapter 검사를 실행한다. 배포 절차는 README를 따른다.
