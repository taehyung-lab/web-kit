// 파일 책임: 회원 목록 예시의 처음 mock 데이터. 가입 방법·상태·날짜가 골고루 섞이게 만든다. 바뀐 상태는 mockDb가 들고 있다.
import type { MemberSummary } from '@/features/members/model/member';

/** 60명의 처음 회원. 한 페이지(100건)에 가상화 기준(50행)을 넘게 담겨 머리글 고정 표를 보여 준다. */
export function seedMembers(): MemberSummary[] {
  const names = ['Kim Minji', 'Lee Jun', 'Park Sora', 'Choi Hana', 'Jung Woo', 'Kang Yuri', 'Yoon Ho', 'Han Bit', 'Seo Jin', 'Lim Dan'];
  const base = Date.UTC(2026, 0, 3);
  return Array.from({ length: 60 }, (_, index) => ({
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
