// 파일 책임: 책임별 입구의 공개 런타임 이름을 고정해 내부 구현의 유출을 막는다.
import { expect, it } from 'vitest';
import * as core from '../src/index';
import * as form from '../src/form';
import * as list from '../src/list';
import * as dialog from '../src/confirmation';
import * as choice from '../src/choice-binding';
import * as auth from '../src/auth';
const entries = { core, form, list, dialog, choice, auth };
const expected = {
  "auth": ["getAuthTiming", "isAuthCode", "remainingAuthSeconds", "useAuthChallenge"],
  "choice": ["useChoiceBinding"],
  "core": [
    "RequestFailure",
    "checkboxTreeSelection",
    "createResultCodeTable",
    "isRequestFailure",
    "readEnvelope",
    "serializeFlatListParams",
    "serializeSpringParams",
    "toRequestFailure",
    "treeLeafNodes",
    "treeLeaves",
    "validateDateRange"
  ],
  "form": [
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
    "listPaginationBinding",
    "listRowBinding",
    "listViewBinding",
    "resolveListReturn",
    "useBulkConfirmation",
    "useList",
    "useListChoiceBinding",
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
it.each(['core', 'form', 'list', 'dialog', 'choice', 'auth'] as const)('%s 공개 이름은 승인된 목록과 정확히 같다', (name) => {
  expect(Object.keys(entries[name]).sort()).toEqual(expected[name]);
});

/** 4.0 공개 입구에서 시각 UI 경로가 다시 늘어나지 않게 고정한다. */
it('4.2 패키지 subpath는 승인된 28개 입구만 공개한다', () => {
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
  "./testing",
  "./testing/browser",
  "./testing/fixtures",
  "./testing/fixtures/auth",
  "./testing/session",
  "./testing/unit",
  "./testing/unit/auth",
  "./testing/unit/choice",
  "./testing/unit/form",
  "./testing/unit/primitives",
  "./testing/unit/styles"
]);
});
