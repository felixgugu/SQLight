import type { GridApi } from 'ag-grid-community';

/**
 * Dev-only diagnostics for wide result grids.
 *
 * Enable with `localStorage.setItem('sqlight.perfHud', '1')` in a dev build, then reload.
 * It renders a small overlay with live frame timings and rendered-column counts, plus a
 * scripted horizontal scroll benchmark and a quick-filter settle benchmark, so the real
 * (WebView2) render path can be measured without relying on a manual scrollbar drag or on
 * typing fast enough to catch the filter cost.
 *
 * Pair it with the synthetic result set from `src/utils/perfGridFixture.ts` so both the layout
 * and the data stay identical between the before/after runs.
 *
 * Production builds never register anything.
 */

export const GRID_PERF_HUD_STORAGE_KEY = 'sqlight.perfHud';

export interface FrameStats {
  frames: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  fps: number;
  overBudgetFrames: number;
}

export interface GridPerfSnapshot {
  totalColumns: number;
  displayedColumns: number;
  domCells: number;
  domColumns: number;
  columnVirtualisationSuspected: boolean;
  viewportClientWidth: number;
  viewportScrollWidth: number;
  devicePixelRatio: number;
}

export interface GridPerfDiagOptions {
  api: GridApi;
  container: HTMLElement;
  label?: string;
}

const FRAME_BUDGET_MS = 32;
const SAMPLE_WINDOW = 120;
const DISPLAY_INTERVAL_MS = 250;
const BENCHMARK_FRAMES = 120;
const FILTER_SETTLE_WINDOW_FRAMES = 30;

/**
 * Quick-filter terms used by the scripted benchmark. The short ones match most rows (worst
 * case scan), the long one matches almost nothing, so both ends of the filter cost are covered.
 */
export const FILTER_BENCHMARK_TERMS = ['1', '12', '123', 'abc', 'zzzz'];

export function isGridPerfDiagEnabled(): boolean {
  try {
    if (!import.meta.env?.DEV) return false;
    return typeof localStorage !== 'undefined' && localStorage.getItem(GRID_PERF_HUD_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Pure helper so the statistics can be unit tested without a browser. */
export function computeFrameStats(samples: number[]): FrameStats {
  if (samples.length === 0) {
    return { frames: 0, avgMs: 0, p95Ms: 0, maxMs: 0, fps: 0, overBudgetFrames: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, value) => acc + value, 0);
  const avgMs = sum / samples.length;
  const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
  return {
    frames: samples.length,
    avgMs: round2(avgMs),
    p95Ms: round2(p95Ms),
    maxMs: round2(sorted[sorted.length - 1]!),
    fps: avgMs > 0 ? round2(1000 / avgMs) : 0,
    overBudgetFrames: samples.filter((value) => value > FRAME_BUDGET_MS).length,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve(performance.now()));
  });
}

export function collectGridPerfSnapshot(api: GridApi, container: HTMLElement): GridPerfSnapshot {
  const viewport = container.querySelector<HTMLElement>('.ag-grid-viewport');
  const colIds = new Set<string>();
  container.querySelectorAll('.ag-cell[col-id]').forEach((cell) => {
    const colId = cell.getAttribute('col-id');
    if (colId) colIds.add(colId);
  });
  const totalColumns = api.getAllGridColumns().length;
  const displayedColumns = api.getDisplayedCenterColumns().length;
  const domColumns = colIds.size;
  return {
    totalColumns,
    displayedColumns,
    domCells: container.querySelectorAll('.ag-cell').length,
    domColumns,
    columnVirtualisationSuspected: displayedColumns > 30 && domColumns > displayedColumns * 2,
    viewportClientWidth: viewport?.clientWidth ?? 0,
    viewportScrollWidth: viewport?.scrollWidth ?? 0,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  };
}

/**
 * Scrolls the grid horizontally across its full range in fixed steps and reports the
 * per-frame cost. Mirrors what a scrollbar drag does, but deterministically.
 */
export async function runHorizontalScrollBenchmark(
  container: HTMLElement,
  frames = BENCHMARK_FRAMES
): Promise<FrameStats & { maxScrollPx: number }> {
  const viewport = container.querySelector<HTMLElement>('.ag-grid-viewport');
  if (!viewport) {
    return { ...computeFrameStats([]), maxScrollPx: 0 };
  }
  const maxScrollPx = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const originalLeft = viewport.scrollLeft;
  const samples: number[] = [];

  let previous = await nextFrame();
  for (let i = 1; i <= frames; i++) {
    viewport.scrollLeft = Math.round((maxScrollPx * i) / frames);
    const now = await nextFrame();
    samples.push(now - previous);
    previous = now;
  }
  viewport.scrollLeft = originalLeft;
  return { ...computeFrameStats(samples), maxScrollPx };
}

export interface FilterSettleSample {
  term: string;
  /** Main-thread time spent applying the filter, i.e. the cost paid per keystroke. */
  applyMs: number;
  /** Time from just before the change until the browser painted the following frame. */
  settleMs: number;
  /** Frame timings collected in the window right after the change. */
  stats: FrameStats;
}

export interface FilterSettleReport {
  samples: FilterSettleSample[];
  p95ApplyMs: number;
  maxApplyMs: number;
  p95SettleMs: number;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return round2(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!);
}

/**
 * Applies each quick-filter term through the grid API and reports both the blocking cost of the
 * call itself and the time until the next paint. This is what decides whether the result grid
 * needs a debounced quick-filter input: the meaningful number is the p95 of `applyMs`.
 */
export async function runFilterSettleBenchmark(
  api: GridApi,
  terms: string[] = FILTER_BENCHMARK_TERMS,
  windowFrames = FILTER_SETTLE_WINDOW_FRAMES
): Promise<FilterSettleReport> {
  const original = (api.getGridOption('quickFilterText') ?? '') as string;
  const samples: FilterSettleSample[] = [];

  try {
    for (const term of terms) {
      const before = await nextFrame();
      const applyStart = performance.now();
      api.setGridOption('quickFilterText', term);
      const applyMs = performance.now() - applyStart;
      const settled = await nextFrame();

      const durations: number[] = [settled - before];
      let previous = settled;
      for (let i = 1; i < windowFrames; i++) {
        const now = await nextFrame();
        durations.push(now - previous);
        previous = now;
      }

      samples.push({
        term,
        applyMs: round2(applyMs),
        settleMs: round2(settled - before),
        stats: computeFrameStats(durations),
      });
    }
  } finally {
    // The API call bypasses the Vue-bound prop, so put the grid back the way the component
    // believes it is before returning.
    api.setGridOption('quickFilterText', original);
  }

  const applyTimes = samples.map((sample) => sample.applyMs);
  const settleTimes = samples.map((sample) => sample.settleMs);
  return {
    samples,
    p95ApplyMs: percentile(applyTimes, 0.95),
    maxApplyMs: applyTimes.length > 0 ? round2(Math.max(...applyTimes)) : 0,
    p95SettleMs: percentile(settleTimes, 0.95),
  };
}

export function startGridPerfDiag(options: GridPerfDiagOptions): () => void {
  if (!isGridPerfDiagEnabled() || typeof document === 'undefined') {
    return () => {};
  }

  const { api, container, label } = options;
  const hud = document.createElement('div');
  hud.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:36px',
    'z-index:99999',
    'min-width:250px',
    'padding:6px 8px',
    'border-radius:6px',
    'background:rgba(15,15,20,.92)',
    'border:1px solid #3c3c4e',
    'color:#e4e4e7',
    'font:11px/1.45 ui-monospace,Consolas,monospace',
    'pointer-events:auto',
    'white-space:pre',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = `grid perf ${label ? `(${label})` : ''}`;
  title.style.cssText = 'font-weight:700;color:#7dd3fc;margin-bottom:2px';

  const body = document.createElement('div');

  const buttonStyle =
    'margin-top:4px;padding:2px 6px;border-radius:4px;border:1px solid #3c3c4e;background:#27272a;color:#e4e4e7;font:11px ui-monospace,Consolas,monospace;cursor:pointer';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Run scroll benchmark';
  button.style.cssText = buttonStyle;

  const filterButton = document.createElement('button');
  filterButton.type = 'button';
  filterButton.textContent = 'Run filter benchmark';
  filterButton.style.cssText = buttonStyle;
  filterButton.style.marginLeft = '4px';

  hud.append(title, body, button, filterButton);
  document.body.appendChild(hud);

  const samples: number[] = [];
  let lastDisplay = 0;
  let rafId = 0;
  let running = true;
  let frameStart = performance.now();
  let benchmarkResult = '';
  let filterResult = '';

  const renderHud = () => {
    const live = computeFrameStats(samples);
    const snapshot = collectGridPerfSnapshot(api, container);
    body.textContent = [
      `fps ${live.fps.toFixed(1)}  p95 ${live.p95Ms.toFixed(1)}ms  max ${live.maxMs.toFixed(1)}ms`,
      `cells ${snapshot.domCells}  cols dom/visible/total ${snapshot.domColumns}/${snapshot.displayedColumns}/${snapshot.totalColumns}`,
      `viewport ${snapshot.viewportClientWidth}/${snapshot.viewportScrollWidth}px  dpr ${snapshot.devicePixelRatio}`,
      snapshot.columnVirtualisationSuspected ? 'WARN: column virtualisation looks suppressed' : 'virtualisation ok',
      benchmarkResult,
      filterResult,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const tick = () => {
    if (!running) return;
    const now = performance.now();
    samples.push(now - frameStart);
    frameStart = now;
    if (samples.length > SAMPLE_WINDOW) samples.shift();
    if (now - lastDisplay > DISPLAY_INTERVAL_MS) {
      lastDisplay = now;
      renderHud();
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  renderHud();

  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Running...';
    runHorizontalScrollBenchmark(container)
      .then((stats) => {
        benchmarkResult = `benchmark avg ${stats.avgMs}ms p95 ${stats.p95Ms}ms max ${stats.maxMs}ms over32 ${stats.overBudgetFrames}/${stats.frames}`;
        console.info('[SQLight][grid-perf]', label ?? '', stats, collectGridPerfSnapshot(api, container));
        renderHud();
      })
      .catch((err) => {
        benchmarkResult = `benchmark failed: ${String(err)}`;
        renderHud();
      })
      .finally(() => {
        button.disabled = false;
        button.textContent = 'Run scroll benchmark';
      });
  });

  filterButton.addEventListener('click', () => {
    filterButton.disabled = true;
    filterButton.textContent = 'Running...';
    runFilterSettleBenchmark(api)
      .then((report) => {
        filterResult =
          `filter p95 apply ${report.p95ApplyMs}ms max ${report.maxApplyMs}ms ` +
          `p95 settle ${report.p95SettleMs}ms (${report.samples.map((s) => s.applyMs).join('/')})`;
        console.info('[SQLight][grid-perf][filter]', label ?? '', report);
        renderHud();
      })
      .catch((err) => {
        filterResult = `filter benchmark failed: ${String(err)}`;
        renderHud();
      })
      .finally(() => {
        filterButton.disabled = false;
        filterButton.textContent = 'Run filter benchmark';
      });
  });

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    hud.remove();
  };
}
