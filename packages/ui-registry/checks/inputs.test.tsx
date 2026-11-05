// @vitest-environment jsdom
// 파일 책임: 프로젝트의 shadcn 기본 부품이 키트 부품이 기대는 속성(버튼 기본 type, 입력·체크 접근성 속성)을 지키는지 공통 단위 검사에 연결한다.
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { checkInputsConformance } from '@boosterlab/web-kit/testing/unit/primitives';
import installation from '../../../../../registry-installation.json';
checkInputsConformance({ Button, Input, Checkbox }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
