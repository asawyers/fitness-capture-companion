// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Entry } from '@domain/contracts';
import { EntryReview } from '../../src/features/review/EntryReview';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const entry: Entry = { id: 'entry-one', kind: 'meal', originalNote: 'eggs and toast', note: 'eggs and toast', details: [{ type: 'food', name: 'eggs', amount: 'two' }], pendingQuestion: null, analysisStatus: 'ready', logged: false, version: 1, createdAt: '2026-10-22T10:00:00Z', updatedAt: '2026-10-22T10:00:00Z' };
function setup(saveDetails = vi.fn().mockResolvedValue(true)) {
  const props = { entry, messages: [], busy: false, saveDetails, editNote: vi.fn().mockResolvedValue(true), setLogged: vi.fn().mockResolvedValue(true), reply: vi.fn().mockResolvedValue(true), skipQuestion: vi.fn().mockResolvedValue(true), analyze: vi.fn().mockResolvedValue(undefined), onDirty: vi.fn() };
  render(<EntryReview {...props} />);
  return props;
}

test('editing details blocks copy and logged actions until saved or discarded', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), { target: { value: 'three' } });
  expect((screen.getByRole('button', { name: 'Copy saved text' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Mark logged' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(screen.getByText('two')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Copy saved text' }) as HTMLButtonElement).disabled).toBe(false);
});

test('a failed detail save keeps the edited text available to retry', async () => {
  const props = setup(vi.fn().mockResolvedValue(false));
  fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Amount' }), { target: { value: 'about three' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(props.saveDetails).toHaveBeenCalledWith([{ type: 'food', name: 'eggs', amount: 'about three' }]));
  expect((screen.getByRole('textbox', { name: 'Amount' }) as HTMLInputElement).value).toBe('about three');
});

test('clipboard failure reveals selectable saved text without logging the entry', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  const props = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Copy saved text' }));
  await screen.findByRole('textbox', { name: 'Saved text to copy' });
  expect(props.setLogged).not.toHaveBeenCalled();
});

test('working-note edits keep the original capture visible and block saved actions', () => {
  setup();
  fireEvent.click(screen.getByText('Working note', { selector: 'summary' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
  const workingNote = screen.getByRole('textbox', { name: 'Working note' }).closest('details')!;
  expect(workingNote.open).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'Working note' }), { target: { value: 'two eggs and toast' } });
  expect((screen.getByRole('button', { name: 'Mark logged' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByText('Original note'));
  expect(screen.getByText('eggs and toast')).toBeTruthy();
});

test('working notes use the four-thousand-character contract limit', () => {
  setup();
  fireEvent.click(screen.getByText('Working note', { selector: 'summary' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
  expect((screen.getByRole('textbox', { name: 'Working note' }) as HTMLTextAreaElement).maxLength).toBe(4000);
});

test('optional replies preserve an overlong transcript and prevent submitting it', () => {
  const reply = vi.fn();
  render(<EntryReview entry={{ ...entry, pendingQuestion: { itemIndex: 0, field: 'amount', text: 'How many eggs?' } }} messages={[]} busy={false} saveDetails={vi.fn()} editNote={vi.fn()} setLogged={vi.fn()} reply={reply} skipQuestion={vi.fn()} analyze={vi.fn()} onDirty={vi.fn()} />);
  const answer = screen.getByRole('textbox', { name: 'Your reply' }) as HTMLTextAreaElement;
  expect(answer.maxLength).toBe(4000);
  fireEvent.change(answer, { target: { value: 'x'.repeat(4001) } });
  expect((screen.getByRole('button', { name: 'Save reply' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('4,000');
  expect(answer.value).toHaveLength(4001);
  expect(reply).not.toHaveBeenCalled();
});

test('the structured editor prevents adding a thirty-first detail', () => {
  const full = { ...entry, details: Array.from({ length: 30 }, () => ({ type: 'food' as const, name: 'eggs', amount: 'two' })) };
  render(<EntryReview entry={full} messages={[]} busy={false} saveDetails={vi.fn()} editNote={vi.fn()} setLogged={vi.fn()} reply={vi.fn()} skipQuestion={vi.fn()} analyze={vi.fn()} onDirty={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  expect((screen.getByRole('button', { name: 'Add food' }) as HTMLButtonElement).disabled).toBe(true);
});

test('a processing entry offers a retry when its one-minute lease expires', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
  const analyze = vi.fn();
  render(<EntryReview entry={{ ...entry, analysisStatus: 'processing' }} messages={[]} busy={false} saveDetails={vi.fn()} editNote={vi.fn()} setLogged={vi.fn()} reply={vi.fn()} skipQuestion={vi.fn()} analyze={analyze} onDirty={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Retry details' })).toBeNull();
  act(() => vi.advanceTimersByTime(59_999));
  expect(screen.queryByRole('button', { name: 'Retry details' })).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  fireEvent.click(screen.getByRole('button', { name: 'Retry details' }));
  expect(analyze).toHaveBeenCalledOnce();
});

test('a question disappearing leaves the unsaved reply visible and discardable', () => {
  const props = { messages: [], busy: false, saveDetails: vi.fn(), editNote: vi.fn(), setLogged: vi.fn(), reply: vi.fn(), skipQuestion: vi.fn(), analyze: vi.fn(), onDirty: vi.fn() };
  const view = render(<EntryReview {...props} entry={{ ...entry, pendingQuestion: { itemIndex: 0, field: 'amount', text: 'How many eggs?' } }} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Your reply' }), { target: { value: 'about two eggs' } });
  view.rerender(<EntryReview {...props} entry={{ ...entry, pendingQuestion: null, version: 2 }} />);
  expect((screen.getByRole('textbox', { name: 'Your reply' }) as HTMLTextAreaElement).value).toBe('about two eggs');
  expect((screen.getByRole('button', { name: 'Copy saved text' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Discard reply' }));
  expect((screen.getByRole('button', { name: 'Copy saved text' }) as HTMLButtonElement).disabled).toBe(false);
  expect(props.onDirty).toHaveBeenLastCalledWith(false);
});

test('reopening a processing entry with an expired lease immediately allows retry', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T10:02:00Z'));
  render(<EntryReview entry={{ ...entry, analysisStatus: 'processing' }} messages={[]} busy={false} saveDetails={vi.fn()} editNote={vi.fn()} setLogged={vi.fn()} reply={vi.fn()} skipQuestion={vi.fn()} analyze={vi.fn()} onDirty={vi.fn()} />);
  expect((screen.getByRole('button', { name: 'Retry details' }) as HTMLButtonElement).disabled).toBe(false);
});


test('review places structured details before actions and keeps saved notes collapsed below them', () => {
  setup();
  const details = screen.getByRole('region', { name: 'Details to log' });
  const copy = screen.getByRole('button', { name: 'Copy saved text' });
  const workingNote = screen.getByText('Working note', { selector: 'summary' }).closest('details')!;
  const originalNote = screen.getByText('Original note').closest('details')!;
  const conversation = screen.getByText(/Saved conversation/).closest('details')!;
  expect(details.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(copy.compareDocumentPosition(workingNote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(workingNote.open).toBe(false);
  expect(originalNote.open).toBe(false);
  expect(conversation.open).toBe(false);
});

test('workout review labels strength and cardio measurements', () => {
  render(<EntryReview entry={{ ...entry, kind: 'workout', details: [
    { type: 'strength', exercise: 'Squat', sets: '3', reps: '8', weight: '40 kg' },
    { type: 'cardio', activity: 'Run', duration: '20 min', distance: '3 km' },
  ] }} messages={[]} busy={false} saveDetails={vi.fn()} editNote={vi.fn()} setLogged={vi.fn()} reply={vi.fn()} skipQuestion={vi.fn()} analyze={vi.fn()} onDirty={vi.fn()} />);
  for (const label of ['Sets', 'Reps', 'Weight', 'Duration', 'Distance']) expect(screen.getByText(label, { selector: 'dt' })).toBeTruthy();
  expect(screen.getByText('40 kg')).toBeTruthy();
  expect(screen.getByText('3 km')).toBeTruthy();
});

test('copying saved text leaves logging as a separate action', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const props = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Copy saved text' }));
  await screen.findByText(/Copied. Mark logged/);
  expect(writeText).toHaveBeenCalledOnce();
  expect(props.setLogged).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Mark logged' }));
  expect(props.setLogged).toHaveBeenCalledWith(true);
});

test('reply submission immediately acknowledges Enter, blocks repeats and preserves failed drafts', async () => {
  let finish!: (saved: boolean) => void;
  const reply = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  render(<EntryReview entry={{ ...entry, pendingQuestion: { itemIndex: 0, field: 'amount', text: 'How many eggs?' } }} messages={[]} busy={false} saveDetails={vi.fn()} editNote={vi.fn()} setLogged={vi.fn()} reply={reply} skipQuestion={vi.fn()} analyze={vi.fn()} onDirty={vi.fn()} />);
  const answer = screen.getByRole('textbox', { name: 'Your reply' });
  fireEvent.change(answer, { target: { value: 'two eggs' } });
  fireEvent.keyDown(answer, { key: 'Enter', shiftKey: true });
  fireEvent.keyDown(answer, { key: 'Enter', isComposing: true });
  expect(reply).not.toHaveBeenCalled();
  fireEvent.keyDown(answer, { key: 'Enter' });
  expect(reply).toHaveBeenCalledExactlyOnceWith('two eggs');
  expect((screen.getByRole('button', { name: 'Saving reply…' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Saving your reply…')).toBeTruthy();
  fireEvent.keyDown(answer, { key: 'Enter' });
  expect(reply).toHaveBeenCalledOnce();
  await act(async () => { finish(false); });
  expect((answer as HTMLTextAreaElement).value).toBe('two eggs');
  expect((screen.getByRole('button', { name: 'Save reply' }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole('alert').textContent).toContain('could not be saved');
});

test('background analysis stays visible beside the question after the reply is saved', () => {
  render(<EntryReview entry={entry} messages={[]} busy={false} analyzing saveDetails={vi.fn()} editNote={vi.fn()} setLogged={vi.fn()} reply={vi.fn()} skipQuestion={vi.fn()} analyze={vi.fn()} onDirty={vi.fn()} />);
  const question = screen.getByRole('region', { name: 'Preparing details' });
  expect(question.hasAttribute('aria-busy')).toBe(false);
  expect(question.querySelector('[role="status"]')).toBeTruthy();
  expect(question.textContent).toContain('Your saved note and replies are safe.');
  expect(question.querySelector('.loading-spinner')).toBeTruthy();
});
