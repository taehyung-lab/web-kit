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
  {
    // 화면 코드는 설치한 UI 부품을 쓴다. 맨 HTML 입력·버튼은 키트 모양·포커스·잠금 규칙을 건너뛴다.
    files: ['src/app/**/*.tsx', 'src/features/**/*.tsx', 'src/routes/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...['button', 'input', 'select', 'textarea'].map((tag) => ({
          selector: `JSXOpeningElement[name.name='${tag}']`,
          message: `<${tag}> 대신 @/shared/ui/web-kit/ui의 Button·Input·Select·TextArea(폼 안이면 Form 칸)를 쓴다.`,
        })),
      ],
    },
  },
  {
    // 화면 파일은 모양과 연결만 둔다. 폼 schema·요청 변환은 같은 feature의 model/에 둔다.
    files: ['src/features/*/screens/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'zod', message: '폼 schema는 features/<도메인>/model/에 두고 화면은 그것을 import한다.' }],
          patterns: [{ group: ['@/routes/*'], message: 'feature는 route를 모른다.' }],
        },
      ],
    },
  },
  { files: ['*.config.{js,ts}'], languageOptions: { globals: globals.node } },
);
