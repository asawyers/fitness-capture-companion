'use client';
import { useState } from 'react';
import { detailFields, detailLabel, exportText, missingFields, MAX_NOTE } from '../lib/entries';
import type { Entry, Detail } from '../lib/entries';
const labels: Record<string, string> = { name: 'Food', amount: 'Serving amount', exercise: 'Exercise', sets: 'Sets', reps: 'Reps', weight: 'Weight (include unit)', activity: 'Activity', duration: 'Duration (include unit)', distance: 'Distance (include unit)' };
const examples: Record<string, string> = { amount: 'e.g. 1 cup', sets: 'e.g. 3', reps: 'e.g. 8', weight: 'e.g. 60 kg or bodyweight', duration: 'e.g. 20 min', distance: 'e.g. 3 km' };
export function EntryReview({ entry, busy, update, copy }: {
    entry: Entry;
    busy: boolean;
    update: (change: Record<string, unknown>) => Promise<boolean>;
    copy: () => void;
}) {
    const [details, setDetails] = useState<Detail[]>(entry.details.map(d => ({ ...d })));
    const [note, setNote] = useState(entry.note);
    const [editingNote, setEditingNote] = useState(false);
    const hasMissing = entry.details.some(d => missingFields(d).length > 0);
    const changed = JSON.stringify(details) !== JSON.stringify(entry.details);
    function change(index: number, field: string, value: string) { setDetails(old => old.map((d, i) => i === index ? { ...d, [field]: value } : d)); }
    return <section className="review panel" aria-labelledby="review-heading">
    <div className="section-heading"><h2 id="review-heading">{entry.kind === 'meal' ? 'Meal' : 'Workout'} details</h2><span className={entry.logged ? 'status logged' : 'status'}>{entry.logged ? 'Logged' : 'To log'}</span></div>
    <p className="review-note">{entry.note}</p>
    <div className="review-tools"><button className="text-button" onClick={() => { setNote(entry.note); setEditingNote(!editingNote); }} disabled={busy || changed}>{editingNote ? 'Cancel note edit' : 'Edit note'}</button><details className="original"><summary>Original capture</summary><p>{entry.originalNote}</p></details></div>
    {editingNote && <form className="note-edit" onSubmit={async (e) => { e.preventDefault(); await update({ note }); }}>
      <label htmlFor="edit-note">Edit saved note</label><textarea id="edit-note" value={note} onChange={e => setNote(e.target.value)} maxLength={MAX_NOTE} rows={4} required disabled={busy}/><p className="hint">Saving the note extracts its details again and replaces any serving or workout edits below. The original capture is kept.</p><button className="button secondary" disabled={busy || !note.trim() || note === entry.note}>Save edited note</button>
    </form>}
    <div className="details-intro"><h3>{hasMissing ? 'Fill in any gaps' : 'Review the breakdown'}</h3><p>{hasMissing ? 'These details are optional. Your note is already saved.' : 'Check the extracted details before logging elsewhere.'} Nothing is estimated.</p></div>
    <form onSubmit={async (e) => { e.preventDefault(); await update({ details }); }}>
      <fieldset disabled={busy || editingNote} className="detail-fieldset"><legend className="sr-only">Entry breakdown</legend>
        {details.map((detail, index) => <div className="detail-item" key={index}>
          <h4>{detailLabel(detail)}</h4>
          <div className={`detail-fields ${detail.type}`}>
            {(detailFields[detail.type] as readonly string[]).map((field, i) => <label key={field} className={i === 0 ? 'name-field' : ''} htmlFor={`${entry.id}-${index}-${field}`}>{labels[field]}{!String(detail[field as keyof typeof detail] ?? '') && <span className="optional">Optional</span>}<input id={`${entry.id}-${index}-${field}`} value={String(detail[field as keyof typeof detail] ?? '')} onChange={e => change(index, field, e.target.value)} placeholder={examples[field] || ''} maxLength={MAX_NOTE} required={i === 0}/></label>)}
          </div>
        </div>)}
        <button className="button secondary" disabled={!changed || busy}>Save details</button>
        {changed && <button className="text-button discard" type="button" onClick={() => setDetails(entry.details.map(d => ({ ...d })))}>Discard detail edits</button>}
      </fieldset>
    </form>
    <div className="export-area"><h3>Ready for your tracking app</h3><p>Copy the text, log it there, then mark it below.</p>
      {(changed || editingNote) && <p className="unsaved" role="status">Save or discard your edits before copying or marking as logged.</p>}
      <div className="export-buttons"><button className="button secondary" onClick={copy} disabled={busy || changed || editingNote}>Copy text</button></div>
      <details className="export-preview"><summary>View or select export text</summary><textarea readOnly value={exportText(entry)} aria-label="Export text" rows={7}/></details>
      <button className={entry.logged ? 'button secondary logged-action' : 'button primary logged-action'} onClick={() => void update({ logged: !entry.logged })} disabled={busy || changed || editingNote}>{entry.logged ? 'Move back to inbox' : 'Mark as logged'}</button>
    </div>
  </section>;
}
