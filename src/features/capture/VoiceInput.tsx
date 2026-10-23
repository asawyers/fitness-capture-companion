import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useVoice } from './use-voice';

export function VoiceInput({ value, onChange, label, placeholder, disabled = false, compact = false, rows, onRecording, actions, onSubmit }: {
  value: string; onChange(value: string): void; label: string; placeholder: string;
  disabled?: boolean; compact?: boolean; rows?: number; onRecording?(recording: boolean): void; actions?: ReactNode; onSubmit?(): void;
}) {
  const voice = useVoice();
  const [disclose, setDisclose] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const recording = voice.status !== 'idle';
  useEffect(() => { onRecording?.(recording); }, [recording, onRecording]);
  useLayoutEffect(() => {
    const field = textarea.current;
    if (!field) return;
    field.style.height = 'auto';
    if (field.scrollHeight) field.style.height = `${field.scrollHeight}px`;
  }, [value]);
  function start() {
    setDisclose(false);
    voice.record(value, onChange);
  }
  // Status is also reflected on the textarea so callers can safely review before submitting.
  return <div className={`voice-input ${compact ? 'compact' : ''}`}>
    <label className="field-label"><span className="voice-label">{label}</span>
      <textarea ref={textarea} aria-label={label} value={value} maxLength={4000} placeholder={placeholder} disabled={disabled || recording}
        onChange={event => onChange(event.target.value)} onKeyDown={event => {
          if (onSubmit && !disabled && !recording && event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing) {
            event.preventDefault(); onSubmit();
          }
        }} rows={rows ?? (compact ? 2 : 3)} />
    </label>
    <div className="voice-toolbar">
      {voice.supported ? <span className="browser-recording"><button type="button" className={recording ? 'button recording' : 'button subtle'} disabled={disabled || voice.status === 'stopping'}
        onClick={() => { if (recording) voice.stop(); else setDisclose(true); }}>
        <span aria-hidden="true">{recording ? '■' : '●'}</span> {voice.status === 'stopping' ? 'Finishing…' : recording ? 'Stop recording' : 'Record'}
      </button></span> : <span className="muted small">Browser recording isn’t available here.</span>}
      {recording && <span className="muted small" role="status">{voice.status === 'stopping' ? 'Preparing your transcript…' : 'Listening · up to 60 seconds'}</span>}
      {actions && <div className="voice-actions">{actions}</div>}
    </div>
    {disclose && <div className="voice-disclosure">
      <p>Your browser’s speech service may process audio. This app saves only the text you submit, never raw audio.</p>
      <div className="button-row"><button type="button" className="button primary" onClick={start} disabled={disabled}>Start recording</button>
        <button type="button" className="button subtle" onClick={() => setDisclose(false)}>Cancel</button></div>
    </div>}
    {voice.error && <p role="alert" className="inline-error">{voice.error}</p>}
  </div>;
}
