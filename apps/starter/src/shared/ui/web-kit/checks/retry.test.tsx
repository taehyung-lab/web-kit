// @vitest-environment jsdom
// 파일 책임: 설치한 retry 복사본을 키트 공통 단위 검사에 연결한다.
import { RetryRegion } from '../ui/retry';
import { checkRetryConformance } from '@boosterlab/web-kit/testing/unit';
import installation from '../../../../../registry-installation.json';
checkRetryConformance({ RetryRegion }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
