## 프로젝트 지도

- 제품 원문·사용자 결정: `docs/product/`에 둔다. 실제 제품 요구와 결정권자는 미확인.
- 코드 진입·서버 계약: `src/runtime/web-kit.ts`가 요청·세션 연결, `src/app/screens.ts`가 업무 문구·메뉴·첫 화면 등록, `src/features/`가 업무별 조립(처음에는 인증만 있다), `openapi/sample.json`이 교체할 인증 예시 서버 명세다. 새 업무 화면은 `pnpm exec web-kit-new`로 만들고 다른 업무를 복사하지 않는다. 공통 동작의 기준은 설치한 `.agents/skills/web-kit-*`와 같은 패키지의 공개 타입에서 읽는다.
- 실행·검사: `package.json`, `.github/workflows/check.yml`, `tests/e2e/`, `registry-installation.json`을 따른다. `.env.example`은 설정 이름, `src/mocks/`는 격리된 mock 서버(인증 + `feature-mocks.ts`에 잇는 업무 handler)다. 실제 서버 환경은 미확인.
- 권한·보호 대상: 실제 계정·서버·시험 데이터 생성/정리 권한은 미확인. 비밀값은 `.env.local`에 두며 커밋하지 않는다.

## 이 저장소의 소유

제품 코드·문구·화면과 `src/shared/ui/web-kit`의 UI 복사본은 이 프로젝트가 고친다. 공통 상태·실패·중복 실행 처리는 설치된 web-kit이 맡는다. 같은 기능의 값 차이는 입력으로, 다른 업무는 프로젝트 연결 코드로 표현한다. 기능 선택은 `README.md` 및 설치 패키지의 `docs/consuming.md`에서 찾는다.
