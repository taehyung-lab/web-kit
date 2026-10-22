# 공통 계약과 프로젝트 소유권

이 문서는 코드와 같은 버전으로 배포한다. 프로젝트의 업무 필드·기본값·권한·API 응답 계약은 각 프로젝트가 소유한다.

## 구현 전 보존 조건과 검사

| 조건 | 입력과 관찰 결과 | 검사 |
|---|---|---|
| W1 독립 배포 | 양쪽에 같은 0.2.0 tarball을 설치, DT source 없이 import·빌드 성공 | tarball 해시, 양쪽 typecheck/build |
| F1 URL 복구 | 잘못된 필드만 기본값, 유효 필드는 보존 | 양쪽 search/목록 화면 검사 |
| F2 입력 검증 | 잘못된 기간 입력은 유지, 오류 표시, URL 변경과 새 검색 차단 | 실제 목록 UI/요청 mock 검사 |
| F3 트리 | 자식 하나라도 선택이면 부모 체크, 전체는 모든 leaf 선택 때만 체크 | 키트 선택 엔진 + 양쪽 adapter 검사 |
| W2 폼 [기존] | 전체 blur/submit 검증 뒤 제출. 서버 오류 삭제/배치는 다른 검증·입력을 보존 | 키트 실제 FormApi 상태 + 양쪽 useSaveForm 검사 |
| W3 상세 [기존] | not-found는 이전 데이터보다 우선, 일반 재조회 실패는 기존 데이터 유지, 데이터 없는 완료는 error | 키트 상태표 + 양쪽 상세 검사 |
| W4 API [기존] | 반복 키·인덱스 객체 배열·null 생략·빈 문자열/0/false 보존 | 실제 URL 문자열 검사 + 양쪽 transport 검사 |

## 프로젝트 차이

- 폼: DT 동적 경로/DOM 정렬, REF 명시적 필드 순서를 보존한다. 번역 marker, 저장 중 잠금, 수정 baseline, 이탈 확인, 저장 후 이동은 프로젝트에 남긴다.
- 상세: REF incident는 캐시보다 우선하고 none은 데이터 없을 때 delegated다. DT는 기존 앱 경계와 언어 전환 placeholder를 유지한다. 이 분류를 키트에 전달한다.
- API: DT는 재귀 Spring 직렬화, REF는 단일 깊이 목록 직렬화와 지원하지 않는 형태 거절을 유지한다. REF request wrapper 해제와 적용 endpoint 선정은 프로젝트에 남긴다. 응답 봉투·오류 코드·인증·QueryClient는 공유하지 않는다.
- UI: 스타일·번역·레이아웃은 프로젝트 adapter가 제공한다. 공통 UI는 CheckboxTree와 FilterError이며 화면 전체 template은 제공하지 않는다.

## 수정 위치

공통 동작 수정은 web-kit에서 검사·버전 증가·태그·release tarball 발행 후 각 프로젝트 의존성과 lockfile을 함께 갱신한다. vendor tarball이나 node_modules 내부를 직접 수정하지 않는다.
업무 schema, 요청 mapper, 화면별 필드·정렬·권한, 라우팅은 프로젝트에서 수정한다. agent-workflow-kit은 작업 절차를 관리하며 런타임 web-kit과 독립이다.
