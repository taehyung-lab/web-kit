// 파일 책임: 회원 목록 예시의 앱 모델과 고정 선택지. 검색을 눌러야 조회하는 목록을 키트 값 설정만으로 재현하는 예다.
export const MEMBER_KEYWORD_FIELDS = ['name', 'email', 'phone'] as const;
export const MEMBER_PERIOD_TYPES = ['joinedAt', 'lastLoginAt'] as const;
export const MEMBER_SIGNUP_METHODS = ['EMAIL', 'KAKAO', 'NAVER'] as const;
export const MEMBER_ACCOUNT_STATUSES = ['ACTIVE', 'DORMANT', 'BLOCKED'] as const;
export const MEMBER_SORT_KEYS = ['joinedAt', 'name', 'lastLoginAt'] as const;
export const MEMBER_PAGE_SIZES = [20, 50, 100] as const;

export type MemberSignupMethod = (typeof MEMBER_SIGNUP_METHODS)[number];
export type MemberAccountStatus = (typeof MEMBER_ACCOUNT_STATUSES)[number];

/** 목록 한 행. */
export interface MemberSummary {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly signupMethod: MemberSignupMethod;
  readonly accountStatus: MemberAccountStatus;
  readonly joinedAt: string;
  readonly lastLoginAt: string;
}
