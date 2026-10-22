import { MAX_NOTE, extract, clarify, validateDetails } from './entries.ts';
import type { Entry, Kind } from './entries.ts';
import type { EntryStore } from './store.ts';
class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}
const fail = (status: number, message: string): never => { throw new HttpError(status, message); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function text(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.length > MAX_NOTE)
        return fail(400, `Write a note of 1–${MAX_NOTE} characters.`);
    return value.trim();
}
function keys(value: Record<string, unknown>, allowed: string[]) {
    if (Object.keys(value).some(key => !allowed.includes(key)))
        fail(400, 'Unknown request field.');
}
async function body(req: Request): Promise<Record<string, unknown>> {
    if (req.headers.get('origin') !== new URL(req.url).origin)
        fail(403, 'Please save from this app.');
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
        fail(415, 'JSON is required.');
    if (Number(req.headers.get('content-length')) > 100000)
        fail(413, 'This entry is too large.');
    const raw = await req.text();
    if (raw.length > 100000)
        fail(413, 'This entry is too large.');
    let data: unknown;
    try {
        data = JSON.parse(raw);
    }
    catch {
        return fail(400, 'Invalid JSON.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
        return fail(400, 'Invalid request.');
    return data as Record<string, unknown>;
}
function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } }); }
/** userId is supplied only by the server auth adapter, never client JSON or query params. */
export async function handleEntries(req: Request, userId: string | null, store: EntryStore): Promise<Response> {
    try {
        if (!userId)
            fail(401, 'Sign in to access your entries.');
        const owner = userId!;
        const path = new URL(req.url).pathname.replace(/\/$/, '');
        const id = path.slice('/api/entries'.length).replace(/^\//, '');
        if (id && !uuid.test(id))
            fail(404, 'Entry not found.');
        if (req.method === 'GET') {
            if (!id)
                return json({ entries: await store.list(owner) });
            const value = await store.get(owner, id);
            return value ? json({ entry: value }) : json({ error: 'Entry not found.' }, 404);
        }
        if (req.method === 'POST' && !id) {
            const data = await body(req);
            keys(data, ['id', 'kind', 'note']);
            if (typeof data.id !== 'string' || !uuid.test(data.id))
                fail(400, 'Invalid capture ID.');
            if (data.kind !== 'meal' && data.kind !== 'workout')
                fail(400, 'Choose meal or workout.');
            const note = text(data.note);
            const now = new Date().toISOString();
            const value: Entry = { id: data.id as string, kind: data.kind as Kind, note, originalNote: note, details: extract(data.kind as Kind, note), logged: false, version: 1, createdAt: now, updatedAt: now };
            if (await store.create(owner, value))
                return json({ entry: value }, 201);
            const existing = await store.get(owner, value.id);
            if (existing?.originalNote === note && existing.kind === value.kind)
                return json({ entry: existing });
            return fail(409, 'This capture ID is already used. Reload before making another entry.');
        }
        if (req.method === 'PATCH' && id) {
            const data = await body(req);
            keys(data, ['version', 'note', 'details', 'logged', 'clarification']);
            if (!Number.isSafeInteger(data.version) || (data.version as number) < 1)
                fail(400, 'An entry version is required.');
            const changes = ['note', 'details', 'logged', 'clarification'].filter(key => key in data);
            if (changes.length !== 1)
                fail(400, 'Update one part of the entry at a time.');
            const current = await store.get(owner, id);
            if (!current)
                return fail(404, 'Entry not found.');
            if (current.version !== data.version)
                fail(409, 'This entry changed in another tab. Reload it before saving.');
            const updated = { ...current, updatedAt: new Date().toISOString() };
            if ('note' in data) {
                updated.note = text(data.note);
                updated.details = extract(updated.kind, updated.note);
            }
            if ('logged' in data) {
                if (typeof data.logged !== 'boolean')
                    fail(400, 'Logged must be true or false.');
                updated.logged = data.logged as boolean;
            }
            try {
                if ('details' in data)
                    updated.details = validateDetails(data.details, updated.kind);
                if ('clarification' in data) {
                    const c = data.clarification as Record<string, unknown>;
                    if (!c || typeof c !== 'object' || Array.isArray(c))
                        fail(400, 'Invalid clarification.');
                    keys(c, ['index', 'field', 'value']);
                    if (!Number.isInteger(c.index) || typeof c.field !== 'string' || typeof c.value !== 'string' || c.value.length > MAX_NOTE)
                        fail(400, 'Invalid clarification.');
                    updated.details = validateDetails(clarify(updated.details, c.index as number, c.field as string, c.value as string), updated.kind);
                }
            }
            catch (error) {
                if (error instanceof HttpError)
                    throw error;
                fail(400, error instanceof Error ? error.message : 'Invalid details.');
            }
            if (!await store.update(owner, updated, current.version))
                fail(409, 'This entry changed in another tab. Reload it before saving.');
            return json({ entry: { ...updated, version: current.version + 1 } });
        }
        return json({ error: 'Method not allowed.' }, 405);
    }
    catch (error) {
        if (error instanceof HttpError)
            return json({ error: error.message }, error.status);
        // Do not expose SQL, user data, or provider diagnostics to the browser/logs.
        return json({ error: 'Could not access your entries. Your draft is still here. Try again.' }, 503);
    }
}
