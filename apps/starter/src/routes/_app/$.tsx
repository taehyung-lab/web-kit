// 파일 책임: 로그인 뒤 골격 안의 없는 경로. 골격(머리글·탐색)을 둔 채 없음 화면을 그린다.
import { RouteNotFound } from '@/app/errors';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/$')({
  component: RouteNotFound,
});
