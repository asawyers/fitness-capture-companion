import type { Kind } from '@domain/contracts';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { VoiceInput } from './VoiceInput';
export type CaptureProps = { busy: boolean; blocked: boolean; onSave(kind: Kind, note: string): Promise<boolean> };
export function Capture({ busy, blocked, onSave }: CaptureProps) {
  const [kind, setKind] = useState<Kind>('meal');
  const [note, setNote] = useState('');
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const inFlight = useRef(false);
  const overLimit = note.length > 4000;
  useEffect(() => {
    if (!note.trim()) return;
    const preserve = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', preserve);
    return () => window.removeEventListener('beforeunload', preserve);
  }, [note]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || busy || blocked || recording || !note.trim() || overLimit) return;
    const submittedNote = note;
    inFlight.current = true; setSubmitting(true); setSaveError('');
    try {
      if (await onSave(kind, submittedNote)) setNote(current => current === submittedNote ? '' : current);
    } catch {
      setSaveError('Could not save your note. Your text is still here. Try again.');
    } finally {
      inFlight.current = false; setSubmitting(false);
    }
  }
  return <section className="capture-sheet" aria-labelledby="capture-heading">
    <div className="section-heading"><h2 id="capture-heading">What happened?</h2><span className="paper-tab" aria-hidden="true">Capture now, log later</span></div>
    <div className="kind-switch" role="group" aria-label="Note type">{(['meal', 'workout'] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} disabled={busy || submitting || recording} onClick={() => setKind(value)}>{value === 'meal' ? 'Meal' : 'Workout'}</button>)}</div>
    <form onSubmit={event => void submit(event)}>
      <VoiceInput label="Your note" value={note} onChange={setNote} onRecording={setRecording} disabled={busy} placeholder={kind === 'meal' ? 'Two eggs, toast, and a little rice…' : 'Squats: 3 sets of 5 at 60 kg, then a 20-minute run…'} />
      {overLimit && <p className="inline-error" role="alert">Keep your note within 4,000 characters. Your text is still here.</p>}
      {saveError && <p className="inline-error" role="alert">{saveError}</p>}
      <div className="capture-footer"><p className="muted small">Your original words are saved first.<br />Details can wait.</p><button type="submit" className="button primary" disabled={busy || submitting || blocked || recording || !note.trim() || overLimit}>{busy || submitting ? 'Saving…' : 'Save note'}</button></div>
      <p className="muted small">OpenAI processes saved note text and replies to prepare details.</p>
      {blocked && <p className="small">Save or discard your review changes before saving another note.</p>}
    </form>
  </section>;
}
