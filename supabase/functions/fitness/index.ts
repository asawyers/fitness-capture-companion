import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../_shared/server/auth.ts';
import { resolvePublishableKey } from '../_shared/server/environment.ts';
import { createFitnessAgent } from '../_shared/server/fitness-agent.ts';
import { createFitnessHandler } from '../_shared/server/handler.ts';
import { createRepository, type RepositoryClient } from '../_shared/server/repository.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const publishableKey = resolvePublishableKey(Deno.env) ?? '';
// Nonsecret settings live in source; only the OpenAI credential is a secret.
const settings = {
  enabled: true,
  model: 'gpt-4.1-mini',
  allowedOrigins: [
    'https://fitness-capture-companion.vercel.app',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5179',
  ],
} as const;
const apiKey = settings.enabled ? Deno.env.get('OPENAI_API_KEY') : undefined;
const agent = apiKey ? createFitnessAgent(apiKey,settings.model) : null;
function scopedClient(request: Request) {
  return createClient(url,publishableKey,{global:{headers:{Authorization:request.headers.get('Authorization') ?? ''}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
Deno.serve(createFitnessHandler({
  authenticate:(request) => authenticate(request,scopedClient(request)),
  repository:(request) => createRepository(scopedClient(request) as unknown as RepositoryClient),
  agent,
  allowedOrigins:settings.allowedOrigins,
}));
