// 앱 조립은 runtime과 feature를 모두 안다.
import { queryClient } from '@/runtime/http';
import { OrderListScreen } from '@/features/orders/screens/OrderListScreen';
export function App() { return <OrderListScreen client={queryClient} />; }
