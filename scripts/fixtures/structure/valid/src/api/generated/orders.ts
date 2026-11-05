// 생성 코드는 runtime mutator를 쓴다(검사 대상 아님).
import { apiRequest } from '../../runtime/http';
import type { Order } from './models/order';
export const listOrders = () => apiRequest<Order[]>({ url: '/orders' });
