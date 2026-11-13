// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결하고, 복사본의 앱 기본값·표시 입구를 확인한다.
import { Detail, DetailDefaults, type RenderDetailFailure } from '../detail';
import { checkRecordUiConformance } from '@boosterlab/web-kit/testing/unit/record';
import installation from '../../../../../registry-installation.json';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
checkRecordUiConformance({ Detail }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });

// 아래는 이 복사본의 앱 기본 문구 단계(DetailDefaults)와 이력 머리글 입구를 확인한다.

afterEach(cleanup);
const appRecordFailure: RenderDetailFailure = () => 'APP LOAD FAILURE';
const failedState = { kind: 'failed' as const, failure: new Error('down'), retry: () => undefined };

describe('DetailDefaults (앱 기본 문구 → 상세 문구, 실패 문구 단계)', () => {
  it('uses app messages and renderFailure, letting a local undefined fall through and local messages win', () => {
    render(
      <DetailDefaults messages={{ retry: 'Retry', empty: 'n/a' }} renderFailure={appRecordFailure}>
        <Detail state={failedState} renderFailure={() => undefined} messages={{ retry: undefined }}>{() => null}</Detail>
        <Detail.Field label="outside">{''}</Detail.Field>
      </DetailDefaults>,
    );
    expect(screen.getByText('APP LOAD FAILURE')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    // Detail 밖의 Field도 앱 기본 빈 값 문구를 쓴다.
    expect(document.querySelector('dd')!.textContent).toBe('n/a');
  });

  it('hides on a local null, keeps a local empty string and merges nested defaults', () => {
    const view = render(
      <DetailDefaults renderFailure={appRecordFailure}>
        <Detail state={failedState} renderFailure={() => null}>{() => null}</Detail>
      </DetailDefaults>,
    );
    expect(view.container.textContent).toBe('');
    view.unmount();
    render(
      <DetailDefaults renderFailure={appRecordFailure}>
        <Detail state={failedState} renderFailure={() => ''}>{() => null}</Detail>
      </DetailDefaults>,
    );
    expect(screen.queryByText('APP LOAD FAILURE')).toBeNull();
    expect(screen.queryByText('항목을 불러오지 못했습니다.')).toBeNull();
    cleanup();
    render(
      <DetailDefaults messages={{ historyEmpty: 'outer none', empty: 'outer empty' }}>
        <DetailDefaults messages={{ historyEmpty: 'inner none' }}>
          <Detail.History entries={[]} labels={{ at: 'At', changes: 'Changes', actor: 'Actor' }} />
          <Detail.Field label="v">{null}</Detail.Field>
        </DetailDefaults>
      </DetailDefaults>,
    );
    expect(screen.getByText('inner none')).toBeTruthy();
    expect(document.querySelector('dd')!.textContent).toBe('outer empty');
  });

  it('applies History headerClassName to the history header', () => {
    render(<Detail.History entries={[{ id: '1', at: 'now', actor: 'me', changes: ['a'] }]} labels={{ at: 'At', changes: 'Changes', actor: 'Actor' }} headerClassName="bg-muted" />);
    expect(document.querySelector('thead')!.className).toContain('bg-muted');
  });
});
