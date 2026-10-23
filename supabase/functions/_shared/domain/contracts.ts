import { z } from 'zod';

const value = z.string().max(500);
export const KindSchema = z.enum(['meal', 'workout']);
export const DetailSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('food'), name: value, amount: value }),
  z.strictObject({ type: z.literal('strength'), exercise: value, sets: value, reps: value, weight: value }),
  z.strictObject({ type: z.literal('cardio'), activity: value, duration: value, distance: value }),
]);
export const QuestionSchema = z.strictObject({ itemIndex: z.number().int().min(0).max(29), field: z.string().min(1).max(30), text: z.string().min(1).max(300) });
export const EntrySchema = z.strictObject({
  id: z.uuid(), kind: KindSchema, originalNote: z.string().max(4000), note: z.string().max(4000),
  details: z.array(DetailSchema).max(30), pendingQuestion: QuestionSchema.nullable(),
  analysisStatus: z.enum(['idle', 'processing', 'ready', 'failed']), logged: z.boolean(),
  version: z.number().int().positive(), createdAt: z.string(), updatedAt: z.string(),
});
export const MessageSchema = z.strictObject({ id: z.uuid(), entryId: z.uuid(), role: z.enum(['user', 'assistant']), content: z.string().max(4000), sequence: z.number().int().positive(), createdAt: z.string() });
export const AnalysisRequestSchema = z.strictObject({ entryId: z.uuid(), requestId: z.uuid(), expectedVersion: z.number().int().positive() });
export const AnalysisResultSchema = z.strictObject({ details: z.array(DetailSchema).max(30), question: QuestionSchema.nullable(), reply: z.string().min(1).max(500) });
export type Kind = z.infer<typeof KindSchema>;
export type Detail = z.infer<typeof DetailSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type Message = z.infer<typeof MessageSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
