import type { GridApi } from 'ag-grid-community';

/**
 * Dev-only diagnostics for wide result grids.
 *
 * Enable with `localStorage.setItem('sqlight.perfHud', '1')` in a dev build, then reload.
 * It renders a small overlay with live frame timings and rendered-column counts, plus a
 * scripted horizontal scroll benchmark so the real (WebView2) render path can be measured
 * without relying on a manual scrollbar drag.
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

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Run scroll benchmark';
  button.style.cssText =
    'margin-top:4px;padding:2px 6px;border-radius:4px;border:1px solid #3c3c4e;background:#27272a;color:#e4e4e7;font:11px ui-monospace,Consolas,monospace;cursor:pointer';

  hud.append(title, body, button);
  document.body.appendChild(hud);

  const samples: number[] = [];
  let lastDisplay = 0;
  let rafId = 0;
  let running = true;
  let frameStart = performance.now();
  let benchmarkResult = '';

  const renderHud = () => {
    const live = computeFrameStats(samples);
    const snapshot = collectGridPerfSnapshot(api, container);
    body.textContent = [
      `fps ${live.fps.toFixed(1)}  p95 ${live.p95Ms.toFixed(1)}ms  max ${live.maxMs.toFixed(1)}ms`,
      `cells ${snapshot.domCells}  cols dom/visible/total ${snapshot.domColumns}/${snapshot.displayedColumns}/${snapshot.totalColumns}`,
      `viewport ${snapshot.viewportClientWidth}/${snapshot.viewportScrollWidth}px  dpr ${snapshot.devicePixelRatio}`,
      snapshot.columnVirtualisationSuspected ? 'WARN: column virtualisation looks suppressed' : 'virtualisation ok',
      benchmarkResult,
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

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    hud.remove();
  };
}
