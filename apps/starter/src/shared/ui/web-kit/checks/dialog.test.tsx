// @vitest-environment jsdom
// 파일 책임: 설치한 dialog 복사본을 키트 공통 단위 검사에 연결한다.
import { ConfirmDialog, DialogDefaults, defaultDialogLabels } from '../dialog';
import { checkDialogConformance } from '@boosterlab/web-kit/testing/unit/primitives';
import installation from '../../../../../registry-installation.json';
checkDialogConformance(
  { ConfirmDialog, DialogDefaults, defaultDialogLabels },
  { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit }
);

// 아래는 이 복사본의 확인창 앱 기본값(DialogDefaults confirmation)과 화면별 덮어쓰기를 실제 useConfirmationState로 확인한다.
import { ConfirmationDialog } from '../dialog';
import { useConfirmationState } from '@boosterlab/web-kit/dialog';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';

afterEach(cleanup);

/** 실행이 실패하는 확인 하나와 열기 버튼. */
function FailingConfirmation({
  renderFailure,
}: {
  readonly renderFailure?: (failure: string) => ReactNode;
}) {
  const confirmation = useConfirmationState<number, string>({
    run: async () => {
      throw new Error('down');
    },
    onError: () => ({ kind: 'show', failure: 'down' }),
  });
  return (
    <>
      <button type="button" onClick={() => confirmation.request(1)}>
        open
      </button>
      <ConfirmationDialog confirmation={confirmation} title="Delete" renderFailure={renderFailure}>
        <p>body</p>
      </ConfirmationDialog>
    </>
  );
}

/** 실행은 성공하고 후속 처리만 실패하는 확인 하나. */
function CompletionFailingConfirmation() {
  const confirmation = useConfirmationState<number, string>({
    run: async () => 'done',
    onSuccess: async () => {
      throw new Error('navigation');
    },
    onError: () => ({ kind: 'show', failure: 'later' }),
  });
  return (
    <>
      <button type="button" onClick={() => confirmation.request(1)}>
        open
      </button>
      <ConfirmationDialog confirmation={confirmation} title="Delete">
        <p>body</p>
      </ConfirmationDialog>
    </>
  );
}

const withDefaults = (node: ReactNode) => (
  <DialogDefaults
    labels={defaultDialogLabels}
    confirmation={{
      renderFailure: (failure) => `APP FAILURE: ${String(failure)}`,
      completionMessage: <p>APP COMPLETION</p>,
      retryLabel: 'APP RETRY',
    }}
  >
    {node}
  </DialogDefaults>
);

it('shows the app confirmation failure copy when the screen gives none', async () => {
  render(withDefaults(<FailingConfirmation />));
  fireEvent.click(screen.getByText('open'));
  fireEvent.click(await screen.findByRole('button', { name: defaultDialogLabels.confirm }));
  expect(await screen.findByText('APP FAILURE: down')).toBeTruthy();
});

it('lets the screen failure copy win over the app default in that dialog only', async () => {
  render(withDefaults(<FailingConfirmation renderFailure={() => 'SCREEN FAILURE'} />));
  fireEvent.click(screen.getByText('open'));
  fireEvent.click(await screen.findByRole('button', { name: defaultDialogLabels.confirm }));
  expect(await screen.findByText('SCREEN FAILURE')).toBeTruthy();
  expect(screen.queryByText(/APP FAILURE/)).toBeNull();
});

it('shows the app completion message and retry label after only the follow-up failed', async () => {
  render(withDefaults(<CompletionFailingConfirmation />));
  fireEvent.click(screen.getByText('open'));
  fireEvent.click(await screen.findByRole('button', { name: defaultDialogLabels.confirm }));
  // 요청은 끝났고 후속 처리만 실패하면 창이 완료 설명과 재시도 버튼으로 남는다(요청은 다시 보내지 않는다).
  expect(await screen.findByText('APP COMPLETION')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'APP RETRY' })).toBeTruthy();
  expect(screen.queryByText('body')).toBeNull();
});

it('fails loudly when neither the app nor the screen gives a failure renderer', () => {
  expect(() =>
    render(
      <DialogDefaults labels={defaultDialogLabels}>
        <FailingConfirmation />
      </DialogDefaults>
    )
  ).toThrow(
    '<ConfirmationDialog> requires renderFailure or <DialogDefaults confirmation> above it'
  );
});
