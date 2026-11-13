// 파일 책임: 키트 표현 부품(대화창·진행 표시·선택 칸)의 공개 입구. 묶음 부품(List·Form·Record)은 각 기능 입구의 /ui가 맡는다.
// 버튼·입력·선택·체크박스 같은 기본 부품은 키트가 다시 내보내지 않는다. 프로젝트의 shadcn 부품(components.json의 ui 별칭)을 직접 쓴다.
export { AlertDialog, ConfirmDialog, ConfirmationDialog, Dialog, DialogDefaults, defaultDialogLabels, type DialogLabels, type DialogProps } from './dialog';
export { Pending } from './pending';
export { BlockingProgress, type BlockingProgressMessages } from './blocking-progress';
export { useBlockingProgress, type BlockingKind } from '@boosterlab/web-kit/dialog';

export { Choice, MixedCheckbox, type ChoiceProps, type ChoiceNode, type ChoiceValue } from './choice';
