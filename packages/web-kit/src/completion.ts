/** 키트가 소유하는 비동기 완료 처리의 유효성. */
export interface CompletionStep {
  /** 화면·대상·시도가 바뀌지 않은 동안만 true. await 뒤 이동·상태 변경 직전에 확인한다. */
  readonly isCurrent: () => boolean;
}
