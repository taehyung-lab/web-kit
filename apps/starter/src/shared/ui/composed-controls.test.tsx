import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { SelectBox } from './web-kit/select-box';
import { ConfirmationDialog, DialogDefaults, defaultDialogLabels } from './web-kit/ui/dialog';

it('distinguishes an unselected placeholder from the empty-string all option and forwards focus/aria', async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  const ref = vi.fn();
  const options = [{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled', disabled: true }];
  const { rerender } = render(<SelectBox options={options} value={null} onValueChange={change} placeholder="Choose" aria-label="Status" aria-invalid ref={ref} />);
  expect(screen.getByRole('combobox').textContent).toContain('Choose');
  expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBe('true');
  expect(ref).toHaveBeenCalledWith(screen.getByRole('combobox'));
  rerender(<SelectBox options={options} value="" onValueChange={change} aria-label="Status" />);
  expect(screen.getByRole('combobox').textContent).toContain('All');
  await user.click(screen.getByRole('combobox'));
  expect((await screen.findByRole('option', { name: 'Disabled' })).getAttribute('aria-disabled')).toBe('true');
  await user.click(screen.getByRole('option', { name: 'Active' }));
  await waitFor(() => expect(change).toHaveBeenCalledWith('active'));
});

it('connects confirmation failure, pending lock and covered visibility without owning the request', async () => {
  const confirm = vi.fn(async () => undefined);
  const close = vi.fn();
  const confirmation = { state: { kind: 'open' as const, values: 1, pending: false, failure: 'Try again' }, covered: false, confirm, close, request: vi.fn() };
  const view = (control: typeof confirmation) => <DialogDefaults labels={defaultDialogLabels}><ConfirmationDialog confirmation={control} title="Delete" renderFailure={failure => failure}>Body</ConfirmationDialog></DialogDefaults>;
  const { rerender } = render(view(confirmation));
  expect((await screen.findByRole('alert')).textContent).toBe('Try again');
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(confirm).toHaveBeenCalledTimes(1);
  rerender(view({ ...confirmation, state: { ...confirmation.state, pending: true } }));
  expect(screen.getByRole('button', { name: '확인' }).hasAttribute('disabled')).toBe(true);
  rerender(view({ ...confirmation, covered: true }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});
