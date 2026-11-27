// 파일 책임: {{Entity}} 목록 화면. 목록 상태는 목록 flow가 조립한다. web-kit-new가 만든 골격이다.
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { use{{Entity}}List } from '{{alias}}features/{{feature}}/model/list/use-{{entity}}-list';

export function {{Entity}}ListPage({
  urlSearch,
  navigate,
}: {
  readonly urlSearch: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
}) {
  const { list } = use{{Entity}}List({ urlSearch, navigate });
  // TODO(web-kit-new): 제목·필터·결과 표·페이지 이동을 registry list로 배치한다(web-kit-list 「registry 표시」). 채우기 전에는 typecheck가 실패한다.
  return <{{TODO}}list_layout list={list} />;
}
