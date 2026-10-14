import { afterEach, describe, expect, it, vi } from 'vitest';

describe('analytics events', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

  it('sends nothing when no event service is configured', async () => {
    vi.stubEnv('VITE_GOATCOUNTER', '');
    const append = vi.fn();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { head: { append }, createElement: () => ({ dataset: {} }) });
    const { track } = await import('../src/analytics');
    track('flute/bansuri');
    expect(append).not.toHaveBeenCalled();
  });

  it('counts events once GoatCounter is loaded, ignoring quick repeats', async () => {
    vi.stubEnv('VITE_GOATCOUNTER', 'flutewizard');
    const script: { dataset: Record<string, string>; src?: string; onload?: () => void } = { dataset: {} };
    const count = vi.fn();
    const win: { goatcounter?: { count: typeof count } } = {};
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { head: { append: vi.fn() }, createElement: () => script });
    const { track } = await import('../src/analytics');
    track('flute/bansuri');
    track('flute/bansuri');
    track('song/along/twinkle');
    expect(script.dataset.goatcounter).toBe('https://flutewizard.goatcounter.com/count');
    expect(count).not.toHaveBeenCalled(); // still loading
    win.goatcounter = { count };
    script.onload?.();
    expect(count.mock.calls.map((c) => c[0].path)).toEqual(['flute/bansuri', 'song/along/twinkle']);
  });
});
