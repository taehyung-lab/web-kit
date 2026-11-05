// api는 생성 코드와 runtime을 감싼다.
import { listOrders } from '@/api/generated/orders';
import { queryOptions } from '@tanstack/react-query';
export const orderListQuery = () => queryOptions({ queryKey: ['orders'], queryFn: listOrders });
