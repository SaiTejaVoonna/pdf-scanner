import { combine, findPage, type Combined } from './core/find';
import { analysisImage } from './imaging';
import { detectInBackground } from './live/detectOnce';
import { loadModel } from './model';
import { runModel } from './modelRun';

/** The last answer (and which opinion it came from), for tests and debugging: `window.__engine`. */
declare global { interface Window { __engine?: { last?: Combined } } }

/**
 * Finds the page in a stored photo. Every caller (new photos, bulk Auto-crop, the editor's Auto-detect) comes through here, so
 * the same photo gets the same answer wherever it came from. The rule-based finder and the learned model both run in the
 * background worker (so the screen never stalls) and are combined (core/find.ts `combine`). Without a worker or without the model
 * file the rules decide alone.
 */
export async function findCorners(blob: Blob, o: { anchored?: boolean } = {}): Promise<Combined> {
  const img = await analysisImage(blob);
  const r = await detectInBackground(img, { mode: 'single', anchored: !!o.anchored, foldOnGuide: false });
  let out: Combined;
  if (r && r.confidence) out = { quad: r.quad, confidence: r.confidence, source: r.source ?? 'rules' };
  else {
    const rules = findPage(img, o);
    let model = null;
    try { const net = await loadModel(); if (net) model = runModel(net, img); } catch { /* the rules stand alone */ }
    out = combine(img, rules, model);
  }
  (window.__engine ??= {}).last = out;
  return out;
}
