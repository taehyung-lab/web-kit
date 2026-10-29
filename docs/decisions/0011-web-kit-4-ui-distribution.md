# 0011. web-kit 4.0: 동작은 패키지, 화면은 복사하여 소유

- 상태: 2026-10-29 사용자 합의의 결정 기록. 구현·발행 완료 기록이 아니다.
- 기준: `v3.1.0` (`ab7f621`), 사용자 승인 계획 `work/web-kit-4/plan.md` 합의 1~14. 계획은 작업 자료이고 이 기록이 재사용할 결정을 보존한다.
- 관계: 0003 §3과 0010 맥락의 UI 소유·배포 선택을 대체한다. 0003의 완료 기준과 반례는 유지한다. 동작 보장의 정본은 `packages/web-kit/skills/`이며 여기서는 결정·이유·출처만 기록한다.
- 용어: registry는 설치 도구가 프로젝트로 복사할 화면 소스의 목록이다. headless는 화면 배치·스타일 없이 상태와 연결 함수를 제공한다는 뜻이다. 예를 들어 제출 순서는 패키지가 맡고 저장 버튼 위치는 복사본에서 바꾼다.

## 결정과 이유

| 합의 | 결정 | 이유 | 출처 |
|---|---|---|---|
| 5·9 | 4.0부터 패키지는 공통 동작만 배포하고 UI는 저장소의 shadcn registry에서 복사하여 프로젝트가 소유한다. starter도 같은 방식이다 | 디자인 소유권을 프로젝트에 두면서 동작 구현을 복제하지 않기 위해 | 사용자 합의 5·9, 0003 §3, `src/form/ui.tsx:185`(이하 src는 packages/web-kit/src) |
| 7 | 목록 상태 전달은 패키지 context가 기본이고 명시적 model props도 허용한다 | 부품 위치를 바꾸거나 context 없는 화면에 연결해도 상태 소유자가 하나이기 위해 | 사용자 합의 7, `src/list-ui.tsx:117`, `:138`, `:143` |
| 8 | 기간의 timeZone·now는 생략 가능하게 하고 브라우저 시간대·현재 시각을 기본으로 쓴다. 요청 변환도 같은 시간대에 연결한다 | 단축 버튼 없는 기간 입력에도 시계 설정을 요구하던 부담을 없애기 위해 | 사용자 합의 8, `src/list-ui.tsx:420`, `:436`, `src/search/interactions.ts:30` |
| 10 | 공통 브라우저 검사 기준은 키트가 제공하고 실제 채택 UI를 연결한 소비처 CI가 실행한다 | starter 통과만으로 디자인을 고친 소비처의 연결을 증명할 수 없기 때문에 | 사용자 합의 10, `src/testing.tsx:200`, `tests/form-enter.test.tsx:4` |
| 11 | 공개 입구를 공용 책임·중복·이전 경로로 판단한다. /filter를 제거하고 순수 계산은 합의된 규칙 하나로 합친다. CheckboxTree와 Choice 통합은 이전 동작을 검증하기 전에는 하지 않는다 | 사용량만으로 공용 책임을 버리거나 서로 다른 계산을 남기지 않기 위해 | 사용자 합의 11, 0010 1-2, `src/checkbox-tree.ts:13`, `src/ui/choice.tsx:104` |
| 12 | dev 서버가 준비되기 전에는 후보 생성·로컬 소비 검사·교정·독립 검증까지 진행하고 멈춘다. 실서버 확인은 정식 4.0.0 발행 직전 필수 단계다 | 로컬 대역 검사와 서버 계약 확인은 다른 증거이기 때문에 | 사용자 합의 12, 0003 완료 기준 2·5 |
| 13 | 시험 소비처의 이전 범위는 네 UI 입구를 import하는 모든 화면과 로그인이다. 그 밖의 자체 UI 정리는 소비 프로젝트 일정에 둔다 | 설치 후 빌드와 대표 흐름의 검증 범위를 명확히 하고 다른 제품 정리를 섞지 않기 위해 | 사용자 합의 13; 근거: DT origin/v2 UI import 조사(plan §0·M10). 특정 경로·업무 값은 공용 기준이 아님 |
| 14 | 설치 기록과 검사 결과를 맞추는 작은 점검 명령을 소비처 필수 CI에 연결한다. 필요한 검사 누락·건너뛰기·실패·버전 불일치를 판정한다. 실제 사용 UI 일치와 검사 설정 변경은 독립 검토한다 | 실행 여부는 기계로 검사하되 어떤 UI를 검사해야 하는지는 검토가 필요하기 때문에 | 사용자 합의 14, plan M2·M3; 0003 완료 기준 1·5 |

패키지 제품 실행 코드가 특정 화면 배치·스타일·복사본 구현을 import하지 않는 것을 경계 기준으로 삼는다. 상태 전달 Provider의 JSX와 `/testing`의 검사 전용 렌더링은 구분하여 허용한다. Base UI 의존을 없앴는지와 시각 UI를 없앴는지는 따로 판정한다. 공개 입구 제거가 있으므로 버전은 4.0.0이다.

후보 패키지와 registry는 같은 commit에서 만든다. 원본 버전·항목·파일 지문을 설치 기록으로 남기고, 패키지만 갱신할 변경과 복사본 교정이 필요한 변경을 발행 안내에서 구분한다. 원본 전후 차이와 프로젝트 수정 차이를 비교하여 수정분을 보존하고 공통 검사를 다시 실행하는 경로를 검증한다. 기술 근거는 작업 자료 `registry-facts.md`, 책임 분리는 `responsibility.md`, 검증 대응은 `guarantees.md`에 있다. 이 자료의 초안 함수명은 아직 배포된 API가 아니다.

## 공개 입구 판단표

기준점 `packages/web-kit/package.json:10`의 22개 키 전부를 대상으로 한다. (a)는 남길 공용 책임, (b)는 중복 여부, (c)는 기존 소비자의 이전 방법이다. 같은 구현의 재노출과 서로 다른 계산의 중복은 구분한다. 순수 함수 묶음인 루트와 책임별 입구의 재노출은 새 소유자를 만들지 않으므로 유지할 수 있다. 사용량은 판단 근거로 쓰지 않았다.

| 입구 | (a) 공용 책임 | (b) 다른 입구와의 겹침 | (c) 이전 방법 | 4.0 결과 | 근거 (packages/web-kit 기준) |
|---|---|---|---|---|---|
| `.` | 실패·날짜·트리·요청 직렬화 순수 계산 필요 | failure/api 재노출은 동일 구현; 트리의 두 계산은 통합 필요 | 순수 API 유지, 트리 일부 선택 표시 변경 안내 | 패키지 유지 | `src/index.ts:1`, `src/checkbox-tree.ts:13` |
| `./failure` | 실패 분류 필요 | 루트 재노출과 같은 구현 | 기존 경로 유지 | 패키지 유지 | `src/failure.ts:1`, `src/index.ts:2` |
| `./session` | 인증 세대·종료·저장 필요 | browser/idle은 별도 책임 | 기존 경로 유지 | 패키지 유지 | `src/session.ts:1` |
| `./http` | 요청·회복과 응답 해석 연결 필요 | failure는 값, http는 전송 수명 | 기존 경로 유지 | 패키지 유지 | `src/http.ts:1`, 0009 |
| `./query` | 쿼리 기본 설정 필요 | http와 다른 캐시 책임 | 기존 경로 유지 | 패키지 유지 | `src/query.ts:1` |
| `./ui` | 선택·포커스·진행 연결은 필요, 시각 UI 소유는 종료 | 다른 UI 입구가 사용, useBlockingProgress 재노출 | UI는 registry 기본 항목, 공통 연결은 패키지 책임 입구로 | registry로 이전 | `src/ui/index.ts:2`, `src/ui/dialog.tsx:17`, `src/progress.ts:1` |
| `./search` | 주소 읽기·복구·확정 계산 필요 | 루트 날짜 검증은 동일 구현 | 기존 경로 유지 | 패키지 유지 | `src/search/index.ts:1` |
| `./list` | 목록 수명·선택·다운로드·행 활성화 필요 | UI context가 옮겨올 단일 소유자 | 기존 API에 Provider·읽기 hook 연결 추가 | 패키지 유지 | `src/list.ts:1`, `src/list-ui.tsx:117` |
| `./filter` | 독립 상태 책임 없음 | 루트 날짜·트리 재노출, 표현만 남음 | 순수 계산은 루트, FilterError·CheckboxTree는 별도 registry 항목 | 제거 | `src/filter.ts:2`, 합의 11 |
| `./choice` | 목록·폼이 공유하는 선택 검색·값·이름 보존 연결 | /list·/form의 작업 2 재노출을 제거하고 단일 입구로 통합 | registry Choice가 이 입구를 사용; 3.1 공개 경로가 아니므로 제거 영향 없음 | 패키지 신설 | 0010 공통 선택 칸, 2026-10-29 작업 3 coordinator 승인; 루트는 순수 계산이라 React hook을 둘 수 없고 /dialog는 확인창 책임이므로 제외 |
| `./form` | 저장 수명·배열·참조·이탈 판정 필요 | UI의 연결 절차를 이곳으로 모음 | 기존 API 유지, 공통 hook을 연결 | 패키지 유지 | `src/form/index.ts:2`, `src/form/ui.tsx:185` |
| `./form/ui` | 표시 외 등록·제출 격리·입력 적용 순서 필요 | /form 상태와 결합된 연결 | 상태·연결은 /form, Form 부품은 registry | registry로 이전 | `src/form/ui.tsx:52`, `:185`, `:286`, `:999` |
| `./dialog` | 폼 밖 확인 실행 수명 필요 | /ui Dialog는 표현이며 서로 다른 책임 | 기존 useConfirmationState 경로 유지, 창은 registry | 패키지 유지 | `src/form/confirmation.ts:1` |
| `./record` | 식별 격리·진입/갱신 판정 필요 | detail/ui는 그 결과 표시 | 기존 경로 유지 | 패키지 유지 | `src/record.ts:1` |
| `./detail/ui` | 상세 표시 필요, 독립 수명 없음 | RetryRegion 포커스 연결은 공용 | Record 부품은 registry, 상태는 /record, 재시도 연결은 패키지 | registry로 이전 | `src/detail-ui.tsx:29`, `:154`, `src/ui/retry.tsx:4` |
| `./api` | Spring/flat 직렬화 필요 | 루트와 같은 구현의 좁은 책임 입구 | 기존 경로 유지; 계산 복제 금지 | 패키지 유지 | `src/api.ts:28`, `:41`, `src/index.ts:5` |
| `./testing` | 실제 연결 적합성 판정 필요 | 단위/브라우저 기준 소유, 제품 UI 아님 | 실제 registry 복사본을 입력으로 연결, 브라우저 기준 추가 | 패키지 유지 | `src/testing.tsx:116`, `:200`, `:283` |
| `./testing/session` | 세션 어댑터 적합성 필요 | UI 적합성과 다른 계약 | 기존 경로 유지 | 패키지 유지 | `src/session-testing.ts:1` |
| `./list/ui` | 목록 표현과 공통 연결 필요 | List.*와 이름 있는 export는 같은 함수 | /list Provider·hook + 이름 있는 registry 부품 하나로 이전 | registry로 이전 | `src/list-ui.tsx:1077`, `:1100` |
| `./permission` | 닫힘 기본 권한 판정·상태 전달 필요 | 목록·폼과 분리, Allowed는 배치 없는 조건부 전달 | Provider·useAllowed·Allowed 등 기존 연결 유지 | 패키지 유지 | `src/permission.tsx:1`, 0005 권한 행 |
| `./session/browser` | 브라우저 저장·탭 연결 필요 | session 상태를 저장하는 어댑터 | 기존 경로 유지 | 패키지 유지 | `src/browser-session-store.ts:1` |
| `./session/idle` | 유휴 시간 수명 필요 | 다른 기능이 암묵적으로 import하면 안 됨 | 기존 명시적 연결 유지 | 패키지 유지 | `src/session-idle.ts:1`, `tests/core-boundary.test.ts:98` |
| `./styles.css` | 복사한 UI의 표현 자산 필요 | 패키지 로직에 스타일 책임 없음 | registry의 스타일 자산·프로젝트 토큰으로 이전 | registry로 이전 | `src/ui/styles.css:1`, `tests/styles.test.ts:18` |

`/ui` 등의 기존 경로를 같은 이름의 headless 입구로 남기는 결정은 하지 않는다. 해당 경로는 제거하고 남는 공통 처리를 책임에 맞는 패키지 입구에 둔다. 새 포커스·진행 연결의 세부 모듈명은 구현 설계에서 정하되 목록↔폼 의존을 만들지 않는다.

## 중복 계산을 합치는 자리

| 현재 두 자리 | 차이·공통점 | 교체 방향과 이전 영향 |
|---|---|---|
| `src/checkbox-tree.ts:13` checked/set ↔ `src/ui/choice.tsx:104` toggle·branch의 checked/mixed | 같은 leaf 집합으로 부모 표시·다음 값을 계산하지만 일부 선택 시 이전 도우미는 체크, Choice는 − | 합의 11·0010 1-2의 한 계산을 루트에서 사용. 일부 선택에서 클릭하면 전부 선택하는 방향도 Choice 규칙에 맞춘다. 기존 CheckboxTree 소비자에게 표시와 클릭 결과 변경을 함께 안내. 근거 소비처: REF의 1.0.5 사용(plan M4). 통합 전 CheckboxTree는 별도 registry 항목 |
| `src/checkbox-tree.ts:10` treeLeaves ↔ `src/ui/choice.tsx:38` leaves | 모두 트리의 leaf를 순서대로 펼침; 후자는 label도 필요 | leaf 순회 한 계산을 공유하고 ID 목록·표시 이름은 그 결과에서 얻는다. label을 버리는 treeLeaves를 그대로 대입해 이름을 잃지 않음 |
| `src/form/ui.tsx:396` ↔ `:437` | Text·TextArea가 같은 길이 증가 제한 계산 | 패키지 입력 연결 함수 한 곳에서 허용 여부 판정, 복사본은 입력/textarea와 글자 수 배치만 연결 |
| `src/form/ui.tsx:321` ↔ `:573` | Field·Checkbox가 참조 확인→전체 값 적용→해당 칸 변경→후속 콜백 순서를 중복 | 순수 계산만이 아니라 이벤트 처리 중복. 패키지 hook 하나로 원자적 적용 순서를 제공 |
| `src/list-ui.tsx:266` ↔ `:304` | Text·Select의 빈 값→undefined 변환이 같음 | /list 칸 연결에서 변환을 공유; 화면은 이벤트 값만 전달 |

`serializeSpringParams`와 `serializeFlatListParams`는 중첩 값의 허용 계약이 달라 같은 계산으로 취급하지 않는다(`src/api.ts:10`, `:35`). `normalizeFilterSelection`의 빈 배열=전체와 폼의 명시적 leaf 선택도 서로 다른 입력 의미이며 하나의 화면 옵션으로 덮지 않는다(0010 1-4).

## 검증과 남은 단계

이 단계는 문서 조사다. 책임 표·보장 대조표의 설계는 구현 후 실제 복사본으로 검사하고 결함을 넣어 실패를 확인해야 한다. README·스킬의 패키지 UI 설명은 구현 후 계획 M7·M9에서 교체한다. 이 기록만으로 4.0 동작·서버·발행이 완료되었다고 판정하지 않는다.


문서 단계 확인(2026-10-29): Node 24.19.0·빈 NODE_OPTIONS의 `pnpm check`에서 타입 검사·432개 동작 검사·산출물 기록 검사 3개가 통과했다. 입구 누락 검사는 아래 명령으로 22개 중 누락 0을 확인했다. 4.0 구현 검증과는 구분한다.

```sh
rtk proxy python3 - <<'PY_CHECK'
import json
from pathlib import Path
keys = json.loads(Path('packages/web-kit/package.json').read_text())['exports']
doc = Path('docs/decisions/0011-web-kit-4-ui-distribution.md').read_text()
missing = [key for key in keys if '| `' + key + '` |' not in doc]
print({'exports': len(keys), 'missing': missing})
assert not missing
PY_CHECK
```

관찰 결과: `{'exports': 22, 'missing': []}` (exit 0).
