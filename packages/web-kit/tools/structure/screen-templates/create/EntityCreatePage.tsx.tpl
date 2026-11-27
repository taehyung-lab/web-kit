// 파일 책임: {{Entity}} 등록 화면. 저장 흐름은 등록 flow가 맡는다. web-kit-new가 만든 골격이다.
import { use{{Entity}}Create } from '{{alias}}features/{{feature}}/model/form/use-{{entity}}-create';

export function {{Entity}}CreatePage() {
  const { editor } = use{{Entity}}Create();
  // TODO(web-kit-new): registry form/form의 Form·칸으로 필드를 배치한다(web-kit-form). 채우기 전에는 typecheck가 실패한다.
  return <{{TODO}}form_layout editor={editor} />;
}
