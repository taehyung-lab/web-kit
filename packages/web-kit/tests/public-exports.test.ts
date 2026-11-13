// 파일 책임: 책임별 입구의 공개 런타임 이름을 고정해 내부 구현의 유출을 막는다.
import { expect, it } from 'vitest';
import * as core from '../src/index';
import * as form from '../src/form';
import * as list from '../src/list/index';
import * as dialog from '../src/confirmation';
import * as choice from '../src/choice-binding';
import * as search from '../src/search';
import * as auth from '../src/auth';
const entries = { core, form, list, dialog, choice, auth, search };
const expected = {
  "search": ["addKeyword", "arrayKeywordCodec", "calendarDate", "choices", "commitFilterSelection", "connectSearch", "dateRange", "definePolicy", "defineSearch", "keywords", "listSearch", "nextSort", "normalizeFilterSelection", "paging", "sameSearchValue", "shiftCalendarDate", "sort", "viewFilterSelection"],
  "auth": ["createAuthChallengeStore", "getAuthTiming", "isAuthCode", "remainingAuthSeconds", "useAuthChallenge"],
  "choice": ["normalizeChoiceValue", "useChoiceBinding"],
  "core": [
    "RequestFailure",
    "calendarDayBounds",
    "checkboxTreeSelection",
    "createResultCodeTable",
    "isRequestFailure",
    "readEnvelope",
    "safeAppPath",
    "serializeFlatListParams",
    "serializeSpringParams",
    "toRequestFailure",
    "toggleWithin",
    "treeLeafNodes",
    "treeLeaves",
    "validateDateRange"
  ],
  "form": [
    "DiscardSaveAttempt",
    "FormArrayField",
    "FormBindingProvider",
    "FormDialogScopeProvider",
    "FormGuardProvider",
    "FormRejection",
    "appendRow",
    "createFormMessages",
    "createFormNavigation",
    "formFieldControlId",
    "formFieldFeedback",
    "formFileBinding",
    "formTextBinding",
    "inSection",
    "moveRow",
    "removeRow",
    "requestFormChange",
    "sectionErrorCount",
    "useFormBinding",
    "useFormCancel",
    "useFormChoiceBinding",
    "useFormConfirmBinding",
    "useFormDialogScope",
    "useFormEditor",
    "useFormFieldBinding",
    "useFormGuardBinding",
    "useFormRootBinding",
    "useFormSavedBinding",
    "useFormSection",
    "useFormSubmitBinding",
    "useLeave",
    "useOptionsRetryFocus",
    "useSaveForm",
    "writeFormValues"
  ],
  "list": [
    "ListProvider",
    "activateTableRow",
    "captureListReturn",
    "listChoiceValue",
    "listFieldMeta",
    "listPaginationBinding",
    "listRowBinding",
    "listViewBinding",
    "resolveListReturn",
    "useBulkConfirmation",
    "useList",
    "useListChoiceBinding",
    "useListChoiceNormalization",
    "useListDetailsBinding",
    "useListDownload",
    "useListDownloadBinding",
    "useListField",
    "useListFilterBinding",
    "useListKeywordBinding",
    "useListModel",
    "useListMultiChoiceBinding",
    "useListPeriodBinding",
    "useListVirtualRows"
  ],
  "dialog": [
    "BlockingProgressProvider",
    "useAcknowledgeBinding",
    "useBlockingProgress",
    "useBlockingProgressBinding",
    "useConfirmBinding",
    "useConfirmationState",
    "useDialogBinding"
  ]
};
it.each(['core', 'form', 'list', 'dialog', 'choice', 'auth', 'search'] as const)('%s 공개 이름은 승인된 목록과 정확히 같다', (name) => {
  expect(Object.keys(entries[name]).sort()).toEqual(expected[name]);
});

/** 공개 입구에서 시각 UI 경로가 다시 늘어나지 않게 고정한다. */
it('패키지 subpath는 승인된 37개 입구만 공개한다', () => {
  const manifest = Object.values((import.meta as unknown as { glob: (pattern: string, options: object) => Record<string, string> }).glob('../package.json', { query: '?raw', import: 'default', eager: true }))[0]!;
  expect(Object.keys(JSON.parse(manifest).exports).sort()).toEqual([
  ".",
  "./api",
  "./auth",
  "./choice",
  "./dialog",
  "./failure",
  "./form",
  "./http",
  "./list",
  "./permission",
  "./query",
  "./record",
  "./search",
  "./session",
  "./session/activity",
  "./session/browser",
  "./session/idle",
  "./structure",
  "./testing",
  "./testing/browser",
  "./testing/fixtures",
  "./testing/fixtures/auth",
  "./testing/fixtures/combinations",
  "./testing/fixtures/dialog",
  "./testing/fixtures/progress",
  "./testing/session",
  "./testing/unit",
  "./testing/unit/auth",
  "./testing/unit/blocking-progress",
  "./testing/unit/checkbox-tree",
  "./testing/unit/choice",
  "./testing/unit/combinations",
  "./testing/unit/form",
  "./testing/unit/list",
  "./testing/unit/primitives",
  "./testing/unit/record"
]);
});
