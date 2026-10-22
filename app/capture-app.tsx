'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { detailLabel, exportText, missingFields, MAX_NOTE } from '../lib/entries';
import type { Entry, Kind } from '../lib/entries';
import { EntryReview } from './entry-review';
import { useVoice } from './use-voice';
async function api<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options?.headers } });
    const data = await response.json().catch(() => ({ error: 'Could not reach the app. Your draft is still here. Try again.' }));
    if (!response.ok)
        throw new Error((data as {
            error?: string;
        }).error || 'Could not save. Try again.');
    return data as T;
}
const date = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export function CaptureApp() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [kind, setKind] = useState<Kind>('meal');
    const [note, setNote] = useState('');
    const [filter, setFilter] = useState<'inbox' | 'logged'>('inbox');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const pendingCapture = useRef<{
        key: string;
        id: string;
    } | null>(null);
    const voice = useVoice();
    const recording = voice.status !== 'idle';
    const refresh = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api<{
                entries: Entry[];
            }>('/api/entries');
            setEntries(data.entries);
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    const selected = entries.find(e => e.id === selectedId);
    const visible = entries.filter(e => filter === 'logged' ? e.logged : !e.logged);
    const count = entries.filter(e => !e.logged).length;
    function upsert(entry: Entry) { setEntries(old => [entry, ...old.filter(e => e.id !== entry.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
    async function save(event: React.FormEvent) {
        event.preventDefault();
        if (saving || recording || !note.trim())
            return;
        setError('');
        setMessage('');
        setSaving(true);
        const key = kind + '\0' + note;
        if (pendingCapture.current?.key !== key)
            pendingCapture.current = { key, id: crypto.randomUUID() };
        try {
            const data = await api<{
                entry: Entry;
            }>('/api/entries', { method: 'POST', body: JSON.stringify({ id: pendingCapture.current.id, kind, note }) });
            upsert(data.entry);
            setSelectedId(data.entry.id);
            setFilter('inbox');
            setNote('');
            pendingCapture.current = null;
            setMessage('Saved. Add optional details below, or come back later.');
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setSaving(false);
        }
    }
    async function update(entry: Entry, change: Record<string, unknown>): Promise<boolean> {
        if (updating)
            return false;
        setUpdating(true);
        setError('');
        setMessage('');
        try {
            const data = await api<{
                entry: Entry;
            }>(`/api/entries/${entry.id}`, { method: 'PATCH', body: JSON.stringify({ version: entry.version, ...change }) });
            upsert(data.entry);
            setMessage('logged' in change ? (change.logged ? 'Marked as logged.' : 'Moved back to the inbox.') : 'Changes saved to this entry.');
            return true;
        }
        catch (e) {
            setError((e as Error).message);
            return false;
        }
        finally {
            setUpdating(false);
        }
    }
    async function copy(entry: Entry) {
        setError('');
        try {
            await navigator.clipboard.writeText(exportText(entry));
            setMessage('Copied. The logged status has not changed.');
        }
        catch {
            setError('Clipboard access is unavailable. Select the export text below.');
        }
    }
    return <main>
    <div className="page-heading"><h1>A quick note for later.</h1><p>Save first. Fill in the details when you can.</p></div>
    <div className="feedback" aria-live="polite" role="status">{message}</div>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={() => void refresh()}>Reload entries</button></div>}
    <div className="workspace">
      <section className="capture panel" aria-labelledby="capture-heading">
        <div className="section-heading"><h2 id="capture-heading">Capture</h2><span className="private-label">Private to you</span></div>
        <form onSubmit={save}>
          <fieldset disabled={saving || recording} className="kind-picker"><legend className="sr-only">Entry type</legend>
            {(['meal', 'workout'] as const).map(value => <label className={kind === value ? 'chosen' : ''} key={value}><input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)}/><span aria-hidden="true">{value === 'meal' ? '◒' : '↗'}</span> {value === 'meal' ? 'Meal' : 'Workout'}</label>)}
          </fieldset>
          <label htmlFor="capture-note" className="input-label">{kind === 'meal' ? 'What did you eat?' : 'What did you do?'}</label>
          <textarea id="capture-note" value={note} onChange={e => setNote(e.target.value)} maxLength={MAX_NOTE} disabled={saving || recording} rows={5} placeholder={kind === 'meal' ? '2 eggs, 1 slice toast, avocado' : 'Squat 3x5 at 60 kg; Run 20 min 3 km'} required aria-describedby="capture-hint"/>
          <p id="capture-hint" className="hint">Separate foods or exercises with commas, semicolons, or new lines. Unknown quantities can wait.</p>
          <div className="capture-actions">
            <button className={recording ? 'button recording' : 'button secondary'} type="button" onClick={() => recording ? voice.stop() : voice.record(note, setNote)} disabled={saving || voice.supported === false || voice.supported === null} aria-pressed={recording}>{recording ? '■ Stop recording' : '● Record voice'}</button>
            <button className="button primary" disabled={saving || recording || !note.trim()}>{saving ? 'Saving…' : 'Save note'}</button>
          </div>
          <div className="voice-status" role="status" aria-live="polite">{recording ? (voice.status === 'starting' ? 'Starting microphone…' : 'Recording. Stop to review and edit the transcript.') : voice.supported === false ? 'Voice is unavailable in this browser. Text capture is ready.' : ''}</div>
          {voice.error && <p className="inline-error" role="alert">{voice.error}</p>}
          <p className="voice-disclosure">Voice uses your browser’s speech service, which may send audio to its provider. This app stores only the text you save. Review the transcript before saving.</p>
        </form>
      </section>
      <aside className="inbox panel" aria-labelledby="inbox-heading">
        <div className="section-heading"><h2 id="inbox-heading">Review inbox</h2><span className="count" aria-label={`${count} entries to log`}>{count}</span></div>
        <div className="inbox-tabs" role="group" aria-label="Entry status">
          <button aria-pressed={filter === 'inbox'} onClick={() => setFilter('inbox')}>To log</button><button aria-pressed={filter === 'logged'} onClick={() => setFilter('logged')}>Logged</button>
          <button className="refresh" onClick={() => void refresh()} disabled={loading} aria-label="Refresh entries">↻</button>
        </div>
        {loading ? <p className="empty">Loading your entries…</p> : visible.length === 0 ? <div className="empty"><span aria-hidden="true">{filter === 'logged' ? '✓' : '≋'}</span><p>{filter === 'logged' ? 'Nothing marked as logged yet.' : 'Your next note starts here.'}</p><small>{filter === 'logged' ? 'Copy an entry, then mark it as logged yourself.' : 'Save a meal or workout. It will be here when you’re ready.'}</small></div> :
            <ul className="entry-list">{visible.map(entry => {
                    const missing = entry.details.reduce((n, d) => n + missingFields(d).length, 0);
                    return <li key={entry.id}><button className={selectedId === entry.id ? 'entry-row selected' : 'entry-row'} aria-pressed={selectedId === entry.id} onClick={() => { setSelectedId(entry.id); setMessage(''); }}><span className={`entry-kind ${entry.kind}`}>{entry.kind === 'meal' ? 'Meal' : 'Workout'}</span><time dateTime={entry.createdAt}>{date(entry.createdAt)}</time><strong>{entry.details.map(detailLabel).join(', ') || entry.note}</strong><small>{entry.logged ? 'Marked as logged' : missing ? `${missing} optional ${missing === 1 ? 'detail' : 'details'} to add` : 'Ready to copy and log'} <span aria-hidden="true">↗</span></small></button></li>;
                })}</ul>}
      </aside>
      {selected && <EntryReview key={`${selected.id}-${selected.version}`} entry={selected} busy={updating} update={change => update(selected, change)} copy={() => void copy(selected)}/>}
    </div>
  </main>;
}
