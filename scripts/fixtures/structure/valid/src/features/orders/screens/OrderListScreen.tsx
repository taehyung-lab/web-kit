// 화면은 flow를 호출하고 그린다. api·생성 코드는 타입으로만 안다.
import { Link } from '@tanstack/react-router';
import type { orderListQuery } from '../api/orders';
import type { Order } from '@/api/generated/models/order';
import { Button } from '@/shared/ui/button';
import { useOrderList } from '../flows/use-order-list';
import { ORDER_LIMIT } from '../model/rules/order-policy';
export type Query = ReturnType<typeof orderListQuery>;
export function OrderListScreen(_: { client: unknown }) {
  const flow = useOrderList();
  const rows: Order[] = flow.rows;
  return <div><Link to="/orders">{ORDER_LIMIT}</Link><Button>{rows.length}</Button></div>;
}
