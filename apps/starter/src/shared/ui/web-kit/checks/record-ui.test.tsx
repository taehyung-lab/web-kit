// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결하고, 복사본의 앱 기본값·표시 입구를 확인한다.
import { Record, RecordDefaults, type RenderRecordFailure } from '../detail-ui';
import { checkRecordUiConformance } from '@boosterlab/web-kit/testing/unit/record';
import installation from '../../../../../registry-installation.json';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
checkRecordUiConformance({ Record }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });

// 아래는 이 복사본의 앱 기본 문구 단계(RecordDefaults)와 이력 머리글 입구를 확인한다.

afterEach(cleanup);
const appRecordFailure: RenderRecordFailure = () => 'APP LOAD FAILURE';
const failedState = { kind: 'failed' as const, failure: new Error('down'), retry: () => undefined };

describe('RecordDefaults (앱 기본 문구 → 상세 문구, 실패 문구 단계)', () => {
  it('uses app messages and renderFailure, letting a local undefined fall through and local messages win', () => {
    render(
      <RecordDefaults messages={{ retry: 'Retry', empty: 'n/a' }} renderFailure={appRecordFailure}>
        <Record state={failedState} renderFailure={() => undefined} messages={{ retry: undefined }}>{() => null}</Record>
        <Record.Field label="outside">{''}</Record.Field>
      </RecordDefaults>,
    );
    expect(screen.getByText('APP LOAD FAILURE')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    // Record 밖의 Field도 앱 기본 빈 값 문구를 쓴다.
    expect(document.querySelector('dd')!.textContent).toBe('n/a');
  });

  it('hides on a local null, keeps a local empty string and merges nested defaults', () => {
    const view = render(
      <RecordDefaults renderFailure={appRecordFailure}>
        <Record state={failedState} renderFailure={() => null}>{() => null}</Record>
      </RecordDefaults>,
    );
    expect(view.container.textContent).toBe('');
    view.unmount();
    render(
      <RecordDefaults renderFailure={appRecordFailure}>
        <Record state={failedState} renderFailure={() => ''}>{() => null}</Record>
      </RecordDefaults>,
    );
    expect(screen.queryByText('APP LOAD FAILURE')).toBeNull();
    expect(screen.queryByText('항목을 불러오지 못했습니다.')).toBeNull();
    cleanup();
    render(
      <RecordDefaults messages={{ historyEmpty: 'outer none', empty: 'outer empty' }}>
        <RecordDefaults messages={{ historyEmpty: 'inner none' }}>
          <Record.History entries={[]} labels={{ at: 'At', changes: 'Changes', actor: 'Actor' }} />
          <Record.Field label="v">{null}</Record.Field>
        </RecordDefaults>
      </RecordDefaults>,
    );
    expect(screen.getByText('inner none')).toBeTruthy();
    expect(document.querySelector('dd')!.textContent).toBe('outer empty');
  });

  it('applies History headerClassName to the history header', () => {
    render(<Record.History entries={[{ id: '1', at: 'now', actor: 'me', changes: ['a'] }]} labels={{ at: 'At', changes: 'Changes', actor: 'Actor' }} headerClassName="bg-muted" />);
    expect(document.querySelector('thead')!.className).toContain('bg-muted');
  });
});
