# 실제 서버 연결

1. `openapi/sample.json`을 실제 서버 명세로 바꾸고(파일 이름을 바꾸면 `orval.config.ts`의 `input`도) `pnpm api:generate`를 돌린다. 생성물은 commit한다.
2. `src/app/web-kit.ts`의 결과 코드 표를 **서버 enum에 있는 행으로만** 다시 적는다. 예시 두 행(세션 종료 4012, 대상 없음 4040)은 지운다. 세션 종료 행은 서버 계약이 확정된 것만 둔다(web-kit 결정 기록 0003의 E1–E3).
3. `PUBLIC_PATHS`·`REISSUE_PATH`·재발급 본문, 브라우저 저장 key·자격증명 schema·읽기 불가 정책를 서버 인증 계약에 맞춘다.
4. `.env.example`을 `.env.local`로 복사해 `VITE_API_BASE_URL`·`VITE_API_TIMEOUT_MS`를 채운다. 비밀값은 commit하지 않는다.
5. 예시 기능(`features/products`, `routes/_app/products`, `mocks`의 상품 handler)을 자기 도메인으로 바꾸거나 지운다.

mock 통과나 HTTP 200만으로 서버 계약을 확인했다고 보지 않는다. 실제 서버로 401·재발급·필드 오류 모양을 따로 관찰한다.
