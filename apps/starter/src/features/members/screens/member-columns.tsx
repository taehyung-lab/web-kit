// 파일 책임: 회원 목록의 열과 표시 형식을 선언한다.
import type { ListColumn } from '@boosterlab/web-kit/list/ui';
import { useTranslation } from 'react-i18next';
import type { MemberSummary } from '../model/member';

/** 언어에 맞는 회원 목록 열을 구성한다. */
export function useMemberColumns(): readonly ListColumn<MemberSummary>[] {
  const { t, i18n } = useTranslation();
  /** 날짜를 현재 언어로 표시한다. */
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(new Date(value));
  const columns: readonly ListColumn<MemberSummary>[] = [
    { key: 'name', header: t('members.fields.name'), sort: 'name', cell: (row) => row.name },
    { key: 'email', header: t('members.fields.email'), cell: (row) => row.email },
    { key: 'signupMethod', header: t('members.fields.signupMethod'), cell: (row) => t(`members.signupMethod.${row.signupMethod}`) },
    { key: 'accountStatus', header: t('members.fields.accountStatus'), cell: (row) => t(`members.accountStatus.${row.accountStatus}`) },
    { key: 'joinedAt', header: t('members.fields.joinedAt'), sort: 'joinedAt', cell: (row) => date(row.joinedAt) },
    { key: 'lastLoginAt', header: t('members.fields.lastLoginAt'), sort: 'lastLoginAt', cell: (row) => date(row.lastLoginAt) },
  ];
  return columns;
}
