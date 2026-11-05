// route는 URL 검색 선언(state)과 화면만 연결한다.
import { orderListSearch } from '@/features/orders/state/order-list-search';
import { OrderListScreen } from '@/features/orders/screens/OrderListScreen';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/_app/orders/')({ validateSearch: orderListSearch, component: () => <OrderListScreen client={null} /> });
