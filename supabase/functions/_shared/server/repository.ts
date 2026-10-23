import type { AnalysisRequest, AnalysisResult } from '../domain/contracts.ts';
import type { Repository, StoredEntry, StoredMessage } from './handler.ts';

// Structural client type keeps the request handler independent of the Deno/npm runtime.
type QueryResult = { data: unknown; error: unknown };
export type RepositoryClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult>;
  from(name: string): { select(fields: string): { eq(field: string, value: string): { order(field: string, options: {ascending:boolean}): { limit(count:number): PromiseLike<QueryResult> } } } };
};
export function createRepository(client: RepositoryClient): Repository {
  const args = (request: AnalysisRequest) => ({ p_entry_id: request.entryId, p_request_id: request.requestId, p_expected_version: request.expectedVersion });
  async function rpc(name: string, parameters: Record<string,unknown>) {
    const {data,error} = await client.rpc(name,parameters);
    if (error) throw error;
    return data;
  }
  return {
    claim: async (request) => await rpc('fitness_claim_analysis',args(request)) as {claimed:boolean;entry:StoredEntry},
    history: async (entryId) => {
      const {data,error} = await client.from('fitness_messages').select('role,content').eq('entry_id',entryId).order('sequence',{ascending:false}).limit(60);
      if (error) throw error;
      return (data as StoredMessage[]).reverse();
    },
    apply: async (request: AnalysisRequest, result: AnalysisResult) => await rpc('fitness_apply_analysis',{...args(request),p_result:result}) as StoredEntry,
    fail: async (request) => { await rpc('fitness_fail_analysis',args(request)); },
  };
}
