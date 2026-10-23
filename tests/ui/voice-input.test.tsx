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
