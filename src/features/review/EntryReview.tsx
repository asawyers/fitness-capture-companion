import { useEffect, useRef, useState } from 'react';
import type { Detail, Entry, Message } from '@domain/contracts';
import { clarificationGroups, detailFields, detailLabel, formatEntry } from '@domain/entries';
import { VoiceInput } from '../capture/VoiceInput';
import { CircleCheck, Copy, Undo2 } from 'lucide-react';
import { KindIcon, Spinner, StatusIcon } from '../../components/Feedback';

export type EntryReviewProps = {
  entry: Entry; messages: Message[]; busy: boolean; analyzing?: boolean;
  saveDetails(details: Detail[]): Promise<boolean>; editNote(note: string): Promise<boolean>;
  setLogged(logged: boolean): Promise<boolean>; reply(content: string): Promise<boolean>;
  skipQuestion(): Promise<boolean>; analyze(): Promise<void>; onDirty(dirty: boolean): void;
};
const labels: Record<string, string> = { name: 'Food', amount: 'Amount', exercise: 'Exercise', sets: 'Sets', reps: 'Reps', weight: 'Weight', activity: 'Activity', duration: 'Duration', distance: 'Distance' };

export function EntryReview({ entry, messages, busy: externalBusy, analyzing = false, saveDetails, editNote, setLogged, reply, skipQuestion, analyze, onDirty }: EntryReviewProps) {
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [editing, setEditing] = useState<'details' | 'note' | null>(null);
  const [details, setDetails] = useState<Detail[]>(entry.details);
  const [note, setNote] = useState(entry.note);
  const [answer, setAnswer] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState('');
  const replyInFlight = useRef(false);
  const busy = externalBusy || replySubmitting;
  const [recording, setRecording] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [showCopy, setShowCopy] = useState(false);
  const [processingExpired, setProcessingExpired] = useState(false);
  const copyArea = useRef<HTMLTextAreaElement>(null);
  const dirty = editing === 'details' ? JSON.stringify(details) !== JSON.stringify(entry.details) : editing === 'note' ? note !== entry.note : false;
  useEffect(() => { onDirty(dirty || Boolean(answer.trim()) || recording || replySubmitting); }, [dirty, answer, recording, replySubmitting, onDirty]);
  useEffect(() => {
    if (!editing) { setDetails(entry.details); setNote(entry.note); }
    setCopyStatus(''); setShowCopy(false);
  }, [entry.version, entry.details, entry.note, editing]);
  useEffect(() => {
    if (!dirty && !answer.trim()) return;
    const preserve = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', preserve);
    return () => window.removeEventListener('beforeunload', preserve);
  }, [dirty, answer]);
  useEffect(() => {
    if (entry.analysisStatus !== 'processing') { setProcessingExpired(false); return; }
    const remaining = new Date(entry.updatedAt).getTime() + 60_000 - Date.now();
    setProcessingExpired(!Number.isFinite(remaining) || remaining <= 0);
    if (remaining > 0) {
      const timer = setTimeout(() => setProcessingExpired(true), remaining);
      return () => clearTimeout(timer);
    }
  }, [entry.analysisStatus, entry.updatedAt]);
  const savedText = formatEntry(entry);
  const clarification = clarificationGroups(entry.details);
  if (entry.pendingQuestion) {
    const anchor = entry.pendingQuestion;
    const index = clarification.findIndex(group => group.itemIndex === anchor.itemIndex && group.fields.includes(anchor.field));
    // Keep the compatibility target first, including an unnamed item needing identification.
    if (index < 0) clarification.unshift({ itemIndex: anchor.itemIndex, fields: [anchor.field], text: anchor.text });
    else if (index > 0) clarification.unshift(...clarification.splice(index, 1));
  }
  const batchQuestions = clarification.length > 1 || clarification.some(group => group.fields.length > 1);
  const blocked = busy || dirty || recording;
  function edit(mode: 'details' | 'note') { if (mode === 'note') setNoteExpanded(true); setDetails(entry.details); setNote(entry.note); setEditing(mode); setCopyStatus(''); setShowCopy(false); }
  function changeField(index: number, field: string, value: string) {
    setDetails(current => current.map((detail, position) => position === index ? { ...detail, [field]: value } as Detail : detail));
  }
  async function save() {
    if (editing === 'note' && note.length > 4000) return;
    const saved = editing === 'details' ? await saveDetails(details) : await editNote(note);
    if (saved) setEditing(null);
  }
  async function saveReply() {
    if (replyInFlight.current || busy || analyzing || recording || editing !== null || !entry.pendingQuestion || !answer.trim() || answer.length > 4000) return;
    replyInFlight.current = true; setReplySubmitting(true); setReplyError('');
    const submittedAnswer = answer;
    try {
      if (await reply(submittedAnswer)) setAnswer(current => current === submittedAnswer ? '' : current);
      else setReplyError('Your reply could not be saved. Your text is still here. Try again.');
    } catch {
      setReplyError('Your reply could not be saved. Your text is still here. Try again.');
    } finally {
      replyInFlight.current = false; setReplySubmitting(false);
    }
  }
  async function copy() {
    if (blocked) return;
    try { await navigator.clipboard.writeText(savedText); setCopyStatus('Copied. Mark logged when you’ve added it to your tracker.'); }
    catch { setShowCopy(true); setCopyStatus('Select and copy the saved text below.'); }
  }
  function add(type: Detail['type']) {
    const item: Detail = type === 'food' ? { type, name: '', amount: '' } : type === 'strength' ? { type, exercise: '', sets: '', reps: '', weight: '' } : { type, activity: '', duration: '', distance: '' };
    setDetails(current => current.length < 30 ? [...current, item] : current);
  }
  const editActions = <div className="edit-actions"><p className="small">{dirty ? 'Unsaved changes. Save or discard before copying or marking logged.' : 'Make your corrections, then save.'}</p><div className="button-row"><button type="button" className="button primary" disabled={busy || !dirty || (editing === 'note' && !note.trim())} onClick={() => void save()}>Save changes</button><button type="button" className="button subtle" disabled={busy} onClick={() => { setEditing(null); setDetails(entry.details); setNote(entry.note); }}>Discard changes</button></div></div>;
  return <section className="review-sheet" aria-labelledby="review-heading">
    <div className="section-heading"><div><p className="muted small">Saved <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></p>
      <h2 id="review-heading"><KindIcon kind={entry.kind} />Review your {entry.kind === 'meal' ? 'meal' : 'workout'}</h2></div><span className={`status-tag ${entry.logged ? 'logged' : ''}`}><StatusIcon status={entry.logged ? 'logged' : 'ready'} />{entry.logged ? 'Logged' : 'To log'}</span></div>
    <section className="review-details" aria-labelledby="details-heading">
    <div className="section-heading detail-heading"><h3 id="details-heading">Details to log</h3>{editing !== 'details' && <button type="button" className="text-button" disabled={busy || editing !== null || recording} onClick={() => edit('details')}>Edit details</button>}</div>
    {editing === 'details' ? <div className="details-editor">
      {details.map((detail, index) => <fieldset className="detail-editor" key={index}><legend>{detail.type === 'food' ? 'Food' : detail.type === 'strength' ? 'Strength' : 'Cardio'}</legend>
        <div className="detail-fields">{detailFields(detail).map(field => <label className="field-label" key={field}>{labels[field] ?? field}<input value={(detail as unknown as Record<string, string>)[field]} placeholder="Unknown" maxLength={500} disabled={busy} onChange={event => changeField(index, field, event.target.value)} /></label>)}</div>
        <button type="button" className="text-button" disabled={busy} onClick={() => setDetails(current => current.filter((_, position) => position !== index))}>Remove {detailLabel(detail) || 'item'}</button>
      </fieldset>)}
      <div className="button-row">{(entry.kind === 'meal' ? ['food'] as const : ['strength', 'cardio'] as const).map(type => <button type="button" key={type} className="button subtle" disabled={busy || details.length >= 30} onClick={() => add(type)}>Add {type}</button>)}</div>
    </div> : details.length > 0 ? <div className="detail-list">{details.map((detail, index) => <div className={`detail-row ${detail.type}`} key={index}><strong>{detailLabel(detail) || 'Unnamed item'}</strong><dl>{detailFields(detail).slice(1).map(field => <div key={field}><dt>{labels[field] ?? field}</dt><dd>{(detail as unknown as Record<string, string>)[field] || 'Unknown'}</dd></div>)}</dl></div>)}</div> : <p className="muted">No structured details yet. You can add them yourself.</p>}
    {editing === 'details' && editActions}
    </section>

    {!analyzing && !replySubmitting && ((entry.analysisStatus === 'processing' && !processingExpired) || busy) && <p className="muted small loading-state" role="status"><Spinner />Saving or preparing details… Your original note is saved.</p>}
    {(entry.analysisStatus === 'idle' || entry.analysisStatus === 'failed' || (entry.analysisStatus === 'processing' && processingExpired)) && <div className="analysis-retry"><p className="small">{entry.analysisStatus === 'processing' ? 'Details may have been interrupted. Your note is saved. You can retry now.' : entry.analysisStatus === 'failed' ? 'Details couldn’t be prepared. Your note is saved.' : 'Your note is saved. Prepare details when you’re ready.'}</p><button type="button" className="button subtle" disabled={blocked || editing !== null || Boolean(answer.trim())} onClick={() => void analyze()}>{entry.analysisStatus === 'idle' ? 'Prepare details' : 'Retry details'}</button></div>}

    {(entry.pendingQuestion || answer.trim() || recording || replySubmitting || analyzing) && <section className="question" aria-labelledby="question-heading"><p className="muted small">{entry.pendingQuestion ? 'Optional details' : analyzing ? 'Working on your saved entry' : 'Reply draft'}</p><h3 id="question-heading">{entry.pendingQuestion ? batchQuestions ? 'Add any missing details' : entry.pendingQuestion.text : (analyzing ? 'Preparing details' : 'Your unsaved reply')}</h3>
      {entry.pendingQuestion && batchQuestions && <><ol className="clarification-list">{clarification.map(group => <li key={`${group.itemIndex}:${group.fields.join(',')}`}>{group.text}</li>)}</ol><p className="small clarification-hint">Answer any or all in one reply. Include the food or exercise name and the fields you’re answering. Unknown details can stay blank.</p></>}
      {(replySubmitting || analyzing) && <p className="reply-progress loading-state" role="status"><Spinner />{replySubmitting ? 'Saving your reply…' : 'Preparing details… Your saved note and replies are safe.'}</p>}
      {!entry.pendingQuestion && !analyzing && !replySubmitting && <p className="small">This question is no longer open. Your draft is still here. Discard it when you’re ready to continue.</p>}
      {(entry.pendingQuestion || answer.trim() || recording) && <VoiceInput value={answer} onChange={setAnswer} label="Your reply" placeholder="Add what you remember…" compact disabled={busy || analyzing || editing !== null} onRecording={setRecording} onSubmit={() => void saveReply()} />}
      {answer.length > 4000 && <p className="inline-error" role="alert">Keep your reply within 4,000 characters. Your text is still here.</p>}
      {entry.pendingQuestion && <div className="button-row"><button type="button" className="button primary" disabled={busy || analyzing || recording || !answer.trim() || answer.length > 4000 || editing !== null} onClick={() => void saveReply()}>{(replySubmitting || analyzing) && <Spinner />}{replySubmitting ? 'Saving reply…' : analyzing ? 'Preparing details…' : 'Save reply'}</button><button type="button" className="button subtle" disabled={busy || analyzing || recording || Boolean(answer.trim()) || editing !== null} onClick={() => void skipQuestion()}>{batchQuestions ? 'Skip all' : 'Skip'}</button><span className="muted small">Enter to send · Shift+Enter for a new line.</span></div>}
      {replyError && <p className="inline-error" role="alert">{replyError}</p>}
      {answer.trim() && <button type="button" className="text-button discard-reply" disabled={busy || recording} onClick={() => setAnswer('')}>Discard reply</button>}
    </section>}

    <div className="saved-actions"><div className="button-row"><button type="button" className="button primary" disabled={blocked || Boolean(answer.trim())} onClick={() => void copy()}><Copy className="ui-icon" aria-hidden="true" size={16} />Copy saved text</button><button type="button" className="button outlined" disabled={blocked || Boolean(answer.trim())} onClick={() => void setLogged(!entry.logged)}>{entry.logged ? <Undo2 className="ui-icon" aria-hidden="true" size={16} /> : <CircleCheck className="ui-icon" aria-hidden="true" size={16} />}{entry.logged ? 'Undo logged' : 'Mark logged'}</button></div><p className="muted small">Copy into your usual tracker, then mark it logged.</p></div>
    {copyStatus && <p className={`small copy-feedback ${copyStatus.startsWith('Copied.') ? 'success' : ''}`} role="status">{copyStatus.startsWith('Copied.') && <StatusIcon status="ready" />}{copyStatus}</p>}
    {showCopy && <label className="field-label">Saved text to copy<textarea ref={copyArea} aria-label="Saved text to copy" className="copy-fallback" readOnly rows={7} value={savedText} onFocus={() => copyArea.current?.select()} /></label>}
    <details className="working-note" open={editing === 'note' || noteExpanded} onToggle={event => { if (editing === 'note' && !event.currentTarget.open) event.currentTarget.open = true; else setNoteExpanded(event.currentTarget.open); }}>
      <summary>Working note</summary>
      {editing === 'note' ? <label className="field-label">Working note<textarea aria-label="Working note" rows={4} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} /></label> : <><p className="note-text">{entry.note}</p><button type="button" className="text-button" disabled={busy || editing !== null || recording} onClick={() => edit('note')}>Edit note</button></>}
      {editing === 'note' && editActions}
    </details>
    <details className="original-note"><summary>Original note</summary><p className="note-text">{entry.originalNote}</p></details>
    <details className="conversation"><summary>Saved conversation <span className="muted">({messages.length})</span></summary>{messages.length ? <ol>{messages.map(message => <li key={message.id} className={`message ${message.role}`}><span className="message-author">{message.role === 'user' ? 'You' : 'Assistant'}</span><p>{message.content}</p></li>)}</ol> : <p className="muted small">Saved messages will appear here.</p>}</details>
  </section>;
}
