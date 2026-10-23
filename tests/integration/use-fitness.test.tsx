// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Entry } from '../../supabase/functions/_shared/domain/contracts';
import type { SavedConversation } from '../../src/lib/repository';
import { useFitness } from '../../src/lib/use-fitness';

const mocks = vi.hoisted(() => ({
  repo: { list: vi.fn(), load: vi.fn(), create: vi.fn(), reply: vi.fn(), save: vi.fn() },
  auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn() },
  analyze: vi.fn(),
}));
vi.mock('../../src/lib/supabase', () => ({ configured: true, supabase: { auth: mocks.auth } }));
vi.mock('../../src/lib/repository', () => ({ createRepository: () => mocks.repo }));
vi.mock('../../src/lib/fitness-api', () => ({ analyzeEntry: mocks.analyze }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function entry(number: number, overrides: Partial<Entry> = {}): Entry {
  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    kind: 'meal', originalNote: 'rice', note: 'rice', details: [], pendingQuestion: null,
    analysisStatus: 'idle', logged: false, version: 1,
    createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z', ...overrides,
  };
}
const conversation = (value: Entry): SavedConversation => ({ entry: value, messages: [] });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_FITNESS_API_URL', '');
  mocks.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'account-one', email: 'one@example.test' } } }, error: null });
  mocks.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.repo.list.mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

async function signedIn() {
  const hook = renderHook(() => useFitness());
  await waitFor(() => {
    expect(hook.result.current.user?.id).toBe('account-one');
    expect(mocks.repo.list).toHaveBeenCalledOnce();
    expect(hook.result.current.loading).toBe(false);
  });
  return hook;
}

test('a delayed refresh cannot erase a capture saved after its list read started', async () => {
  const { result } = await signedIn();
  const staleList = deferred<Entry[]>();
  mocks.repo.list.mockReturnValueOnce(staleList.promise);
  let refreshing!: Promise<void>;
  act(() => { refreshing = result.current.refresh(); });

  const saved = entry(1);
  mocks.repo.create.mockResolvedValueOnce(saved);
  mocks.repo.load.mockResolvedValueOnce(conversation(saved));
  await act(async () => { expect(await result.current.capture('meal', saved.note)).toBe(true); });
  expect(result.current.entries).toEqual([saved]);

  await act(async () => { staleList.resolve([]); await refreshing; });
  expect(result.current.entries).toEqual([saved]);
  expect(result.current.selected?.entry.id).toBe(saved.id);
  expect(result.current.loading).toBe(false);
});

test('a mutation invalidates an earlier selection without leaving the inbox loading', async () => {
  const { result } = await signedIn();
  const first = entry(1);
  const other = entry(2);
  mocks.repo.load.mockResolvedValueOnce(conversation(first));
  await act(async () => { await result.current.select(first.id); });

  const delayedSelection = deferred<SavedConversation>();
  mocks.repo.load.mockReturnValueOnce(delayedSelection.promise);
  let selecting!: Promise<void>;
  act(() => { selecting = result.current.select(other.id); });
  expect(result.current.loading).toBe(true);

  const saved = { ...first, version: 2, logged: true };
  mocks.repo.save.mockResolvedValueOnce(saved);
  mocks.repo.load.mockResolvedValueOnce(conversation(saved));
  await act(async () => { expect(await result.current.setLogged(true)).toBe(true); });
  expect(result.current.loading).toBe(false);
  expect(result.current.selected?.entry).toEqual(saved);

  await act(async () => { delayedSelection.resolve(conversation(other)); await selecting; });
  expect(result.current.loading).toBe(false);
  expect(result.current.selected?.entry).toEqual(saved);
});

test('capture keeps busy until its saved conversation is selected and loads it only once', async () => {
  const { result } = await signedIn();
  const previous = entry(1);
  mocks.repo.load.mockResolvedValueOnce(conversation(previous));
  await act(async () => { await result.current.select(previous.id); });
  mocks.repo.load.mockClear();

  const saved = entry(2);
  const savedConversation = deferred<SavedConversation>();
  mocks.repo.create.mockResolvedValueOnce(saved);
  mocks.repo.load.mockReturnValueOnce(savedConversation.promise);
  let capturing!: Promise<boolean>;
  await act(async () => { capturing = result.current.capture('meal', saved.note); });
  expect(mocks.repo.load).toHaveBeenCalledExactlyOnceWith(saved.id);
  expect(result.current.busy).toBe(true);
  expect(result.current.selected?.entry.id).toBe(previous.id);

  await act(async () => { savedConversation.resolve(conversation(saved)); expect(await capturing).toBe(true); });
  expect(result.current.selected?.entry.id).toBe(saved.id);
  expect(result.current.busy).toBe(false);
  expect(mocks.repo.load).toHaveBeenCalledExactlyOnceWith(saved.id);
  expect(mocks.analyze).not.toHaveBeenCalled();
});

test('a capture conversation arriving late cannot replace a newer explicit selection', async () => {
  const { result } = await signedIn();
  const saved = entry(1);
  const other = entry(2);
  const delayedCapture = deferred<SavedConversation>();
  mocks.repo.create.mockResolvedValueOnce(saved);
  mocks.repo.load.mockReturnValueOnce(delayedCapture.promise);
  let capturing!: Promise<boolean>;
  await act(async () => { capturing = result.current.capture('meal', saved.note); });
  expect(result.current.busy).toBe(true);

  mocks.repo.load.mockResolvedValueOnce(conversation(other));
  await act(async () => { await result.current.select(other.id); });
  expect(result.current.selected?.entry.id).toBe(other.id);
  await act(async () => { delayedCapture.resolve(conversation(saved)); expect(await capturing).toBe(true); });
  expect(result.current.selected?.entry.id).toBe(other.id);
  expect(result.current.entries).toContainEqual(saved);
  expect(result.current.busy).toBe(false);
  expect(result.current.loading).toBe(false);
});
