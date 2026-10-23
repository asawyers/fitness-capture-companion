import { test } from 'vitest';
import assert from 'node:assert/strict';
import { startVoice, type SpeechSession } from '../../src/features/capture/voice.ts';

function setup() {
  const statuses: string[] = [], transcripts: string[] = [], errors: string[] = [];
  const scheduled: { callback: () => void; delay: number; cancelled: boolean }[] = [];
  let aborts = 0;
  const session: SpeechSession = {
    lang: '', continuous: false, interimResults: false,
    onstart: null, onend: null, onerror: null, onresult: null,
    start() { this.onstart?.(); }, stop() {}, abort() { aborts++; },
  };
  const voice = startVoice(() => session, {
    onStatus: value => statuses.push(value), onTranscript: value => transcripts.push(value),
    onError: value => errors.push(value),
  }, {
    schedule(callback, delay) { const timer = { callback, delay, cancelled: false }; scheduled.push(timer); return () => { timer.cancelled = true; }; },
  });
  return { voice, session, statuses, transcripts, errors, scheduled, get aborts() { return aborts; } };
}

test('speech results are complete snapshots so corrections replace earlier words', () => {
  const h = setup();
  h.session.onresult?.({ results: [[{ transcript: 'two egg' }]] });
  h.session.onresult?.({ results: [[{ transcript: 'two eggs' }], [{ transcript: 'and toast' }]] });
  assert.deepEqual(h.transcripts, ['two egg', 'two eggs and toast']);
  h.voice.abort();
});

test('an empty speech snapshot removes withdrawn interim words', () => {
  const h = setup();
  h.session.onresult?.({ results: [[{ transcript: 'withdrawn words' }]] });
  h.session.onresult?.({ results: [] });
  assert.deepEqual(h.transcripts, ['withdrawn words', '']);
  h.voice.abort();
});

test('stop waits for the final transcript and then ends the session', () => {
  const h = setup();
  h.voice.stop();
  assert.equal(h.statuses.at(-1), 'stopping');
  h.session.onresult?.({ results: [[{ transcript: 'a short walk' }]] });
  h.session.onend?.();
  assert.equal(h.statuses.at(-1), 'idle');
  assert.deepEqual(h.transcripts, ['a short walk']);
  assert.equal(h.session.onresult, null);
});

test('permission and network errors preserve delivered text and release the session', () => {
  for (const code of ['not-allowed', 'network', 'no-speech']) {
    const h = setup();
    h.session.onresult?.({ results: [[{ transcript: 'kept text' }]] });
    h.session.onerror?.({ error: code });
    assert.equal(h.statuses.at(-1), 'idle');
    assert.equal(h.aborts, 1);
    assert.equal(h.session.onresult, null);
    assert.equal(h.errors.length, 1);
    assert.deepEqual(h.transcripts, ['kept text']);
  }
});

test('unavailable speech services suggest device dictation without a microphone permission loop', () => {
  for (const code of ['network', 'service-not-allowed']) {
    const h = setup();
    h.session.onerror?.({ error: code });
    assert.match(h.errors[0], /speech service/);
    assert.match(h.errors[0], /device dictation/);
    assert.doesNotMatch(h.errors[0], /allow access|try again/i);
  }
});

test('abort detaches late browser events and cancels the recording limit', () => {
  const h = setup();
  const lateResult = h.session.onresult;
  h.voice.abort();
  lateResult?.({ results: [[{ transcript: 'late words' }]] });
  assert.deepEqual(h.transcripts, []);
  assert.equal(h.aborts, 1);
  assert.equal(h.scheduled[0].cancelled, true);
});

test('recording stops after sixty seconds and forcibly ends a stalled stop', () => {
  const h = setup();
  assert.equal(h.scheduled[0].delay, 60_000);
  h.scheduled[0].callback();
  assert.equal(h.statuses.at(-1), 'stopping');
  assert.equal(h.scheduled[1].delay, 2_000);
  h.scheduled[1].callback();
  assert.equal(h.statuses.at(-1), 'idle');
  assert.equal(h.aborts, 1);
});

test('a start failure returns to idle and reports a retryable error', () => {
  const statuses: string[] = [], errors: string[] = [];
  startVoice(() => { throw new Error('device unavailable'); }, {
    onStatus: value => statuses.push(value), onTranscript() {}, onError: value => errors.push(value),
  });
  assert.deepEqual(statuses, ['starting', 'idle']);
  assert.match(errors[0], /try again/i);
});
