import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { EntryStore } from '../../../lib/store';
import { handleEntries } from '../../../lib/api';
export const dynamic = 'force-dynamic';

export async function route(request: Request): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return Response.json({error:'Sign in to access your entries.'},{status:401,headers:{'Cache-Control':'no-store'}});
  if (!env.DB) return Response.json({error:'Storage is unavailable. Keep your draft and try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
  return handleEntries(request,user.userId,new EntryStore(env.DB));
}
export const GET = route;
export const POST = route;
