'use client';
import { useEffect, useRef, useState } from 'react';
import { startVoice } from '../lib/voice';
import type { SpeechSession, VoiceStatus } from '../lib/voice';
type SpeechWindow = Window & {
    SpeechRecognition?: new () => SpeechSession;
    webkitSpeechRecognition?: new () => SpeechSession;
};
export function useVoice() {
    const [supported, setSupported] = useState<boolean | null>(null);
    const [status, setStatus] = useState<VoiceStatus>('idle');
    const [error, setError] = useState('');
    const active = useRef<ReturnType<typeof startVoice> | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => {
        const w = window as SpeechWindow;
        setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
        return () => { clearTimeout(timer.current); active.current?.abort(); };
    }, []);
    function record(note: string, onNote: (note: string) => void) {
        clearTimeout(timer.current);
        active.current?.abort();
        setError('');
        const w = window as SpeechWindow;
        const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!Recognition) {
            setError('Voice is unavailable in this browser. Type your note instead.');
            return;
        }
        active.current = startVoice(() => new Recognition(), {
            onTranscript: text => onNote([note.trim(), text].filter(Boolean).join('\n')),
            onError: setError,
            onStatus: value => { setStatus(value); if (value === 'idle')
                clearTimeout(timer.current); },
        });
        // Keep accidental long recordings bounded; no raw audio is stored.
        timer.current = setTimeout(() => active.current?.stop(), 60000);
    }
    return { supported, status, error, record, stop: () => active.current?.stop() };
}
