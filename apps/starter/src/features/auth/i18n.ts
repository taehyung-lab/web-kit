// 파일 책임: 로그인 화면 문구의 ko/en 원문.
export const authResources = {
  ko: {
    auth: {
      title: '로그인',
      loginId: '아이디',
      password: '비밀번호',
      submit: '로그인',
      credentialRejected: '아이디 또는 비밀번호가 올바르지 않습니다.',
      ended: { server: '세션이 만료되었습니다. 다시 로그인하세요.', 'other-tab': '다른 탭에서 로그아웃했습니다.' },
      required: { loginId: '아이디를 입력하세요.', password: '비밀번호를 입력하세요.' },
      mockHint: 'mock 계정: admin / password',
    },
  },
  en: {
    auth: {
      title: 'Sign in',
      loginId: 'User ID',
      password: 'Password',
      submit: 'Sign in',
      credentialRejected: 'The user ID or password is incorrect.',
      ended: { server: 'Your session expired. Please sign in again.', 'other-tab': 'You signed out in another tab.' },
      required: { loginId: 'Enter your user ID.', password: 'Enter your password.' },
      mockHint: 'Mock account: admin / password',
    },
  },
} as const;
