import { describe, expect, it } from 'vitest';
import { resolvePublishableKey } from '../../supabase/functions/_shared/server/environment';

const environment = (values: Record<string,string>) => ({get:(name:string) => values[name]});
describe('Edge publishable key configuration', () => {
  it('reads the default public key from the platform JSON object first', () => {
    expect(resolvePublishableKey(environment({SUPABASE_PUBLISHABLE_KEYS:'{"default":"sb_publishable_platform","web":"sb_publishable_web"}',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_override',SUPABASE_ANON_KEY:'legacy-anon'}))).toBe('sb_publishable_platform');
  });
  it('supports explicitly configured singular and legacy public keys', () => {
    expect(resolvePublishableKey(environment({SUPABASE_PUBLISHABLE_KEY:'sb_publishable_override',SUPABASE_ANON_KEY:'legacy-anon'}))).toBe('sb_publishable_override');
    expect(resolvePublishableKey(environment({SUPABASE_ANON_KEY:'legacy-anon'}))).toBe('legacy-anon');
  });
  it.each(['{broken','null','[]','"key"','{}','{"default":42}','{"default":null}','{"default":""}','{"default":"  "}'])('handles unusable platform JSON %s without throwing', (value) => {
    expect(resolvePublishableKey(environment({SUPABASE_PUBLISHABLE_KEYS:value}))).toBeUndefined();
    expect(resolvePublishableKey(environment({SUPABASE_PUBLISHABLE_KEYS:value,SUPABASE_ANON_KEY:'legacy-anon'}))).toBe('legacy-anon');
  });
  it('returns no key for missing or empty configuration', () => {
    expect(resolvePublishableKey(environment({}))).toBeUndefined();
    expect(resolvePublishableKey(environment({SUPABASE_PUBLISHABLE_KEY:' ',SUPABASE_ANON_KEY:''}))).toBeUndefined();
  });
});
