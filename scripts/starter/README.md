# 새 웹 프로젝트

web-kit의 `apps/starter`에서 만든 실행 가능한 예시 앱이다. 요청·세션 연결과 목록·폼·상세 예제가 들어 있다. 모든 기능을 사용해야 하는 표준 페이지는 아니다. 예시가 필요 없는 경우 관련 화면·route·검사 연결을 확인하며 정리한다.

## 먼저 실행

Node 24.19.0과 pnpm 10.33.0을 사용한다.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
pnpm dev:mock
```

mock 계정은 `admin` / `password`다. 실제 서버 검증은 별도다. `package.json`에서 web-kit 파일을, `.agents/agent-workflow-kit.version`에서 AWK 커밋을 확인한다. 두 키트의 스킬은 `.agents/skills/`에 연결돼 있다. 새 에이전트 세션에서 작업에 맞는 스킬을 찾는지도 확인한다.

후보 버전의 registry tag는 아직 발행되지 않았을 수 있다. 현재 복사된 UI는 사용할 수 있지만, 새 UI 항목 추가·업데이트는 검증한 tag가 발행된 뒤 진행한다.

## 어디를 고치나

| 하고 싶은 일 | 시작할 곳 |
|---|---|
| 서버 응답·재발급·세션 저장 연결 | `src/app/web-kit.ts`, `openapi/` |
| 목록의 검색 방식·필드·컬럼 바꾸기 | `src/features/products/`(즉시 조회), `src/features/members/`(검색 후 조회) |
| 저장 폼 만들기 | `src/features/products/`의 폼과 저장 화면 |
| 첨부·배열·하위 폼 조립 살펴보기 | `src/features/shows/` |
| 문구·업무 과정·권한 바꾸기 | 해당 `src/features/`와 `docs/product/` |
| 모양 바꾸기 | `src/shared/ui/web-kit/`, `src/styles.css` |
| 어떤 공용 기능을 쓸지 판단 | [설치된 소비 안내](node_modules/@boosterlab/web-kit/docs/consuming.md#기능을-골라-쓰기) |

공통 동작을 사용할 때는 해당 기능의 `.agents/skills/web-kit-*`를 읽는다. 사용 기준과 예제가 설치한 패키지 안에 함께 있다. `.agents/skills/wf-*`는 작업 판단·설계·검증 방법이다.

## 자기 제품으로 바꾸기

1. `docs/product/`에 제품 요구·서버 계약의 근거를 두고 `AGENTS.md` 지도를 채운다.
2. 실제 서버 명세로 `openapi/sample.json`을 교체하고 `pnpm api:generate`를 실행한다. 주소·결과 코드·쿠키·재발급 계약을 `src/app/web-kit.ts`에 연결한다.
3. 필요한 기능부터 예시를 바꾼다. 같은 동작의 값 차이는 입력으로, 일부 추가 기능은 조합으로, 다른 업무 과정은 프로젝트 코드로 둔다. 프로젝트 이름을 공통 키트의 분기 조건으로 넣지 않는다.
4. UI를 바꾼 뒤 `pnpm check`를 실행한다. 디자인 변경은 알림이지만 필수 검사 누락·skip·실패·버전 불일치는 계속 실패한다. 검사 대상이 실제 화면에서 사용하는 UI인지도 확인한다.
5. 쓰지 않는 예제를 정리할 때 사용처·route·관련 검사·설치 항목의 의존을 함께 확인한다. 파일을 사용하면서 설치 기록만 지워 검사를 피하지 않는다.

실서버 주소는 `.env.example`을 참고해 `.env.local`에 넣는다. 시험 계정·생성 데이터 정리 권한을 확인한 뒤 실제 요청과 화면 결과를 확인한다. mock 성공을 실서버 성공으로 보고하지 않는다.

## 업데이트

[패키지 설치·복사본 갱신](node_modules/@boosterlab/web-kit/README.md#복사본-갱신)을 따른다. 패키지와 같은 출처의 registry를 사용한다. UI 갱신은 이전 원본·새 원본·현재 수정본을 비교해 프로젝트 수정을 보존한다. AWK는 고정한 버전의 공식 `install.sh --update`로 갱신한다.
