// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from '../../src/App';
import type { Entry } from '@domain/contracts';
import type { useFitness } from '../../src/lib/use-fitness';

const hook = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof useFitness> }));
vi.mock('../../src/lib/use-fitness', () => ({ useFitness: () => hook.current }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); voice.status = 'idle'; voice.instances = 0; });
const voice = vi.hoisted(() => ({ instances: 0, status: 'idle', supported: true, error: '', record: vi.fn(), stop: vi.fn() }));
vi.mock('../../src/features/capture/use-voice', () => ({ useVoice: () => { const [instance] = useState(() => voice.instances++); return { ...voice, status: instance === 0 ? voice.status : 'idle' }; } }));
function ready() {
  hook.current = { configured: true, authReady: true, user: { id: 'account-one', email: 'one@example.test' }, entries: [], selected: null, analyzingEntries: [], loading: false, busy: false, error: '', notice: '', signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), capture: vi.fn().mockResolvedValue(false), select: vi.fn(), reply: vi.fn(), saveDetails: vi.fn(), editNote: vi.fn(), setLogged: vi.fn(), skipQuestion: vi.fn(), analyze: vi.fn(), refresh: vi.fn() };
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

const entry: Entry = { id: 'entry-one', kind: 'meal', originalNote: 'eggs and toast', note: 'eggs and toast', details: [{ type: 'food', name: 'eggs', amount: 'two' }], pendingQuestion: null, analysisStatus: 'ready', logged: false, version: 1, createdAt: '2026-10-22T10:00:00Z', updatedAt: '2026-10-22T10:00:00Z' };

function selected() {
  ready();
  hook.current.entries = [entry];
  hook.current.selected = { entry, messages: [] };
}

test('capture and inbox navigation preserves the mounted capture draft', () => {
  ready();
  const view = render(<App />);
  const note = screen.getByRole('textbox', { name: 'Your note' });
  fireEvent.change(note, { target: { value: 'a draft meal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Inbox 0' }));
  expect(view.container.querySelector('.notebook')?.getAttribute('data-mobile-view')).toBe('inbox');
  fireEvent.click(screen.getByRole('button', { name: 'Capture' }));
  expect(screen.getByRole('textbox', { name: 'Your note' })).toBe(note);
  expect((note as HTMLTextAreaElement).value).toBe('a draft meal');
});

test('opening a note shows focused review and returning restores inbox scroll', () => {
  selected();
  const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Inbox 1' }));
  const inbox = view.container.querySelector('.inbox') as HTMLElement;
  inbox.scrollTop = 230;
  fireEvent.click(screen.getByRole('button', { name: /eggs and toast.*Ready to copy/ }));
  expect(hook.current.select).toHaveBeenCalledWith(entry.id);
  expect(view.container.querySelector('.notebook')?.getAttribute('data-mobile-view')).toBe('review');
  inbox.scrollTop = 0;
  fireEvent.click(screen.getByRole('button', { name: 'Back to inbox' }));
  expect(view.container.querySelector('.notebook')?.getAttribute('data-mobile-view')).toBe('inbox');
  expect(inbox.scrollTop).toBe(230);
});

test('dirty review blocks navigation and account transitions until discarded', () => {
  selected();
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Working note' }), { target: { value: 'changed note' } });
  for (const name of ['Capture', 'Inbox 1', 'Back to inbox', 'Sign out']) {
    expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
  }
  expect(screen.getByText(/Save or discard your review changes before navigating/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect((screen.getByRole('button', { name: 'Back to inbox' }) as HTMLButtonElement).disabled).toBe(false);
});


test('successful capture opens review while a failed save retains the draft', async () => {
  ready();
  hook.current.capture = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const view = render(<App />);
  const note = screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: 'eggs and toast' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(hook.current.capture).toHaveBeenCalledTimes(1));
  expect(note.value).toBe('eggs and toast');
  expect(view.container.querySelector('.notebook')?.getAttribute('data-mobile-view')).toBe('capture');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save note' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(view.container.querySelector('.notebook')?.getAttribute('data-mobile-view')).toBe('review'));
  expect(note.value).toBe('');
});

test('an unsaved optional reply blocks leaving its review', () => {
  selected();
  hook.current.selected = { entry: { ...entry, pendingQuestion: { itemIndex: 0, field: 'amount', text: 'How much toast?' } }, messages: [] };
  render(<App />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Your reply' }), { target: { value: 'two slices' } });
  expect((screen.getByRole('button', { name: 'Back to inbox' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Discard reply' }));
  expect((screen.getByRole('button', { name: 'Back to inbox' }) as HTMLButtonElement).disabled).toBe(false);
});


test('back to inbox focuses the replacement row after loading unmounts the list', () => {
  selected();
  const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Inbox 1' }));
  const row = screen.getByRole('button', { name: /eggs and toast.*Ready to copy/ });
  fireEvent.click(row);
  hook.current.loading = true; view.rerender(<App />);
  expect(row.isConnected).toBe(false);
  hook.current.loading = false; view.rerender(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Back to inbox' }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /eggs and toast.*Ready to copy/ }));
});

test('inbox to capture and back retains the latest inbox scroll', () => {
  ready();
  const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Inbox 0' }));
  const inbox = view.container.querySelector('.inbox') as HTMLElement;
  inbox.scrollTop = 190;
  fireEvent.click(screen.getByRole('button', { name: 'Capture' }));
  inbox.scrollTop = 0;
  fireEvent.click(screen.getByRole('button', { name: 'Inbox 0' }));
  expect(inbox.scrollTop).toBe(190);
});

test('desktop reply keeps the responsive pane on review without blurring the reply', () => {
  selected();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  hook.current.selected = { entry: { ...entry, pendingQuestion: { itemIndex: 0, field: 'amount', text: 'How much toast?' } }, messages: [] };
  const view = render(<App />);
  const reply = screen.getByRole('textbox', { name: 'Your reply' });
  reply.focus();
  fireEvent.change(reply, { target: { value: 'two slices' } });
  expect(view.container.querySelector('.notebook')?.getAttribute('data-mobile-view')).toBe('review');
  expect(document.activeElement).toBe(reply);
});

test('desktop capture recording keeps the responsive pane on capture', () => {
  selected();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /eggs and toast.*Ready to copy/ }));
  voice.status = 'recording';
  view.rerender(<App />);
  expect(view.container.querySelector('.notebook')?.getAttribute('data-mobile-view')).toBe('capture');
  expect((screen.getByRole('button', { name: 'Inbox 1' }) as HTMLButtonElement).disabled).toBe(true);
});


test('capture recording blocks review editing and reply recording while Stop stays available', () => {
  selected();
  hook.current.selected = { entry: { ...entry, pendingQuestion: { itemIndex: 0, field: 'amount', text: 'How much toast?' } }, messages: [] };
  const view = render(<App />);
  voice.status = 'recording';
  view.rerender(<App />);
  expect((screen.getByRole('button', { name: 'Edit details' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Edit note' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('textbox', { name: 'Your reply' }) as HTMLTextAreaElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Stop recording' }) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole('button', { name: 'Record' }) as HTMLButtonElement).disabled).toBe(true);
});
