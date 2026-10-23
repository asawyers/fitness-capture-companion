export interface SpeechSession {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start(): void; stop(): void; abort(): void;
}
export type VoiceStatus = 'idle' | 'starting' | 'recording' | 'stopping';
type Callbacks = {
  onStatus(status: VoiceStatus): void;
  onTranscript(text: string): void;
  onError(message: string): void;
};
type Clock = { schedule(callback: () => void, delay: number): () => void };
const clock: Clock = { schedule(callback, delay) { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); } };

function errorMessage(code: string) {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Microphone access was denied. Allow access in your browser, then try again, or type your note.';
  if (code === 'no-speech') return 'No speech was detected. Try again or type your note.';
  if (code === 'network') return 'Transcription lost its connection. Your text is still here. Try again or type.';
  if (code === 'audio-capture') return 'No microphone is available. Check your device, then try again or type.';
  return 'Recording could not start. Your text is still here. Try again or type.';
}

/** Speech results are snapshots; callers append each snapshot to the draft captured at start. */
export function startVoice(factory: () => SpeechSession, callbacks: Callbacks, timer: Clock = clock) {
  let session: SpeechSession | undefined;
  let ended = false, stopping = false;
  let cancelLimit = () => {}, cancelStop = () => {};
  function finish(abort = false) {
    if (ended) return;
    ended = true;
    cancelLimit(); cancelStop();
    if (session) {
      session.onstart = session.onend = session.onerror = session.onresult = null;
      if (abort) { try { session.abort(); } catch { /* Already stopped. */ } }
    }
    callbacks.onStatus('idle');
  }
  function stop() {
    if (ended || stopping) return;
    stopping = true; cancelLimit();
    callbacks.onStatus('stopping');
    cancelStop = timer.schedule(() => finish(true), 2_000);
    try { session?.stop(); } catch { finish(true); }
  }
  callbacks.onStatus('starting');
  try {
    session = factory();
    session.lang = 'en-US'; session.continuous = true; session.interimResults = true;
    session.onstart = () => { if (!ended && !stopping) callbacks.onStatus('recording'); };
    session.onend = () => finish();
    session.onerror = event => { if (!ended) { callbacks.onError(errorMessage(event.error)); finish(true); } };
    session.onresult = event => {
      if (ended) return;
      const text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim();
      if (text) callbacks.onTranscript(text);
    };
    cancelLimit = timer.schedule(stop, 60_000);
    session.start();
  } catch {
    callbacks.onError(errorMessage('start'));
    finish(true);
  }
  return { stop, abort: () => finish(true) };
}
