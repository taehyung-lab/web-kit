// 실행 진입: 지원 코드(mock)와 앱 조립을 모두 쓸 수 있다.
import { App } from '@/app/App';
if (import.meta.env.MODE === 'mock') await import('@/mocks/db');
export const root = App;
