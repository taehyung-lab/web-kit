// 앱 조립은 runtime과 feature를 모두 안다.
import { queryClient } from '@/runtime/http';
import { OrderListPage } from '@/features/orders/pages/OrderListPage';
export function App() { return <OrderListPage client={queryClient} />; }
