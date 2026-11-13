// 검사 파일은 구조 방향 검사에서 빠진다.
import { orderListQuery } from '../api/orders';
import { db } from '@/mocks/db';
export const used = [orderListQuery, db];
