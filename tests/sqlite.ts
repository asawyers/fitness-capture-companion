import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

/** Executes our production prepared SQL against real SQLite, using D1's small API shape. */
export function openDatabase(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entries'").get()) for (const file of readdirSync(new URL('../drizzle', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'));
  }
  return {
    close: () => db.close(),
    prepare(sql: string) {
      const statement = db.prepare(sql);
      let args: any[] = [];
      const bound = {
        bind(...values: any[]) { args = values; return bound; },
        async first() { return statement.get(...args) ?? null; },
        async all() { return { results: statement.all(...args) }; },
        async run() { const r = statement.run(...args); return { meta:{changes:Number(r.changes)} }; },
      };
      return bound;
    },
  };
}
