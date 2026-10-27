// 파일 책임: openapi/ 명세에서 타입과 endpoint 함수만 생성한다. 모든 호출은 web-kit http.request(mutator) 하나로 나간다.
// React Query hook·key·무효화는 생성하지 않는다. 그것은 features/<도메인>/api 가 소유한다.
import { defineConfig } from 'orval';

export default defineConfig({
  sample: {
    input: { target: './openapi/sample.json' },
    output: {
      mode: 'tags-split',
      target: './src/api/generated',
      schemas: './src/api/generated/models',
      client: 'axios-functions',
      clean: true,
      override: {
        mutator: { path: './src/app/web-kit.ts', name: 'apiRequest' },
      },
    },
  },
});
