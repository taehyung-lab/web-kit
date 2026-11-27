// 파일 책임: {{Entity}} 상세 화면. 단건 상태는 상세 flow가 판정한다. web-kit-new가 만든 골격이다.
import { use{{Entity}}Detail } from '{{alias}}features/{{feature}}/model/detail/use-{{entity}}-detail';

export function {{Entity}}DetailPage({ id }: { readonly id: string }) {
  const state = use{{Entity}}Detail(id);
  // TODO(web-kit-new): registry record의 Detail로 대기·없음·실패·내용을 그린다(web-kit-record). 채우기 전에는 typecheck가 실패한다.
  return <{{TODO}}detail_layout state={state} />;
}
