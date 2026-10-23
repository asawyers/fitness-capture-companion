// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Capture } from '../../src/features/capture/Capture';
import type { SpeechSession } from '../../src/features/capture/voice';

const sessions: BrowserSpeech[] = [];
class BrowserSpeech implements SpeechSession {
  lang = ''; continuous = false; interimResults = false;
  onstart: SpeechSession['onstart'] = null; onend: SpeechSession['onend'] = null;
  onerror: SpeechSession['onerror'] = null; onresult: SpeechSession['onresult'] = null;
  abort = vi.fn();
  constructor() { sessions.push(this); }
  start() { this.onstart?.(); }
  stop() { this.onend?.(); }
}
beforeEach(() => { sessions.length = 0; Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: BrowserSpeech }); });
afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'SpeechRecognition'); });
function begin() {
  fireEvent.click(screen.getByRole('button', { name: 'Record' }));
  expect(sessions).toHaveLength(0);
  expect(screen.getByText(/browser’s speech service may process audio/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
}

test('typing into the note does not start browser recording', () => {
  render(<Capture busy={false} blocked={false} onSave={vi.fn()} />);
  const note = screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: 'Keep my draft' } });
  note.focus();
  expect(document.activeElement).toBe(note);
  expect(note.value).toBe('Keep my draft');
  expect(sessions).toHaveLength(0);
  expect((screen.getByRole('button', { name: 'Save note' }) as HTMLButtonElement).disabled).toBe(false);
});

test('a blocked capture preserves its draft and disables editing, recording, and saving', () => {
  const onSave = vi.fn();
  const view = render(<Capture busy={false} blocked={false} onSave={onSave} />);
  const note = screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: 'Keep my draft' } });
  view.rerender(<Capture busy={false} blocked={true} onSave={onSave} />);
  expect(note.disabled).toBe(true);
  expect(note.value).toBe('Keep my draft');
  for (const name of ['Record', 'Save note']) {
    const button = screen.getByRole('button', { name }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(sessions).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Start recording' })).toBeNull();
  expect(screen.queryByText(/On iPhone, tap the microphone/)).toBeNull();
  expect(onSave).not.toHaveBeenCalled();
  view.rerender(<Capture busy={false} blocked={false} onSave={onSave} />);
  expect(note.disabled).toBe(false);
  expect(note.value).toBe('Keep my draft');
});

test('capture reports browser recording activity to its parent', () => {
  const onRecording = vi.fn();
  render(<Capture busy={false} blocked={false} onSave={vi.fn()} onRecording={onRecording} />);
  begin();
  expect(onRecording).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
  expect(onRecording).toHaveBeenLastCalledWith(false);
});

test('withdrawn interim recognition restores the original typed draft', () => {
  render(<Capture busy={false} blocked={false} onSave={vi.fn()} />);
  const note = screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: 'Original lunch draft  ' } });
  begin();
  act(() => sessions[0].onresult?.({ results: [[{ transcript: 'withdrawn words' }]] }));
  expect(note.value).toBe('Original lunch draft\nwithdrawn words');
  act(() => sessions[0].onresult?.({ results: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
  expect(note.value).toBe('Original lunch draft  ');
});

test('recording discloses processing and leaves an editable transcript for review before save', () => {
  const onSave = vi.fn();
  render(<Capture busy={false} blocked={false} onSave={onSave} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Your note' }), { target: { value: 'Lunch' } });
  begin();
  expect((screen.getByRole('button', { name: 'Save note' }) as HTMLButtonElement).disabled).toBe(true);
  act(() => sessions[0].onresult?.({ results: [[{ transcript: 'two egg' }]] }));
  act(() => sessions[0].onresult?.({ results: [[{ transcript: 'two eggs' }]] }));
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
  expect((screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement).value).toBe('Lunch\ntwo eggs');
  expect((screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement).disabled).toBe(false);
  expect(onSave).not.toHaveBeenCalled();
});

test('a denied session keeps typed text, retry uses a fresh session, and unmount releases it', () => {
  const view = render(<Capture busy={false} blocked={false} onSave={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Your note' }), { target: { value: 'Keep my draft' } });
  begin();
  act(() => sessions[0].onerror?.({ error: 'not-allowed' }));
  expect(screen.getByRole('alert').textContent).toContain('denied');
  expect((screen.getByRole('textbox', { name: 'Your note' }) as HTMLTextAreaElement).value).toBe('Keep my draft');
  fireEvent.click(screen.getByRole('button', { name: 'Record' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
  expect(sessions).toHaveLength(2);
  view.unmount();
  expect(sessions[1].abort).toHaveBeenCalledOnce();
  expect(sessions[1].onresult).toBeNull();
});
