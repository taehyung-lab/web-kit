// 파일 책임: 앱 골격(머리글·탐색·경로 오류·세션 안내·화면 전체 진행 덮개) 문구의 ko/en 원문.
export const appResources = {
  ko: {
    app: {
      title: '관리자',
      nav: { products: '상품', members: '회원', terms: '약관 등록', shows: '공연 예시' },
      signOut: '로그아웃',
      language: '언어',
      routeNotFound: '페이지를 찾을 수 없습니다.',
      goHome: '처음으로',
      crashed: '화면을 그리는 중 문제가 발생했습니다.',
      dismiss: '닫기',
      progress: { loading: '데이터를 불러오는 중입니다.', create: '등록 중입니다.', edit: '수정 중입니다.', delete: '삭제 중입니다.', wait: '잠시만 기다려 주세요.' },
    },
  },
  en: {
    app: {
      title: 'Admin',
      nav: { products: 'Products', members: 'Members', terms: 'New terms', shows: 'Show example' },
      signOut: 'Sign out',
      language: 'Language',
      routeNotFound: 'This page does not exist.',
      goHome: 'Go home',
      crashed: 'Something went wrong while showing this page.',
      dismiss: 'Dismiss',
      progress: { loading: 'Loading data.', create: 'Registering.', edit: 'Updating.', delete: 'Deleting.', wait: 'Please wait a moment.' },
    },
  },
} as const;
