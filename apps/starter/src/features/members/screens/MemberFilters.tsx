// 파일 책임: 회원 목록의 기간·검색어·선택 필터를 배치한다.
import { FilterPanel, FilterActions, PeriodFilter, KeywordFilter, MultiChoiceFilter } from '@/shared/ui/web-kit/list-ui';
import { useTranslation } from 'react-i18next';
import { MEMBER_ACCOUNT_STATUSES, MEMBER_KEYWORD_FIELDS, MEMBER_PERIOD_TYPES, MEMBER_SIGNUP_METHODS } from '../model/member';

/** 회원 검색 조건의 입력 영역을 그린다. */
export function MemberFilters() {
  const { t } = useTranslation();
  return (
    <FilterPanel>
      <PeriodFilter
        from="startDate"
        to="endDate"
        label={t('members.filter.period')}
        timeZone="Asia/Seoul"
        now={() => new Date()}
        type={{ name: 'periodType', options: MEMBER_PERIOD_TYPES.map((value) => ({ value, label: t(`members.periodType.${value}`) })) }}
        presets={[
          { label: t('members.filter.lastWeek'), value: { unit: 'day', amount: -7 } },
          { label: t('members.filter.lastMonth'), value: { unit: 'month', amount: -1 } },
        ]}
      />
      <KeywordFilter
        name="keywords"
        label={t('members.filter.keyword')}
        choices={MEMBER_KEYWORD_FIELDS.map((value) => ({ value, label: t(`members.keywordField.${value}`) }))}
      />
      <MultiChoiceFilter
        name="signupMethods"
        label={t('members.fields.signupMethod')}
        allLabel={t('members.filter.all')}
        options={MEMBER_SIGNUP_METHODS.map((value) => ({ value, label: t(`members.signupMethod.${value}`) }))}
      />
      <MultiChoiceFilter
        name="accountStatuses"
        label={t('members.fields.accountStatus')}
        allLabel={t('members.filter.all')}
        options={MEMBER_ACCOUNT_STATUSES.map((value) => ({ value, label: t(`members.accountStatus.${value}`) }))}
      />
      <FilterActions />
    </FilterPanel>
  );
}
