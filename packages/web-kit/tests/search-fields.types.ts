// 파일 책임: 기간 선언은 실제 검색 필드 이름만 받는다.
import { z } from 'zod';
import { defineSearch } from '../src/search/fields';

const fields = {
  from: { schema: z.string(), default: undefined },
  to: { schema: z.string(), default: undefined },
};
defineSearch({ fields, periods: [['from', 'to']] });
defineSearch({
  fields,
  // @ts-expect-error 검색 선언에 없는 필드 이름은 기간 쌍으로 사용할 수 없다.
  periods: [['from', 'missing']],
});
