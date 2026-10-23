import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../_shared/server/auth.ts';
import { resolvePublishableKey } from '../_shared/server/environment.ts';
import { createFitnessAgent } from '../_shared/server/fitness-agent.ts';
import { createFitnessHandler } from '../_shared/server/handler.ts';
import { createRepository, type RepositoryClient } from '../_shared/server/repository.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const publishableKey = resolvePublishableKey(Deno.env) ?? '';
// Both a separately approved enable flag and key+model are required. No key is read by the browser.
const enabled = Deno.env.get('FITNESS_AI_ENABLED') === 'true';
const apiKey = enabled ? Deno.env.get('OPENAI_API_KEY') : undefined;
const model = enabled ? Deno.env.get('FITNESS_OPENAI_MODEL') : undefined;
const agent = apiKey && model ? createFitnessAgent(apiKey,model) : null;
function scopedClient(request: Request) {
  return createClient(url,publishableKey,{global:{headers:{Authorization:request.headers.get('Authorization') ?? ''}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
Deno.serve(createFitnessHandler({
  authenticate:(request) => authenticate(request,scopedClient(request)),
  repository:(request) => createRepository(scopedClient(request) as unknown as RepositoryClient),
  agent,
  allowedOrigin:Deno.env.get('FITNESS_ALLOWED_ORIGIN'),
}));
