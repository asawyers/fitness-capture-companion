import { useEffect, useRef, useState } from 'react';
import { startVoice, type SpeechSession, type VoiceStatus } from './voice';

type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechSession; webkitSpeechRecognition?: new () => SpeechSession };

export function useVoice() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState('');
  const active = useRef<ReturnType<typeof startVoice> | null>(null);
  useEffect(() => {
    const speech = window as SpeechWindow;
    setSupported(Boolean(speech.SpeechRecognition || speech.webkitSpeechRecognition));
    return () => { active.current?.abort(); active.current = null; };
  }, []);
  function record(draft: string, onDraft: (value: string) => void) {
    active.current?.abort(); setError('');
    const speech = window as SpeechWindow;
    const Recognition = speech.SpeechRecognition || speech.webkitSpeechRecognition;
    if (!Recognition) { setError('Voice is unavailable in this browser. Type your note instead.'); return; }
    active.current = startVoice(() => new Recognition(), {
      onStatus: setStatus, onError: setError,
      onTranscript: text => onDraft([draft.trimEnd(), text].filter(Boolean).join('\n')),
    });
  }
  return { supported, status, error, record, stop: () => active.current?.stop() };
}
