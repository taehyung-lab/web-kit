// 파일 책임: lint 규칙. TypeScript·React hooks 규칙과, web-kit 구조 계약(폴더 역할·import 방향·맨 HTML 금지·route 파일 규칙)을 켠다.
// 구조 규칙의 내용은 설치한 @boosterlab/web-kit/structure가 소유한다. 이 앱은 경로 설정(web-kit.structure.json)만 넘기고 규칙을 끄지 않는다.
import js from '@eslint/js';
import { webKitStructure } from '@boosterlab/web-kit/structure';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'test-results', 'playwright-report', 'public/mockServiceWorker.js', 'src/api/generated', 'src/routeTree.gen.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  ...webKitStructure({ root: import.meta.dirname }),
  { files: ['*.config.{js,ts}'], languageOptions: { globals: globals.node } },
);
