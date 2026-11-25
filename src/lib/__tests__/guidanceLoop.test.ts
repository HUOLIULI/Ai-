import { GuidanceLoop } from '../guidanceLoop';
import type { Guidance, GuidanceResult, GuidanceSample, GuidanceStatus } from '../../types/guidance';

type LoopDependencies = {
  canSample: () => boolean;
  sample: (signal: AbortSignal) => Promise<GuidanceSample>;
  analyze: (sample: GuidanceSample, signal: AbortSignal, onProgress: (m: string) => void) => Promise<Guidance>;
  onResult: (result: GuidanceResult | null) => void;
  onStatus: (status: GuidanceStatus) => void;
  onFatal: () => void;
  now?: () => number;
  schedule?: unknown;
  unschedule?: unknown;
};

class FakeScheduler {
  time = 0;
  private handlers: Map<number, { at: number; fn: () => void }> = new Map();
  private nextId = 1;
  schedule(fn: () => void, timeout = 0): number {
    const id = this.nextId++;
    this.handlers.set(id, { at: this.time + timeout, fn });
    return id;
  }
  unschedule(id?: number) { if (id !== undefined) this.handlers.delete(id); }
  advance(ms: number) {
    this.time += ms;
    for (const [id, entry] of [...this.handlers]) {
      if (entry.at <= this.time) { this.handlers.delete(id); entry.fn(); }
    }
  }
}

function makeAdvice(state: Guidance['state'] = 'aim'): Guidance {
  return {
    version: 3, state,
    summary: '保持当前构图，准备拍摄',
    horizontal: 'hold', vertical: 'hold', tilt: 'hold', distance: 'hold', zoom: 'hold',
    light: '光线良好', confidence: 0.9,
    aimPoint: state === 'aim' ? { x: 0.5, y: 0.5 } : null,
    readyToShoot: false,
    route: { path: state === 'aim' ? 'straight' : 'none', holdMs: 800 },
    camera: { zoomFactor: null, flash: 'keep', aperture: null, contrast: null, whiteBalance: 'keep' },
  };
}

function makeHarness(adviceOverrides: Partial<LoopDependencies> = {}) {
  const scheduler = new FakeScheduler();
  const calls = {
    sample: 0, analyze: 0, fatal: 0,
    results: [] as (GuidanceResult | null)[],
    statuses: [] as GuidanceStatus[],
  };
  const advice = makeAdvice();
  const deps: LoopDependencies = {
    canSample: () => true,
    sample: async (_signal: AbortSignal) => { calls.sample++; return { dataUrl: 'data:image/jpeg;base64,x', capturedAt: scheduler.time }; },
    analyze: async (_sample: GuidanceSample, _signal: AbortSignal, _onProgress: (m: string) => void) => { calls.analyze++; return advice; },
    onResult: (result: GuidanceResult | null) => { calls.results.push(result); },
    onStatus: (status: GuidanceStatus) => { calls.statuses.push(status); },
    onFatal: () => { calls.fatal++; },
    now: () => scheduler.time,
    schedule: (handler: () => void, timeout?: number) => scheduler.schedule(handler, timeout),
    unschedule: (id?: number) => scheduler.unschedule(id) as ReturnType<typeof clearTimeout>,
    ...adviceOverrides,
  };
  const loop = new GuidanceLoop(deps as unknown as ConstructorParameters<typeof GuidanceLoop>[0]);
  const lastResult = () => calls.results.at(-1) ?? null;
  const nonNullResults = () => calls.results.filter(Boolean).length;
  return { loop, scheduler, calls, lastResult, nonNullResults };
}

const tick = async (scheduler: FakeScheduler, ms = 1000) => {
  scheduler.advance(ms);
  await Promise.resolve();
  await Promise.resolve();
};

describe('GuidanceLoop', () => {
  it('delivers a plan exactly once after start', async () => {
    const { loop, scheduler, calls, lastResult, nonNullResults } = makeHarness();
    loop.start();
    await tick(scheduler);
    expect(calls.sample).toBe(1);
    expect(calls.analyze).toBe(1);
    expect(nonNullResults()).toBe(1);
    expect(lastResult()?.advice.state).toBe('aim');
    expect(calls.statuses.at(-1)?.phase).toBe('ready');
  });

  it('never reschedules a model call after success or error', async () => {
    const { loop, scheduler, calls } = makeHarness();
    loop.start();
    await tick(scheduler);
    const settled = calls.sample;
    await tick(scheduler);
    await tick(scheduler);
    expect(calls.sample).toBe(settled);
  });

  it('marks a fresh-sample failure as final and does not retry', async () => {
    const harness = makeHarness({
      sample: async () => {
        const now = harness.scheduler.time;
        return { dataUrl: 'x', capturedAt: now - 12_000 };
      },
    });
    const { loop, scheduler, calls, lastResult, nonNullResults } = harness;
    loop.start();
    await tick(scheduler);
    expect(lastResult()).toBeNull();
    expect(nonNullResults()).toBe(0);
    expect(calls.statuses.at(-1)?.message).toMatch(/取样耗时过长/);
    const samples = calls.sample;
    await tick(scheduler);
    await tick(scheduler);
    expect(calls.sample).toBe(samples);
  });

  it('pauses an in-flight request on large motion without scheduling a new one', async () => {
    let resolveAnalyze: ((value: Guidance) => void) | null = null;
    const { loop, scheduler, calls, lastResult } = makeHarness({
      analyze: (_sample: GuidanceSample, _signal: AbortSignal, _onProgress: (m: string) => void) =>
        new Promise<Guidance>(resolve => { resolveAnalyze = resolve; }),
    });
    loop.start();
    await tick(scheduler);
    expect(calls.statuses.at(-1)?.phase).toBe('analyzing');
    loop.pause('画面移动过快');
    expect(calls.statuses.at(-1)?.message).toBe('画面移动过快');
    expect(lastResult()).toBeNull();
    resolveAnalyze!(makeAdvice());
    await tick(scheduler);
    await tick(scheduler);
    expect(calls.sample).toBe(1);
    expect(calls.statuses.at(-1)?.phase).toBe('waiting');
  });

  it('treats a fatal analyze error as disabling guidance', async () => {
    const { loop, scheduler, calls } = makeHarness({
      analyze: async () => {
        const error = new Error('401 未授权') as Error & { fatal?: boolean };
        error.fatal = true;
        throw error;
      },
    });
    loop.start();
    await tick(scheduler);
    expect(calls.fatal).toBe(1);
    expect(calls.statuses.at(-1)?.phase).toBe('error');
  });

  it('replans after an explicit invalidate', async () => {
    const { loop, scheduler, calls, lastResult } = makeHarness();
    loop.start();
    await tick(scheduler);
    const before = calls.sample;
    loop.invalidate('重新规划中');
    expect(lastResult()).toBeNull();
    await tick(scheduler);
    expect(calls.sample).toBe(before + 1);
  });

  it('stop discards pending work and clears the result', async () => {
    const { loop, scheduler, calls, lastResult } = makeHarness();
    loop.start();
    await tick(scheduler);
    expect(lastResult()).not.toBeNull();
    loop.stop();
    expect(lastResult()).toBeNull();
    expect(calls.statuses.at(-1)?.message).toBe('AI 指导已关闭');
    await tick(scheduler);
    const samples = calls.sample;
    await tick(scheduler);
    expect(calls.sample).toBe(samples);
  });

  it('retries sampling until the camera is ready', async () => {
    let ready = false;
    const { loop, scheduler, calls, lastResult } = makeHarness({
      canSample: () => ready,
    });
    loop.start();
    await tick(scheduler);
    expect(calls.sample).toBe(0);
    expect(calls.statuses.at(-1)?.message).toBe('正在等待相机就绪');
    ready = true;
    await tick(scheduler);
    expect(calls.sample).toBe(1);
    expect(lastResult()?.advice).toBeDefined();
  });
});
