// URL 검색 선언은 서버 선택지 query를 묶을 수 있다.
import { orderListQuery } from '../api/orders';
export const orderListSearch = { check: () => orderListQuery() };
