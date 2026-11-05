// 파일 책임: 키트 단위 검사 설정. registry 원본이 import하는 shadcn 기본 부품(`@/components/ui/*`)을
// 저장소의 검사용 shadcn 설치본(packages/ui-registry/shadcn)으로 연결한다. 소비 프로젝트에서는 shadcn CLI가 같은 import를 프로젝트 별칭으로 바꾼다.
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../ui-registry/shadcn', import.meta.url)) } },
});
