// runtime은 키트·외부 라이브러리만 쓴다.
import { createHttp } from '@boosterlab/web-kit/http';
export const http = createHttp();
export const queryClient = {};
export const apiRequest = <T,>(config: unknown): Promise<T> => http.request(config);
