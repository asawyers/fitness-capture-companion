import { useState } from 'react';
import type { Entry } from '@domain/contracts';
import { useFitness } from './lib/use-fitness';
import { Capture } from './features/capture/Capture';
import { EntryReview } from './features/review/EntryReview';

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
        <button className="button primary auth-submit" type="submit" disabled={fitness.busy || !fitness.authReady}>{fitness.busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}</button>
        <button className="text-button auth-mode" type="button" disabled={fitness.busy} onClick={() => setSigningUp(current => !current)}>{signingUp ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
      </form>}
    </section><p className="auth-footnote">A small place for meals, movement, and the details you remember.</p></main>;
}

function entryTitle(entry: Entry) { return entry.note.split('\n')[0] || (entry.kind === 'meal' ? 'Meal' : 'Workout'); }

function Notebook({ fitness }: { fitness: ReturnType<typeof useFitness> }) {
  const [filter, setFilter] = useState<'to-log' | 'logged'>('to-log');
  const [reviewDirty, setReviewDirty] = useState(false);
  const visible = fitness.entries.filter(entry => entry.logged === (filter === 'logged'));
  return <div className="notebook">
    <header className="app-header"><div className="brand"><span className="brand-mark" aria-hidden="true">f<span>.</span></span><div><h1>Fitness notebook</h1><p>Capture now. Log when you’re ready.</p></div></div><div className="account"><span className="small muted">{fitness.user?.email}</span><button type="button" className="text-button" disabled={fitness.busy} onClick={() => void fitness.signOut()}>Sign out</button></div></header>
    {(fitness.error || fitness.notice) && <div className={`app-message ${fitness.error ? 'error' : ''}`} role={fitness.error ? 'alert' : 'status'}>{fitness.error || fitness.notice}</div>}
    <main className="notebook-grid"><div className="main-column">
      <Capture busy={fitness.busy} blocked={reviewDirty} onSave={fitness.capture} />
      {fitness.selected && <EntryReview key={fitness.selected.entry.id} {...fitness.selected} busy={fitness.busy} saveDetails={fitness.saveDetails} editNote={fitness.editNote} setLogged={fitness.setLogged} reply={fitness.reply} skipQuestion={fitness.skipQuestion} analyze={fitness.analyze} onDirty={setReviewDirty} />}
    </div><aside className="inbox" aria-labelledby="inbox-heading"><div className="section-heading"><h2 id="inbox-heading">Your inbox</h2><button type="button" className="text-button" onClick={() => void fitness.refresh()} disabled={fitness.busy || fitness.loading || reviewDirty}>Refresh</button></div>
      <div className="inbox-tabs" role="group" aria-label="Inbox filter"><button type="button" aria-pressed={filter === 'to-log'} onClick={() => setFilter('to-log')}>To log <span>{fitness.entries.filter(entry => !entry.logged).length}</span></button><button type="button" aria-pressed={filter === 'logged'} onClick={() => setFilter('logged')}>Logged <span>{fitness.entries.filter(entry => entry.logged).length}</span></button></div>
      {fitness.loading ? <p className="muted small" role="status">Opening your notes…</p> : visible.length ? <ol className="inbox-list">{visible.map(entry => <li key={entry.id}><button type="button" className={`inbox-item ${fitness.selected?.entry.id === entry.id ? 'selected' : ''}`} aria-current={fitness.selected?.entry.id === entry.id ? 'true' : undefined} disabled={fitness.busy || reviewDirty} onClick={() => void fitness.select(entry.id)}><span className="inbox-meta">{entry.kind === 'meal' ? 'Meal' : 'Workout'}<time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></span><span className="inbox-title">{entryTitle(entry)}</span><span className="muted small">{entry.analysisStatus === 'processing' ? 'Preparing details…' : entry.pendingQuestion ? 'One optional detail' : entry.analysisStatus === 'failed' ? 'Note saved · details need a retry' : 'Open to review'}</span></button></li>)}</ol> : <div className="empty-inbox"><span aria-hidden="true">✓</span><p>{filter === 'logged' ? 'Your logged notes will live here.' : 'A clear page.'}</p><p className="muted small">{filter === 'logged' ? 'Mark a note logged after adding it to your tracker.' : 'Save a meal or workout. It will be here when you’re ready to log.'}</p></div>}
      {reviewDirty && <p className="small inbox-cue">Save or discard your changes before opening another note.</p>}
    </aside></main><footer className="app-footer">Just your words, a little structure, and room to remember.</footer>
  </div>;
}

export default function App() {
  const fitness = useFitness();
  if (!fitness.authReady && fitness.configured) return <main className="loading-screen" role="status">Opening your notebook…</main>;
  return fitness.user ? <Notebook key={fitness.user.id} fitness={fitness} /> : <AuthForm fitness={fitness} />;
}
