// 파일 책임: {{Entity}} 수정 화면. 원본 조회·저장은 수정 flow가 맡는다. web-kit-new가 만든 골격이다.
import { use{{Entity}}Edit, use{{Entity}}EditSource } from '{{alias}}features/{{feature}}/model/form/use-{{entity}}-edit';
import type { {{Entity}} } from '{{alias}}features/{{feature}}/model/{{entity}}';

export function {{Entity}}EditPage({ id }: { readonly id: string }) {
  const state = use{{Entity}}EditSource(id);
  // TODO(web-kit-new): registry record의 Detail로 원본 상태를 그리고 준비되면 수정 폼을 그린다(web-kit-record·web-kit-form). 채우기 전에는 typecheck가 실패한다.
  return <{{TODO}}edit_layout state={state} renderForm={(record: {{Entity}}) => <{{Entity}}EditForm record={record} />} />;
}

function {{Entity}}EditForm({ record }: { readonly record: {{Entity}} }) {
  const { editor } = use{{Entity}}Edit(record);
  // TODO(web-kit-new): registry form/form의 Form·칸으로 필드를 배치한다(web-kit-form). 채우기 전에는 typecheck가 실패한다.
  return <{{TODO}}form_layout editor={editor} />;
}
