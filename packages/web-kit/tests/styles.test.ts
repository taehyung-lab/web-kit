// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.

import { checkStylesConformance } from '../src/testing/unit/styles';
const css = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => { readFileSync: (path: URL, encoding: string) => string } } }).process.getBuiltinModule('node:fs').readFileSync(new URL('../../ui-registry/src/ui/styles.css', import.meta.url), 'utf8');
checkStylesConformance({ css }, { registryVersion: 'source', registryCommit: 'source' });
