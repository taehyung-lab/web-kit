// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결한다.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../ui/styles.css'), 'utf8');
import { checkStylesConformance } from '@boosterlab/web-kit/testing/unit/styles';
import installation from '../../../../../registry-installation.json';
checkStylesConformance({ css }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
