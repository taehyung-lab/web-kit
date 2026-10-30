// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결한다.
import { List, useListField } from '../list-ui';
import { Pending } from '../ui/pending';
import { checkListUiConformance } from '@boosterlab/web-kit/testing/unit';
import installation from '../../../../../registry-installation.json';
checkListUiConformance({ List, useListField, Pending }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
