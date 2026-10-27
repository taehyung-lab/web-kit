// 파일 책임: 설치한 키트 UI(Field·ConfirmDialog·RetryRegion)가 공개 보장(접근성 연결·확인 관문·재시도 focus)을 깨지 않는지 /testing 검사로 확인한다.
import '@/app/i18n';
import { checkConfirmDialogAdapter, checkFieldAdapter, checkRetryFocusAdapter } from '@boosterlab/web-kit/testing';
import { describe, it } from 'vitest';
import { ConfirmDialog, Field, TextInput } from '@boosterlab/web-kit/form/ui';
import { RetryRegion } from '@boosterlab/web-kit/detail/ui';

describe('installed kit UI', () => {
  it('Field keeps label, description and error wired to the control', async () => {
    await checkFieldAdapter(({ id, label, description, message }) => (
      <Field id={id} label={label} description={description} message={message}>
        {(control) => <TextInput {...control} />}
      </Field>
    ));
  });

  it('ConfirmDialog opens on the stage, blocks closing while saving and saves the shown snapshot', async () => {
    await checkConfirmDialogAdapter(
      ({ open, pending, onConfirm, onCancel, children }) => (
        <ConfirmDialog
          open={open}
          pending={pending}
          title="Save?"
          confirmLabel="Save"
          cancelLabel="Cancel"
          onConfirm={onConfirm}
          onCancel={onCancel}
        >
          {children}
        </ConfirmDialog>
      ),
      { confirm: 'Save', cancel: 'Cancel' },
    );
  });

  it('RetryRegion moves focus to the control only when the focused retry button disappears', async () => {
    await checkRetryFocusAdapter(({ failed, onRetry, controlId }) => (
      <RetryRegion failed={failed} onRetry={onRetry} controlId={controlId}>
        <button type="button" id={controlId}>
          content
        </button>
      </RetryRegion>
    ));
  });
});
