// 파일 책임: {{Entity}} 수정 흐름. 원본 단건 상태와, 준비된 원본으로 만든 저장 폼을 나눠 돌려준다. web-kit-new가 만든 골격이다.
import { useSaveForm } from '@boosterlab/web-kit/form';
import { useRecord } from '@boosterlab/web-kit/record';
import { {{entityCamel}}DetailQuery } from '{{alias}}features/{{feature}}/api/{{entity}}-detail-query';
import { useUpdate{{Entity}} } from '{{alias}}features/{{feature}}/api/{{entity}}-update';
import { {{entityCamel}}FormSchema, type {{Entity}}FormOutput } from '{{alias}}features/{{feature}}/model/form/{{entity}}-form';
import type { {{Entity}} } from '{{alias}}features/{{feature}}/model/{{entity}}';

/** 수정 원본의 단건 상태. */
export function use{{Entity}}EditSource(id: string) {
  return useRecord({{entityCamel}}DetailQuery(id), id, { progress: 'page' });
}

/** 준비된 원본의 수정 폼. */
export function use{{Entity}}Edit(record: {{Entity}}) {
  const update = useUpdate{{Entity}}(record.id);
  const editor = useSaveForm({
    schema: {{entityCamel}}FormSchema,
    // TODO(web-kit-new): 원본 → 폼 값 변환을 model의 폼 파일에 두고 여기서 쓴다. 채우기 전에는 typecheck가 실패한다.
    source: { id: record.id, values: {{TODO}}form_values(record) },
    progress: 'edit',
    save: async (output: {{Entity}}FormOutput) => {
      await update.mutateAsync(output);
    },
    // TODO(web-kit-new): 저장 뒤 갈 곳(제품 결정)으로 이동한다. 채우기 전에는 typecheck가 실패한다.
    onSaved: {{TODO}}after_save,
  });
  return { editor };
}
