// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from '../../src/App';
import type { useFitness } from '../../src/lib/use-fitness';

const hook = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof useFitness> }));
vi.mock('../../src/lib/use-fitness', () => ({ useFitness: () => hook.current }));
afterEach(cleanup);
function ready() {
  hook.current = { configured: true, authReady: true, user: { id: 'account-one', email: 'one@example.test' }, entries: [], selected: null, loading: false, busy: false, error: '', notice: '', signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), capture: vi.fn().mockResolvedValue(false), select: vi.fn(), reply: vi.fn(), saveDetails: vi.fn(), editNote: vi.fn(), setLogged: vi.fn(), skipQuestion: vi.fn(), analyze: vi.fn(), refresh: vi.fn() };
}

test('changing accounts clears the previous account’s capture draft', () => {
  ready();
  const view = render(<App />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Your note' }), { target: { value: 'private unsaved draft' } });
  hook.current = { ...hook.current, user: { id: 'account-two', email: 'two@example.test' } };
  view.rerender(<App />);
  expect((screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement).value).toBe('');
});

test('sign-in submits the provided email and password', () => {
  ready(); hook.current.user = null;
  render(<App />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'one@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(hook.current.signIn).toHaveBeenCalledWith('one@example.test', 'test-password');
});

test('an unconfigured app explains setup without presenting a broken sign-in form', () => {
  ready(); hook.current.user = null; hook.current.configured = false;
  render(<App />);
  expect(screen.getByRole('status').textContent).toContain('Supabase connection');
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
});
