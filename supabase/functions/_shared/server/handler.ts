import { AnalysisRequestSchema, AnalysisResultSchema, type AnalysisRequest, type AnalysisResult } from '../domain/contracts.ts';
import { failureDiagnostic, type FailureDiagnostic, type FailurePhase } from './diagnostics.ts';
import { detailLabel, missingFields } from '../domain/entries.ts';

export type StoredEntry = { id: string; kind: string; note: string; details: unknown[]; pending_question: unknown; version: number; [key: string]: unknown };
export type StoredMessage = { role: 'user' | 'assistant'; content: string };
export interface Repository {
  claim(request: AnalysisRequest): Promise<{ claimed: boolean; entry: StoredEntry }>;
  history(entryId: string): Promise<StoredMessage[]>;
  apply(request: AnalysisRequest, result: AnalysisResult): Promise<StoredEntry>;
  fail(request: AnalysisRequest): Promise<void>;
}
export type AgentInput = { entry: StoredEntry; messages: StoredMessage[] };
export type FitnessAgent = (input: AgentInput, signal: AbortSignal) => Promise<unknown>;
type Dependencies = {
  authenticate(request: Request): Promise<{ id: string } | null>;
  repository(request: Request): Repository;
  agent: FitnessAgent | null;
  allowedOrigins?: readonly string[];
  timeoutMs?: number;
  reportFailure?: (diagnostic: FailureDiagnostic) => void;
};
export function createFitnessHandler(dependencies: Dependencies) {
  const allowedOrigins = new Set(dependencies.allowedOrigins ?? []);
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const cors: Record<string,string> = origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } });
    if (origin && !allowedOrigins.has(origin)) return respond(403, { error: 'origin_forbidden' });
    if (request.method === 'OPTIONS') return new Response(null, {status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'}});
    if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' });
    let user;
    try { user = await dependencies.authenticate(request); } catch { user = null; }
    if (!user) return respond(401, { error: 'unauthorized' });
    if (!dependencies.agent) return respond(503, { error: 'analysis_disabled' });
    if (!request.headers.get('Content-Type')?.includes('application/json')) return respond(400, {error:'invalid_request'});
    let body: AnalysisRequest;
    try {
      const raw = await request.text();
      if (raw.length > 2000) return respond(400, { error: 'invalid_request' });
      body = AnalysisRequestSchema.parse(JSON.parse(raw));
    } catch { return respond(400, { error: 'invalid_request' }); }
    const repository = dependencies.repository(request);
    let claimed = false;
    let phase: FailurePhase = 'claim';
    try {
      const claim = await repository.claim(body);
      if (!claim.claimed) return respond(200, { entry: claim.entry, duplicate: true });
      claimed = true;
      phase = 'history';
      const messages = await repository.history(body.entryId);
      const signal = AbortSignal.timeout(dependencies.timeoutMs ?? 20000);
      const timeout = new Promise<never>((_,reject) => signal.addEventListener('abort',() => reject(new DOMException('Analysis timed out','TimeoutError')),{once:true}));
      phase = 'agent';
      const output = await Promise.race([dependencies.agent({ entry: claim.entry, messages }, signal), timeout]);
      phase = 'schema';
      const result = AnalysisResultSchema.parse(output);
      phase = 'validation';
      validateResult(claim.entry, messages, result);
      phase = 'apply';
      const entry = await repository.apply(body, result);
      return respond(200, { entry, duplicate: false });
    } catch (error) {
      const diagnostic = failureDiagnostic(phase,error);
      try { (dependencies.reportFailure ?? ((safe) => console.warn('fitness_analysis_failure',safe)))(diagnostic); } catch { /* Diagnostics must not change the failure response. */ }
      if (claimed) { try { await repository.fail(body); } catch { /* A stale result must never modify a newer version. */ } }
      const conflict = typeof error === 'object' && error !== null && 'code' in error && (error.code === '40001' || error.code === 'PT409');
      return respond(conflict ? 409 : 502, { error: conflict ? 'conflict' : 'analysis_failed', diagnostic });
    }
  };
}

function validateResult(entry: StoredEntry, messages: StoredMessage[], result: AnalysisResult): void {
  if (result.details.some((detail) => entry.kind === 'meal' ? detail.type !== 'food' : detail.type === 'food')) throw new Error('Wrong detail kind');
  const evidence = [entry.note, ...messages.filter((message) => message.role === 'user').map((message) => message.content), ...entry.details.flatMap((item) => Object.entries(item as Record<string,unknown>).filter(([key]) => key !== 'type').map(([,value]) => String(value)))].join('\n').toLocaleLowerCase();
  for (const detail of result.details) {
    for (const [key,value] of Object.entries(detail)) {
      if (key !== 'type' && value && !evidence.includes(value.toLocaleLowerCase())) throw new Error('Unstated detail');
    }
  }
  if (!result.question) {
    const itemIndex = result.details.findIndex((detail) => detailLabel(detail).trim() && missingFields(detail).length > 0);
    if (itemIndex >= 0) result.question = { itemIndex, field: missingFields(result.details[itemIndex])[0], text: 'What quantity did you record?' };
  }
  if (result.question) {
    const {itemIndex, field} = result.question;
    const item = result.details[itemIndex];
    if (!item || field === 'type' || !(field in item) || (item as unknown as Record<string,string>)[field] !== '') throw new Error('Invalid clarification target');
    const label = item.type === 'food' ? item.name : item.type === 'strength' ? item.exercise : item.activity;
    const labels: Record<string,string> = {name:'food',amount:'amount',exercise:'exercise',sets:'number of sets',reps:'reps per set',weight:'weight',activity:'activity',duration:'duration',distance:'distance'};
    result.question.text = `What ${labels[field]} did you record${label ? ` for ${label}` : ''}?`;
    result.reply = result.question.text;
  } else {
    result.reply = 'Saved the details you provided.';
  }
}
