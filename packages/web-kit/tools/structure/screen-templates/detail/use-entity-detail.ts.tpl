// 파일 책임: {{Entity}} 상세 흐름. 단건 상태 판정(useRecord)을 이 한 곳에서 한다. web-kit-new가 만든 골격이다.
import { useRecord } from '@boosterlab/web-kit/record';
import { {{entityCamel}}DetailQuery } from '{{alias}}features/{{feature}}/api/{{entity}}-detail-query';

export function use{{Entity}}Detail({{id}}: string) {
  return useRecord({{entityCamel}}DetailQuery({{id}}), {{id}}, { progress: 'page' });
}
