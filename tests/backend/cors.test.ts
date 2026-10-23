import { describe, expect, it, vi } from 'vitest';
import { createFitnessHandler } from '../../supabase/functions/_shared/server/handler';

const allowedOrigins = ['https://fitness-capture-companion.vercel.app', 'http://127.0.0.1:5173', 'http://127.0.0.1:5179'];
function setup() {
  const authenticate = vi.fn(async () => null);
  const repository = vi.fn();
  const agent = vi.fn();
  return {authenticate, repository, agent, handler:createFitnessHandler({authenticate,repository,agent,allowedOrigins})};
}
describe('fitness browser origins', () => {
  it.each(allowedOrigins)('permits %s while still requiring verified user authentication', async (origin) => {
    const {handler, authenticate, repository, agent} = setup();
    const response = await handler(new Request('https://edge.example/fitness',{method:'POST',headers:{Origin:origin}}));
    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('Vary')).toBe('Origin');
    expect(authenticate).toHaveBeenCalledOnce();
    expect(repository).not.toHaveBeenCalled(); expect(agent).not.toHaveBeenCalled();
  });
  it.each(['https://untrusted.example','https://fitness-capture-companion.vercel.app.untrusted.example','http://127.0.0.1:5180','null'])('rejects %s before data or AI access', async (origin) => {
    const {handler,authenticate,repository,agent} = setup();
    const response = await handler(new Request('https://edge.example/fitness',{method:'POST',headers:{Origin:origin}}));
    expect(response.status).toBe(403); expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    expect(authenticate).not.toHaveBeenCalled(); expect(repository).not.toHaveBeenCalled(); expect(agent).not.toHaveBeenCalled();
  });
  it.each(allowedOrigins)('answers preflight for %s without authentication or AI', async (origin) => {
    const {handler,authenticate,repository,agent} = setup();
    const response = await handler(new Request('https://edge.example/fitness',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'}}));
    expect(response.status).toBe(204); expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
    expect(authenticate).not.toHaveBeenCalled(); expect(repository).not.toHaveBeenCalled(); expect(agent).not.toHaveBeenCalled();
  });
  it('rejects preflight for an untrusted origin', async () => {
    const {handler,authenticate} = setup();
    const response = await handler(new Request('https://edge.example/fitness',{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}}));
    expect(response.status).toBe(403); expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false); expect(authenticate).not.toHaveBeenCalled();
  });
});
