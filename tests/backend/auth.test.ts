import { describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../supabase/functions/_shared/server/auth';

describe('caller authentication', () => {
  it('rejects absent or malformed bearer credentials before looking up a user', async () => {
    const getUser = vi.fn();
    expect(await authenticate(new Request('http://localhost'), {auth:{getUser}})).toBeNull();
    expect(await authenticate(new Request('http://localhost',{headers:{Authorization:'Basic test'}}), {auth:{getUser}})).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });
  it('verifies the bearer with Supabase Auth rather than trusting body or JWT claims', async () => {
    const getUser = vi.fn(async (_jwt:string) => ({data:{user:{id:'verified-owner'}},error:null}));
    expect(await authenticate(new Request('http://localhost',{headers:{Authorization:'Bearer opaque-token'}}), {auth:{getUser}})).toEqual({id:'verified-owner'});
    expect(getUser).toHaveBeenCalledWith('opaque-token');
  });
  it('rejects a token Supabase cannot validate', async () => {
    const getUser = async () => ({data:{user:null},error:{message:'invalid token'}});
    expect(await authenticate(new Request('http://localhost',{headers:{Authorization:'Bearer invalid'}}), {auth:{getUser}})).toBeNull();
  });
});
