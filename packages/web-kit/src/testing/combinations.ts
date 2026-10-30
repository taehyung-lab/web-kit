// 파일 책임: 함께 설치된 기능의 검사만 늦게 읽어 해당 조합의 의존만 사용한다.
import type { ConformanceTarget } from './target.mjs';
/** 폼과 덮개 조합의 기존 G001–G009를 등록한다. */
export async function checkFormProgressConformance(parts: Parameters<typeof import('./unit/progress-form').checkFormProgressConformance>[0], target: ConformanceTarget) {
  (await import('./unit/progress-form')).checkFormProgressConformance(parts, target);
}
/** 목록과 덮개 조합의 기존 G016–G017을 등록한다. */
export async function checkListProgressConformance(parts: Parameters<typeof import('./unit/progress-list').checkListProgressConformance>[0], target: ConformanceTarget) {
  (await import('./unit/progress-list')).checkListProgressConformance(parts, target);
}
/** 단건과 덮개 조합의 기존 G018–G020을 등록한다. */
export async function checkRecordProgressConformance(parts: Parameters<typeof import('./unit/progress-record').checkRecordProgressConformance>[0], target: ConformanceTarget) {
  (await import('./unit/progress-record')).checkRecordProgressConformance(parts, target);
}
/** 폼과 체크 트리 조합의 기존 tree-focus를 등록한다. */
export async function checkCheckboxTreeFocusConformance(parts: Parameters<typeof import('./unit/checkbox-tree-focus').checkCheckboxTreeFocusConformance>[0], target: ConformanceTarget) {
  (await import('./unit/checkbox-tree-focus')).checkCheckboxTreeFocusConformance(parts, target);
}
