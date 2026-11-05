// 묶음 골격은 route.tsx다. 진입 판정은 feature 공개 연결을 읽는다.
import { isOrderOpen } from '@/features/orders/public';
export const Route = { beforeLoad: () => isOrderOpen('OPEN') };
