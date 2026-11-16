// route는 URL 검색 선언(state)과 화면만 연결한다.
import { orderListSearch } from '@/features/orders/search/order-list-search';
import { OrderListPage } from '@/features/orders/pages/OrderListPage';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/_app/orders/')({ validateSearch: orderListSearch, component: () => <OrderListPage client={null} /> });
