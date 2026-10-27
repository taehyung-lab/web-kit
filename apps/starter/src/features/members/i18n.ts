// 파일 책임: 회원 목록 예시 문구의 ko/en 원문.
export const memberResources = {
  ko: {
    members: {
      title: '회원',
      fields: { name: '이름', email: '이메일', signupMethod: '가입 방법', accountStatus: '계정 상태', joinedAt: '가입일', lastLoginAt: '최근 접속' },
      signupMethod: { EMAIL: '이메일', KAKAO: '카카오', NAVER: '네이버' },
      accountStatus: { ACTIVE: '정상', DORMANT: '휴면', BLOCKED: '정지' },
      periodType: { joinedAt: '가입일', lastLoginAt: '최근 접속일' },
      keywordField: { name: '이름', email: '이메일', phone: '휴대폰' },
      sort: { joinedAt: '가입일순', name: '이름순', lastLoginAt: '최근 접속순' },
      filter: { period: '기간', keyword: '검색어', all: '전체', lastWeek: '최근 7일', lastMonth: '최근 1개월' },
      list: { notSearched: '검색 조건을 정하고 검색을 누르세요.', empty: '조건에 맞는 회원이 없습니다.' },
    },
  },
  en: {
    members: {
      title: 'Members',
      fields: { name: 'Name', email: 'Email', signupMethod: 'Sign-up method', accountStatus: 'Account status', joinedAt: 'Joined', lastLoginAt: 'Last sign-in' },
      signupMethod: { EMAIL: 'Email', KAKAO: 'Kakao', NAVER: 'Naver' },
      accountStatus: { ACTIVE: 'Active', DORMANT: 'Dormant', BLOCKED: 'Blocked' },
      periodType: { joinedAt: 'Joined', lastLoginAt: 'Last sign-in' },
      keywordField: { name: 'Name', email: 'Email', phone: 'Phone' },
      sort: { joinedAt: 'Newest members', name: 'Name', lastLoginAt: 'Recent sign-in' },
      filter: { period: 'Period', keyword: 'Keyword', all: 'All', lastWeek: 'Last 7 days', lastMonth: 'Last month' },
      list: { notSearched: 'Set the filters and press Search.', empty: 'No members match these filters.' },
    },
  },
} as const;
