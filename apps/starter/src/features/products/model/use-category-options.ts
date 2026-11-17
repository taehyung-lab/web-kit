// 파일 책임: 상품 분류 선택지 조회를 화면이 쓸 모양(상태·선택지·다시 시도·이름 찾기)으로 바꾼다. 목록·상세·등록·수정 flow가 같은 query(같은 캐시)를 쓴다.
import { useQuery } from '@tanstack/react-query';
import { categoryOptionsQuery } from '../api/categories';

/** 분류 선택지. 실패는 그 칸 자리에 보이고 다시 시도할 수 있다. */
export function useCategoryOptions() {
  const query = useQuery(categoryOptionsQuery());
  return {
    status: query.isError ? { failure: query.error } : query.data === undefined ? ('loading' as const) : ('ready' as const),
    options: (query.data ?? []).map((category) => ({ value: category.id, label: category.name })),
    retry: () => void query.refetch(),
    /** 분류 id → 이름. 선택지를 아직 못 받았거나 없는 id면 undefined. */
    nameOf: (id: string) => query.data?.find((category) => category.id === id)?.name,
  };
}

export type CategoryOptions = ReturnType<typeof useCategoryOptions>;
