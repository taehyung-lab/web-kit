// 파일 책임: 확정값의 정체성이 바뀔 때 초안을 갱신하고 입력·초기화 수명을 관리한다.
import { useState, type Dispatch, type SetStateAction } from 'react';

/** 프로젝트가 정한 확정값·정체성에서 입력 초안을 만든다. */
export function useDraftCommit<TCommitted, TDraft, TKey>({
  committed,
  keyOf,
  createDraft,
}: {
  readonly committed: TCommitted;
  readonly keyOf: (committed: TCommitted) => TKey;
  readonly createDraft: (committed: TCommitted) => TDraft;
}): {
  readonly draft: TDraft;
  readonly setDraft: Dispatch<SetStateAction<TDraft>>;
  readonly patchDraft: (patch: Partial<TDraft>) => void;
  readonly resetDraft: (target?: TCommitted) => void;
} {
  const key = keyOf(committed);
  const [stored, setStored] = useState(() => ({ key, draft: createDraft(committed) }));
  const current = Object.is(stored.key, key) ? stored : { key, draft: createDraft(committed) };

  if (current !== stored) setStored(current);

  const setDraft: Dispatch<SetStateAction<TDraft>> = (next) =>
    setStored((value) => ({
      key: value.key,
      draft: typeof next === 'function' ? (next as (draft: TDraft) => TDraft)(value.draft) : next,
    }));

  return {
    draft: current.draft,
    setDraft,
    /** Shallow merge form of `setDraft`; the caller still chooses which fields it may patch. */
    patchDraft: (patch) => setDraft((value) => ({ ...value, ...patch })),
    /**
     * Rebuilds from `target` (default: the current committed value). A caller that discards the
     * draft and then commits a new value passes that value: the commit lands later (e.g. via the
     * URL), and rebuilding from the old committed value would show it again in between.
     */
    resetDraft: (target = committed) => setDraft(createDraft(target)),
  };
}
