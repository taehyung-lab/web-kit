// 파일 책임: 앱 골격(머리글·탐색·경로 오류·세션 안내) 문구의 ko/en 원문.
export const appResources = {
  ko: {
    app: {
      title: '관리자',
      nav: { products: '상품', members: '회원', terms: '약관 등록' },
      signOut: '로그아웃',
      language: '언어',
      routeNotFound: '페이지를 찾을 수 없습니다.',
      goHome: '처음으로',
      crashed: '화면을 그리는 중 문제가 발생했습니다.',
      dismiss: '닫기',
    },
  },
  en: {
    app: {
      title: 'Admin',
      nav: { products: 'Products', members: 'Members', terms: 'New terms' },
      signOut: 'Sign out',
      language: 'Language',
      routeNotFound: 'This page does not exist.',
      goHome: 'Go home',
      crashed: 'Something went wrong while showing this page.',
      dismiss: 'Dismiss',
    },
  },
} as const;
