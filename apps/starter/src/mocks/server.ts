// 파일 책임: 테스트(node·jsdom)에서 mock API를 켜는 msw server.
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
