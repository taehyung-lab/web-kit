// flow는 api·state·model·실행 hook·이동을 조립하고 화면이 쓸 값만 돌려준다.
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { orderListQuery } from '../api/orders';
import { orderListSearch } from '../search/order-list-search';
import { isOrderOpen } from '../rules/order-policy';
export function useOrderList() {
  const navigate = useNavigate();
  const query = useQuery(orderListQuery());
  return { rows: query.data ?? [], search: orderListSearch, open: (id: string) => navigate({ to: id }), isOpen: isOrderOpen };
}
