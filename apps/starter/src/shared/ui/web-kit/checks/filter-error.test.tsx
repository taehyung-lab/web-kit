// @vitest-environment jsdom
// 파일 책임: 설치한 filter-error 복사본을 키트 공통 단위 검사에 연결한다.
import { FilterError } from '../search/filter-error';
import { checkFilterErrorConformance } from '@boosterlab/web-kit/testing/unit/primitives';
import installation from '../../../../../registry-installation.json';
checkFilterErrorConformance({ FilterError }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
