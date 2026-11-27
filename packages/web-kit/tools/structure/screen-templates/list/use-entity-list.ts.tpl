// 파일 책임: {{Entity}} 목록 흐름. URL 검색·조회를 조립하고 화면이 쓸 목록 상태를 돌려준다. web-kit-new가 만든 골격이다.
import { useList } from '@boosterlab/web-kit/list';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { {{entityCamel}}ListQuery } from '{{alias}}features/{{feature}}/api/{{entity}}-list-query';
import { {{entityCamel}}ListSearch, to{{Entity}}ListParams } from '{{alias}}features/{{feature}}/model/list/{{entity}}-list-search';

/** urlSearch(주소 검색값)·navigate는 route가 URL에서 읽어 넘긴다. */
export function use{{Entity}}List({
  urlSearch,
  navigate,
}: {
  readonly urlSearch: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
}) {
  const list = useList({
    definition: {{entityCamel}}ListSearch,
    urlSearch,
    navigate,
    progress: 'page',
    query: (full) => {{entityCamel}}ListQuery(to{{Entity}}ListParams(full)),
    rowId: (row) => row.id,
  });
  return { list };
}
