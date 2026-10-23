type Environment = { get(name: string): string | undefined };
export function resolvePublishableKey(environment: Environment): string | undefined {
  let platformDefault: unknown;
  try {
    const keys: unknown = JSON.parse(environment.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    if (keys && typeof keys === 'object' && !Array.isArray(keys)) platformDefault = (keys as Record<string,unknown>).default;
  } catch { /* Older/local environments may only supply a compatibility key. */ }
  return [platformDefault, environment.get('SUPABASE_PUBLISHABLE_KEY'), environment.get('SUPABASE_ANON_KEY')]
    .find((key): key is string => typeof key === 'string' && key.trim().length > 0);
}
