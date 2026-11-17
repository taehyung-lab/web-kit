// 다른 feature는 public.ts로만 쓴다.
import { isOrderOpen, orderListSearch } from '@/features/orders';
export function useBilling() { return { canBill: isOrderOpen('OPEN'), search: orderListSearch }; }
