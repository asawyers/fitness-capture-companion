import { describe, expect, it, vi } from 'vitest';
import { createFitnessHandler, type AgentInput, type Repository } from '../../supabase/functions/_shared/server/handler';

const id = '11111111-1111-4111-8111-111111111111';
const request = () => new Request('http://localhost/fitness', { method: 'POST', headers: { Authorization: 'Bearer user', 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId: id, requestId: id, expectedVersion: 2 }) });
function setup() {
  const entry = { id, kind: 'meal', original_note: 'rice', note: 'rice', details: [{ type: 'food', name: 'rice', amount: '' }], pending_question: {itemIndex:0, field:'amount',text:'How much rice?'}, analysis_status: 'processing', logged: true, version: 2 };
  const messages = [{ role: 'user', content: 'rice' }, {role:'assistant',content:'How much rice?'}, {role:'user',content:'one cup'}];
  const repository = { claim: vi.fn(async () => ({ claimed: true, entry })), history: vi.fn(async () => messages), apply: vi.fn(async () => ({ ...entry, version: 3 })), fail: vi.fn(async () => undefined) } as unknown as Repository;
  const agent = vi.fn(async (_input:AgentInput) => ({ details: [{ type: 'food', name: 'rice', amount: 'one cup' }], question: null, reply: 'Saved the amount.' }));
  return { repository, agent, entry };
}
describe('fitness edge boundary', () => {
  it('never calls a repository or paid agent without a verified user', async () => {
    const { repository, agent } = setup();
    const handler = createFitnessHandler({ authenticate: async () => null, agent, repository: () => repository });
    expect((await handler(request())).status).toBe(401);
    expect(repository.claim).not.toHaveBeenCalled(); expect(agent).not.toHaveBeenCalled();
  });
  it('stays disabled without a configured separately approved agent', async () => {
    const { repository } = setup();
    const handler = createFitnessHandler({ authenticate: async () => ({ id }), agent: null, repository: () => repository });
    expect((await handler(request())).status).toBe(503); expect(repository.claim).not.toHaveBeenCalled();
  });
  it('passes persisted clarification history to one agent and applies to the same version and entry', async () => {
    const { repository, agent } = setup();
    const response = await createFitnessHandler({ authenticate: async () => ({ id }), agent, repository: () => repository })(request());
    expect(response.status).toBe(200);
    expect(agent).toHaveBeenCalledOnce();
    expect(agent.mock.calls[0][0].messages.at(-1)!.content).toBe('one cup');
    expect(repository.apply).toHaveBeenCalledWith(expect.objectContaining({entryId:id,expectedVersion:2}), expect.objectContaining({question:null}));
  });
  it('deduplicates before invoking the agent', async () => {
    const { repository, agent, entry } = setup();
    vi.mocked(repository.claim).mockResolvedValue({claimed:false,entry});
    const response = await createFitnessHandler({ authenticate: async () => ({ id }), agent, repository: () => repository })(request());
    expect(await response.json()).toEqual({entry,duplicate:true}); expect(agent).not.toHaveBeenCalled();
  });
  it.each(['invalid', 'refusal', 'timeout'])('keeps source data when model %s fails', async (failure) => {
    const { repository } = setup();
    const agent = async () => { if (failure === 'invalid') return { details: [{type:'food',name:'rice',amount:'one cup',calories:300}],question:null,reply:'ok' }; throw new Error(failure); };
    const response = await createFitnessHandler({ authenticate: async () => ({ id }), agent, repository: () => repository })(request());
    expect(response.status).toBe(502); expect(repository.fail).toHaveBeenCalledOnce(); expect(repository.apply).not.toHaveBeenCalled();
  });
  it.each(['40001','PT409'])('rejects a stale %s result without overwriting a user edit', async (code) => {
    const { repository, agent } = setup();
    vi.mocked(repository.apply).mockRejectedValue(Object.assign(new Error('conflict'), {code}));
    expect((await createFitnessHandler({ authenticate: async () => ({ id }), agent, repository: () => repository })(request())).status).toBe(409);
  });
  it('rejects foods and portions absent from user text and saved details', async () => {
    const {repository} = setup();
    const agent = async () => ({details:[{type:'food',name:'rice',amount:'200 grams'}],question:null,reply:'Great meal.'});
    expect((await createFitnessHandler({authenticate:async () => ({id}),agent,repository:() => repository})(request())).status).toBe(502);
    expect(repository.apply).not.toHaveBeenCalled();
  });
  it('bounds an agent which never returns, leaving the saved entry intact', async () => {
    const {repository} = setup();
    const agent = () => new Promise(() => {});
    expect((await createFitnessHandler({authenticate:async () => ({id}),agent,repository:() => repository,timeoutMs:5})(request())).status).toBe(502);
    expect(repository.fail).toHaveBeenCalledOnce(); expect(repository.apply).not.toHaveBeenCalled();
  }, 100);
});
