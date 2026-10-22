import type { Entry, Kind } from './entries.ts';
// The production D1 binding and the real-SQLite test adapter share this interface.
export interface Database {
    prepare(sql: string): {
        bind(...values: (string | number)[]): {
            first(): Promise<unknown>;
            all(): Promise<{
                results: unknown[];
            }>;
            run(): Promise<{
                meta: {
                    changes?: number;
                };
            }>;
        };
    };
}
type Row = {
    id: string;
    kind: Kind;
    original_note: string;
    note: string;
    details: string;
    logged: number;
    version: number;
    created_at: string;
    updated_at: string;
};
function entry(row: unknown): Entry | null {
    if (!row)
        return null;
    const r = row as Row;
    return { id: r.id, kind: r.kind, originalNote: r.original_note, note: r.note, details: JSON.parse(r.details), logged: !!r.logged, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at };
}
export class EntryStore {
    private db: Database;
    constructor(db: Database) { this.db = db; }
    async list(owner: string): Promise<Entry[]> {
        const rows = await this.db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC, id DESC').bind(owner).all();
        return rows.results.map(row => entry(row)!);
    }
    async get(owner: string, id: string): Promise<Entry | null> {
        return entry(await this.db.prepare('SELECT * FROM entries WHERE user_id = ? AND id = ?').bind(owner, id).first());
    }
    async create(owner: string, value: Entry): Promise<boolean> {
        const result = await this.db.prepare('INSERT INTO entries (id,user_id,kind,original_note,note,details,logged,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
            .bind(value.id, owner, value.kind, value.originalNote, value.note, JSON.stringify(value.details), 0, 1, value.createdAt, value.updatedAt).run();
        return result.meta.changes === 1;
    }
    async update(owner: string, value: Entry, previousVersion: number): Promise<boolean> {
        const result = await this.db.prepare('UPDATE entries SET note = ?, details = ?, logged = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND id = ? AND version = ?')
            .bind(value.note, JSON.stringify(value.details), value.logged ? 1 : 0, value.updatedAt, owner, value.id, previousVersion).run();
        return result.meta.changes === 1;
    }
}
