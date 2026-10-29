// 파일 책임: 명시 목록 모델의 행·초안 타입이 읽기 hook에서 보존되는지 검사한다.
import { ListProvider, useListModel, type ListModel } from '../src/list';
/** 읽기 결과의 행·초안은 전달한 모델과 같은 타입이어야 한다. */
export function TypedList({ model }: { model: ListModel<{ id: string }, { term: string }> }) {
  const read = useListModel(model);
  const term: string = read.draft.term;
  const id: string | undefined = read.rows[0]?.id;
  // @ts-expect-error 행에 없는 속성을 허용하지 않는다.
  read.rows[0]?.missing;
  // @ts-expect-error 초안에 없는 키를 허용하지 않는다.
  read.patchDraft({ absent: 'value' });
  return <ListProvider model={model}><output>{term}{id}</output></ListProvider>;
}
