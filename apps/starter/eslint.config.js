// 파일 책임: lint 규칙. TypeScript·React hooks 규칙과, 공용(shared)이 앱·도메인 코드를 모르게 하는 import 경계를 둔다.
import js from '@eslint/js';
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
  {
    // shared는 화면 공용 표현만 맡는다. 앱 연결·도메인·서버 계약·route를 import하지 않는다.
    files: ['src/shared/**/*.{ts,tsx}'],
    // 테스트는 실제 앱 연결(i18n 등)을 띄울 수 있다.
    ignores: ['src/shared/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/app/*', '@/features/*', '@/api/*', '@/routes/*'], message: 'shared는 앱·도메인 코드를 모른다.' }] },
      ],
    },
  },
  {
    // feature는 route·app 연결을 역참조하지 않는다(세션·http는 app/web-kit에서 주입된 함수만 쓴다).
    files: ['src/features/**/*.{ts,tsx}'],
    ignores: ['src/features/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@/routes/*'], message: 'feature는 route를 모른다.' }] }],
    },
  },
  { files: ['*.config.{js,ts}'], languageOptions: { globals: globals.node } },
);
