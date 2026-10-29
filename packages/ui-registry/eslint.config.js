// 파일 책임: 배포할 registry UI·검사 연결의 문법과 React 연결을 소비 앱과 같은 기준으로 검사한다.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['src/**/*.{ts,tsx}', 'checks/**/*.{ts,tsx}'],
  extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
  languageOptions: { globals: globals.browser },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
  },
});
