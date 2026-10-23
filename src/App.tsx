import { useEffect, useRef, useState } from 'react';
import type { Entry } from '@domain/contracts';
import { useFitness } from './lib/use-fitness';
import { Capture } from './features/capture/Capture';
import { EntryReview } from './features/review/EntryReview';
import { CircleAlert, CircleCheck, Inbox, PencilLine, RefreshCw } from 'lucide-react';
import { KindIcon, Spinner, StatusIcon } from './components/Feedback';

function AuthForm({ fitness }: { fitness: ReturnType<typeof useFitness> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingUp, setSigningUp] = useState(false);
  return <main className="auth-layout"><div className="auth-intro"><div className="brand-mark" aria-hidden="true">f<span>.</span></div><h1>Fitness notebook</h1><p>Capture meals and workouts now.<br />Log the details when you have a moment.</p></div>
    <section className="auth-sheet"><h2>{signingUp ? 'Create your notebook' : 'Welcome back'}</h2><p className="muted">Your notes and conversations stay in your account.</p>
      {!fitness.configured ? <p role="status" className="setup-note">Sign-in needs the app’s Supabase connection. Follow the project setup guide to connect this local app.</p> : <form onSubmit={async event => { event.preventDefault(); if (signingUp) await fitness.signUp(email.trim(), password); else await fitness.signIn(email.trim(), password); }}>
        <label className="field-label">Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={fitness.busy} /></label>
        <label className="field-label">Password<input type="password" autoComplete={signingUp ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={event => setPassword(event.target.value)} disabled={fitness.busy} /></label>
        {fitness.error && <p className="inline-error" role="alert">{fitness.error}</p>}{fitness.notice && <p className="small" role="status">{fitness.notice}</p>}
        <button className="button primary auth-submit" type="submit" disabled={fitness.busy || !fitness.authReady}>{fitness.busy && <Spinner />}{fitness.busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}</button>
        <button className="text-button auth-mode" type="button" disabled={fitness.busy} onClick={() => setSigningUp(current => !current)}>{signingUp ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
      </form>}
    </section><p className="auth-footnote">A small place for meals, movement, and the details you remember.</p></main>;
}

function entryTitle(entry: Entry) { return entry.note.split('\n')[0] || (entry.kind === 'meal' ? 'Meal' : 'Workout'); }

function entryStatus(entry: Entry) {
  if (entry.logged) return 'Logged';
  if (entry.analysisStatus === 'processing') return 'Preparing details';
  if (entry.analysisStatus === 'failed' || entry.analysisStatus === 'idle') return 'Retry details';
  if (entry.pendingQuestion) return 'Optional detail';
  return 'Ready to copy';
}

function entryTone(entry: Entry) {
  if (entry.logged) return 'logged';
  if (entry.analysisStatus === 'processing') return 'processing';
  if (entry.analysisStatus === 'failed' || entry.analysisStatus === 'idle') return 'retry';
  return entry.pendingQuestion ? 'question' : 'ready';
}

function Notebook({ fitness }: { fitness: ReturnType<typeof useFitness> }) {
  const [filter, setFilter] = useState<'to-log' | 'logged'>('to-log');
  const [reviewDirty, setReviewDirty] = useState(false);
  const [captureRecording, setCaptureRecording] = useState(false);
  const [mobileView, setMobileView] = useState<'capture' | 'inbox' | 'review'>('capture');
  const inbox = useRef<HTMLElement>(null);
  const inboxScroll = useRef(0);
  const selectedEntryId = useRef<string | null>(null);
  const focusRequested = useRef(false);
  const reviewPanel = useRef<HTMLDivElement>(null);
  const navigationBlocked = fitness.busy || fitness.loading || reviewDirty || captureRecording;
  const visible = fitness.entries.filter(entry => entry.logged === (filter === 'logged'));
  const toLogCount = fitness.entries.filter(entry => !entry.logged).length;
  useEffect(() => {
    if (captureRecording) setMobileView('capture');
    else if (reviewDirty) setMobileView('review');
  }, [captureRecording, reviewDirty]);
  useEffect(() => {
    if (!focusRequested.current || fitness.loading) return;
    focusRequested.current = false;
    if (mobileView === 'inbox' && inbox.current) {
      inbox.current.scrollTop = inboxScroll.current;
      const row = Array.from(inbox.current.querySelectorAll<HTMLButtonElement>('[data-entry-id]')).find(button => button.dataset.entryId === selectedEntryId.current);
      (row ?? inbox.current.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
    }
    if (mobileView === 'capture') document.querySelector<HTMLTextAreaElement>('.capture-panel textarea')?.focus({ preventScroll: true });
    if (mobileView === 'review' && !fitness.loading) reviewPanel.current?.focus();
  }, [mobileView, fitness.loading]);
  function navigate(next: 'capture' | 'inbox') {
    if (navigationBlocked) return;
    if (mobileView === 'inbox') inboxScroll.current = inbox.current?.scrollTop ?? 0;
    focusRequested.current = true;
    setMobileView(next);
  }
  function openEntry(id: string) {
    if (navigationBlocked) return;
    inboxScroll.current = inbox.current?.scrollTop ?? 0;
    selectedEntryId.current = id;
    focusRequested.current = true;
    setMobileView('review');
    void fitness.select(id);
  }
  return <div className="notebook" data-mobile-view={mobileView}>
    <header className="app-header"><div className="brand"><span className="brand-mark" aria-hidden="true">f<span>.</span></span><h1>Fitness notebook</h1></div><div className="account"><span className="small muted">{fitness.user?.email}</span><button type="button" className="text-button" disabled={navigationBlocked} onClick={() => void fitness.signOut()}>Sign out</button></div></header>
    <nav className="mobile-navigation" aria-label="Notebook"><button type="button" aria-pressed={mobileView === 'capture'} disabled={navigationBlocked} onClick={() => navigate('capture')}><PencilLine className="ui-icon" aria-hidden="true" size={16} />Capture</button><button type="button" aria-pressed={mobileView !== 'capture'} disabled={navigationBlocked} onClick={() => navigate('inbox')}><Inbox className="ui-icon" aria-hidden="true" size={16} />Inbox <span>{toLogCount}</span></button></nav>
    {(fitness.error || fitness.notice) && <div className={`app-message ${fitness.error ? 'error' : ''}`} role={fitness.error ? 'alert' : 'status'}>{fitness.error ? <CircleAlert className="ui-icon" aria-hidden="true" size={18} /> : <CircleCheck className="ui-icon" aria-hidden="true" size={18} />}{fitness.error || fitness.notice}</div>}
    {reviewDirty && <p className="navigation-cue" role="status">Save or discard your review changes before navigating. Your draft is still here.</p>}
    {captureRecording && <p className="navigation-cue" role="status">Stop recording before navigating. Your capture stays here.</p>}
    <main className="notebook-grid"><div className="main-column">
      <div className="capture-panel"><Capture busy={fitness.busy} blocked={reviewDirty} onRecording={setCaptureRecording} onSave={async (kind, note) => { const saved = await fitness.capture(kind, note); if (saved) { focusRequested.current = true; setMobileView('review'); } return saved; }} /></div>
      <aside ref={inbox} className="inbox" aria-labelledby="inbox-heading"><div className="section-heading"><h2 id="inbox-heading">Your inbox</h2><button type="button" className="text-button" onClick={() => void fitness.refresh()} disabled={navigationBlocked}><RefreshCw className={`ui-icon ${fitness.loading ? 'loading-spinner' : ''}`} aria-hidden="true" size={14} />Refresh</button></div>
        <div className="inbox-tabs" role="group" aria-label="Inbox filter"><button type="button" aria-pressed={filter === 'to-log'} disabled={navigationBlocked} onClick={() => setFilter('to-log')}>To log <span>{toLogCount}</span></button><button type="button" aria-pressed={filter === 'logged'} disabled={navigationBlocked} onClick={() => setFilter('logged')}>Logged <span>{fitness.entries.length - toLogCount}</span></button></div>
        {fitness.loading ? <p className="muted small loading-state" role="status"><Spinner />Opening your notes…</p> : visible.length ? <ol className="inbox-list">{visible.map(entry => <li key={entry.id}><button type="button" className={`inbox-item ${fitness.selected?.entry.id === entry.id ? 'selected' : ''}`} aria-current={fitness.selected?.entry.id === entry.id ? 'true' : undefined} disabled={navigationBlocked} data-entry-id={entry.id} onClick={() => openEntry(entry.id)}><span className="inbox-meta"><span className={`kind-label kind-${entry.kind}`}><KindIcon kind={entry.kind} />{entry.kind === 'meal' ? 'Meal' : 'Workout'}</span><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></span><span className="inbox-title">{entryTitle(entry)}</span><span className={`entry-status status-${entryTone(entry)}`}><StatusIcon status={entryTone(entry)} />{entryStatus(entry)}</span></button></li>)}</ol> : <div className="empty-inbox"><span className="empty-inbox-icon" aria-hidden="true">{filter === 'logged' ? '📖' : '🌱'}</span><p>{filter === 'logged' ? 'Your logged notes will live here.' : 'A clear page.'}</p><p className="muted small">{filter === 'logged' ? 'Mark a note logged after adding it to your tracker.' : 'Save a meal or workout to get started.'}</p></div>}
      </aside>
    </div><div className="review-panel" ref={reviewPanel} tabIndex={-1} aria-label="Selected note">
      <button type="button" className="text-button back-to-inbox" disabled={navigationBlocked} onClick={() => navigate('inbox')}>Back to inbox</button>
      {fitness.selected ? <EntryReview key={fitness.selected.entry.id} {...fitness.selected} busy={fitness.busy || fitness.loading || captureRecording} saveDetails={fitness.saveDetails} editNote={fitness.editNote} setLogged={fitness.setLogged} reply={fitness.reply} skipQuestion={fitness.skipQuestion} analyze={fitness.analyze} onDirty={setReviewDirty} /> : <section className="review-placeholder"><h2>{fitness.loading ? 'Opening your note…' : 'Select a note'}</h2><p className="muted">Select a meal or workout from your inbox to review, copy, and mark logged.</p></section>}
    </div></main>
  </div>;
}

export default function App() {
  const fitness = useFitness();
  if (!fitness.authReady && fitness.configured) return <main className="loading-screen loading-state" role="status"><Spinner />Opening your notebook…</main>;
  return fitness.user ? <Notebook key={fitness.user.id} fitness={fitness} /> : <AuthForm fitness={fitness} />;
}
