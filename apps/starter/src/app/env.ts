// 파일 책임: 빌드 환경 변수(import.meta.env)를 한 번 읽어 형식을 확정한다. 다른 코드는 import.meta.env를 직접 읽지 않는다.
import { z } from 'zod';

const schema = z.object({
  /** API origin. 빈 값이면 같은 origin(프록시·mock). */
  VITE_API_BASE_URL: z.string().default(''),
  /** 요청 timeout(ms). */
  VITE_API_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export const env = schema.parse(import.meta.env);
