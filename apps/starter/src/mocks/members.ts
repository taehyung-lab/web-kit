// 파일 책임: 회원 목록 예시의 고정 mock 데이터(읽기 전용). 가입 방법·상태·날짜가 골고루 섞이게 만든다.
import type { MemberSummary } from '@/features/members/model/member';

/** 30명의 고정 회원. */
function seedMembers(): MemberSummary[] {
  const names = ['Kim Minji', 'Lee Jun', 'Park Sora', 'Choi Hana', 'Jung Woo', 'Kang Yuri', 'Yoon Ho', 'Han Bit', 'Seo Jin', 'Lim Dan'];
  const base = Date.UTC(2026, 0, 3);
  return Array.from({ length: 30 }, (_, index) => ({
    id: `m-${String(index + 1).padStart(3, '0')}`,
    name: `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`,
    email: `member${index + 1}@example.com`,
    phone: `010-0000-${String(1000 + index)}`,
    signupMethod: (['EMAIL', 'KAKAO', 'NAVER'] as const)[index % 3]!,
    accountStatus: (['ACTIVE', 'ACTIVE', 'DORMANT', 'BLOCKED'] as const)[index % 4]!,
    joinedAt: new Date(base + index * 4 * 86_400_000).toISOString(),
    lastLoginAt: new Date(base + (index * 4 + 30) * 86_400_000).toISOString(),
  }));
}

export const MEMBERS: readonly MemberSummary[] = seedMembers();
