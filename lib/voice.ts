export type VoiceStatus = 'idle' | 'starting' | 'recording';
export interface SpeechSession {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: {
        error: string;
    }) => void) | null;
    onresult: ((event: {
        results: ArrayLike<ArrayLike<{
            transcript: string;
        }>>;
    }) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}
export type SpeechFactory = () => SpeechSession;
export function voiceError(error: string): string {
    if (error === 'not-allowed' || error === 'service-not-allowed')
        return 'Microphone permission was denied. Allow it in your browser, then try again, or type your note.';
    if (error === 'no-speech')
        return 'No speech was detected. Try again or type your note.';
    if (error === 'audio-capture')
        return 'No microphone is available. Check your device, then try again or type your note.';
    if (error === 'network')
        return 'Transcription lost its network connection. Your text is still here. Try again or type.';
    return 'Recording could not start. Your text is still here. Try again or type your note.';
}
/** Browser recognition owns microphone transport; this app never receives raw audio. */
export function startVoice(factory: SpeechFactory, callbacks: {
    onTranscript(text: string): void;
    onStatus(status: VoiceStatus): void;
    onError(message: string): void;
}): {
    stop(): void;
    abort(): void;
} {
    let session: SpeechSession | undefined;
    callbacks.onStatus('starting');
    try {
        session = factory();
        session.lang = 'en-US';
        session.continuous = true;
        session.interimResults = true;
        session.onstart = () => callbacks.onStatus('recording');
        session.onend = () => callbacks.onStatus('idle');
        session.onerror = event => { callbacks.onError(voiceError(event.error)); callbacks.onStatus('idle'); };
        session.onresult = event => {
            const text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim();
            if (text)
                callbacks.onTranscript(text);
        };
        session.start();
    }
    catch {
        callbacks.onError(voiceError('start'));
        callbacks.onStatus('idle');
    }
    return {
        stop() { try {
            session?.stop();
        }
        catch {
            callbacks.onStatus('idle');
        } },
        abort() {
            if (session) {
                session.onstart = null;
                session.onend = null;
                session.onerror = null;
                session.onresult = null;
                try {
                    session.abort();
                }
                catch { }
            }
        },
    };
}
