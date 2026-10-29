// 파일 책임: 책임별 입구의 공개 런타임 이름을 고정해 내부 구현의 유출을 막는다.
import { expect, it } from 'vitest';
import * as core from '../src/index';
import * as form from '../src/form';
import * as list from '../src/list';
import * as dialog from '../src/form/confirmation';
const entries = { core, form, list, dialog };
const expected = {
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
    "useChoiceBinding",
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
    "useChoiceBinding",
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
it.each(['core', 'form', 'list', 'dialog'] as const)('%s 공개 이름은 승인된 목록과 정확히 같다', (name) => {
  expect(Object.keys(entries[name]).sort()).toEqual(expected[name]);
});
