// 파일 책임: {{Entity}} 등록 흐름. 저장은 요청 결과를 돌려주고, 완료(onSaved)에서 다음 화면으로 간다. web-kit-new가 만든 골격이다.
import { useSaveForm } from '@boosterlab/web-kit/form';
import { useCreate{{Entity}} } from '{{alias}}features/{{feature}}/api/{{entity}}-create';
import { {{entityCamel}}FormSchema, type {{Entity}}FormInput, type {{Entity}}FormOutput } from '{{alias}}features/{{feature}}/model/form/{{entity}}-form';

// TODO(web-kit-new): 등록 화면의 첫 값을 제품 결정대로 정해 model의 폼 파일에 둔다. 채우기 전에는 typecheck가 실패한다.
const SOURCE: { readonly id: string; readonly values: {{Entity}}FormInput } = { id: 'new', values: {{TODO}}form_empty_values };

export function use{{Entity}}Create() {
  const create = useCreate{{Entity}}();
  const editor = useSaveForm({
    schema: {{entityCamel}}FormSchema,
    source: SOURCE,
    progress: 'create',
    save: (output: {{Entity}}FormOutput) => create.mutateAsync(output),
    // TODO(web-kit-new): 저장 뒤 갈 곳(제품 결정)으로 이동한다(useNavigate). 저장(save)과 완료(onSaved)를 섞지 않는다. 채우기 전에는 typecheck가 실패한다.
    onSaved: {{TODO}}after_save,
  });
  return { editor };
}
