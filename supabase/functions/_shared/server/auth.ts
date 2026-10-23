type AuthClient = { auth: { getUser(jwt: string): Promise<{ data: { user: {id:string} | null }; error: unknown }> } };
export async function authenticate(request: Request, client: AuthClient): Promise<{id:string} | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ') || header.length > 10000) return null;
  const { data, error } = await client.auth.getUser(header.slice(7));
  return error || !data.user ? null : {id:data.user.id};
}
