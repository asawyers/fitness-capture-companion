import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const entries = sqliteTable('entries', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind', { enum: ['meal', 'workout'] }).notNull(),
    originalNote: text('original_note').notNull(),
    note: text('note').notNull(),
    details: text('details').notNull(),
    logged: integer('logged', { mode: 'boolean' }).notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
}, table => [index('entries_owner_created').on(table.userId, table.createdAt)]);
