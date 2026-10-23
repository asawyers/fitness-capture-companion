import { useEffect, useState } from 'react';
import { useVoice } from './use-voice';

export function VoiceInput({ value, onChange, label, placeholder, disabled = false, compact = false, onRecording }: {
  value: string; onChange(value: string): void; label: string; placeholder: string;
  disabled?: boolean; compact?: boolean; onRecording?(recording: boolean): void;
}) {
  const voice = useVoice();
  const [disclose, setDisclose] = useState(false);
  const recording = voice.status !== 'idle';
  useEffect(() => { onRecording?.(recording); }, [recording, onRecording]);
  function start() {
    setDisclose(false);
    voice.record(value, onChange);
  }
  // Status is also reflected on the textarea so callers can safely review before submitting.
  return <div className={`voice-input ${compact ? 'compact' : ''}`}>
    <label className="field-label">{label}
      <textarea aria-label={label} value={value} maxLength={4000} placeholder={placeholder} disabled={disabled || recording}
        onChange={event => onChange(event.target.value)} rows={compact ? 2 : 5} />
    </label>
    <div className="voice-toolbar">
      {voice.supported ? <button type="button" className={recording ? 'button recording' : 'button subtle'} disabled={disabled || voice.status === 'stopping'}
        onClick={() => { if (recording) voice.stop(); else setDisclose(true); }}>
        <span aria-hidden="true">{recording ? '■' : '●'}</span> {voice.status === 'stopping' ? 'Finishing…' : recording ? 'Stop recording' : 'Record'}
      </button> : <span className="muted small">Voice isn’t available here. You can type your note.</span>}
      <span className="muted small" role="status">{recording ? voice.status === 'stopping' ? 'Preparing your transcript…' : 'Listening · up to 60 seconds' : 'Review and edit before saving.'}</span>
    </div>
    {disclose && <div className="voice-disclosure">
      <p>Your browser’s speech service may process audio. This app saves only the text you submit, never raw audio.</p>
      <div className="button-row"><button type="button" className="button primary" onClick={start} disabled={disabled}>Start recording</button>
        <button type="button" className="button subtle" onClick={() => setDisclose(false)}>Cancel</button></div>
    </div>}
    {voice.error && <p role="alert" className="inline-error">{voice.error}</p>}
  </div>;
}
