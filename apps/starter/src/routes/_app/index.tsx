// 파일 책임: 로그인 뒤 첫 경로. 기본 화면(상품 목록)으로 보낸다.
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/')({
  beforeLoad: () => {
    throw redirect({ to: '/products', replace: true });
  },
});
