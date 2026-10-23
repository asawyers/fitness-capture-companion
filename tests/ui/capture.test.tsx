// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Capture } from '../../src/features/capture/Capture';
afterEach(cleanup);

test('device dictation guidance focuses the compact note and preserves its draft', () => {
  render(<Capture busy={false} blocked={false} onSave={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'New note' })).toBeTruthy();
  const note = screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement;
  expect(note.rows).toBe(3);
  fireEvent.change(note, { target: { value: 'Lunch draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use device dictation' }));
  expect(document.activeElement).toBe(note);
  expect(note.value).toBe('Lunch draft');
  expect(screen.getByText(/On iPhone, tap the microphone on your keyboard/).textContent).toContain('configured Dictation shortcut');
  expect(note.getAttribute('aria-describedby')).toBeTruthy();
  fireEvent.change(note, { target: { value: 'Lunch draft and toast' } });
  expect(document.activeElement).toBe(note);
  expect(note.value).toBe('Lunch draft and toast');
});

test('the note grows with its content while keeping keyboard focus', () => {
  render(<Capture busy={false} blocked={false} onSave={vi.fn()} />);
  const note = screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement;
  Object.defineProperty(note, 'scrollHeight', { configurable: true, value: 180 });
  note.focus();
  fireEvent.change(note, { target: { value: 'A longer note\nwith more lines\nand details' } });
  expect(note.style.height).toBe('180px');
  expect(document.activeElement).toBe(note);
});

test('a failed capture keeps the meal draft and successful retry clears it', async () => {
  const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<Capture busy={false} blocked={false} onSave={onSave} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Your note' }), { target: { value: 'two eggs and rice' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith('meal', 'two eggs and rice'));
  expect((screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement).value).toBe('two eggs and rice');
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect((screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement).value).toBe(''));
});

test('switching to workout preserves typed text and saves the selected kind', async () => {
  const onSave = vi.fn().mockResolvedValue(false);
  render(<Capture busy={false} blocked={false} onSave={onSave} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Your note' }), { target: { value: 'squat 3 by 5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Workout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith('workout', 'squat 3 by 5'));
});

test('a completed save preserves a newer draft typed while the save promise settles', async () => {
  let finish!: (saved: boolean) => void;
  const onSave = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  render(<Capture busy={false} blocked={false} onSave={onSave} />);
  const note = screen.getByRole('textbox', { name: 'Your note' });
  fireEvent.change(note, { target: { value: 'first note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  fireEvent.change(note, { target: { value: 'next note' } });
  await act(async () => finish(true));
  expect((note as HTMLTextAreaElement).value).toBe('next note');
});

test('a pending save cannot submit again before the hook updates busy', async () => {
  let finish!: (saved: boolean) => void;
  const onSave = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  render(<Capture busy={false} blocked={false} onSave={onSave} />);
  const note = screen.getByRole('textbox', { name: 'Your note' });
  fireEvent.change(note, { target: { value: 'first note' } });
  const form = note.closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(onSave).toHaveBeenCalledTimes(1);
  await act(async () => finish(false));
});

test('capture uses the four-thousand-character note limit and preserves an overlong transcript', () => {
  const onSave = vi.fn();
  render(<Capture busy={false} blocked={false} onSave={onSave} />);
  const note = screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement;
  expect(note.maxLength).toBe(4000);
  fireEvent.change(note, { target: { value: 'x'.repeat(4001) } });
  fireEvent.submit(note.closest('form')!);
  expect(onSave).not.toHaveBeenCalled();
  expect(note.value).toHaveLength(4001);
  expect(screen.getByRole('alert').textContent).toContain('4,000');
});

test('an unexpected save rejection retains the draft and releases the submit lock for retry', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(false);
  render(<Capture busy={false} blocked={false} onSave={onSave} />);
  const note = screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: 'keep this note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await screen.findByRole('alert');
  expect(note.value).toBe('keep this note');
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
});
