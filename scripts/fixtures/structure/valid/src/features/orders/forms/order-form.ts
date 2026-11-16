// model은 순수하다: 생성 모델 값과 api 타입(타입 전용)은 쓸 수 있다.
import { OrderStatus } from '@/api/generated/models/order';
import type { orderListQuery } from '../api/orders';
import { z } from 'zod';
import { ORDER_LIMIT } from '../rules/order-policy';
export type OrderQuery = ReturnType<typeof orderListQuery>;
export const orderSchema = z.object({ status: z.enum([OrderStatus.OPEN, OrderStatus.CLOSED]), count: z.number().max(ORDER_LIMIT) });
