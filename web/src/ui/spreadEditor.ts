import { detectSpread } from '../core/detect';
import { FILTERS, type FilterName } from '../core/filters';
import { cloneQuad, clamp01, isValidCrop, type Pt, type Quad } from '../core/geometry';
import type { Img } from '../core/image';
import { boundaryInk, findGutter, gutterPoints, isValidSpread, splitSpread, turnOuter, type SpreadGeometry } from '../core/spread';
import { chips, h, openDialog, toast } from '../dom';
import { decode } from '../imaging';
import * as store from '../store';
import { icon } from './icons';

export interface SpreadDraftData {
  geo: SpreadGeometry; independent: boolean; left: Quad; right: Quad; filter: FilterName; confirmed: boolean;
}

export interface SpreadEditorOptions {
  /** 'new' adds a spread on Apply; 'edit' changes an existing one; 'retake' swaps its source for a new capture. */
  mode: 'new' | 'edit' | 'retake';
  blob: Blob;
  w: number; h: number;
  /** Where the corners and gutter start. */
  start: SpreadGeometry;
  /** The gutter (or outline) is a guess: Apply stays disabled until the user confirms or moves it. */
  uncertain: boolean;
  outlineGuessed?: boolean;
  /** Set for 'edit' and 'retake'. */
  spreadId?: string;
  /** Identifies the unsaved draft ('new' mode keeps the capture itself until Apply or Cancel). */
  draftId: string;
  resume?: SpreadDraftData;
}

const SIDE_NAMES = ['top', 'right', 'bottom', 'left'];
const WARN_INK = 0.05;
const ANALYSIS_SIDE = 400;

/**
 * Review screen for a two-page spread: 4 outer corners plus 2 gutter handles (sliding along the top and bottom edges so the
 * split can tilt), or "adjust each page" with 8 independent corners. Resolves true when applied, false when cancelled.
 */
export function openSpreadEditor(o: SpreadEditorOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let geo: SpreadGeometry = o.resume?.geo ?? { outer: cloneQuad(o.start.outer), tTop: o.start.tTop, tBottom: o.start.tBottom };
    const spread = o.spreadId ? store.state.spreads.find((s) => s.id === o.spreadId) : undefined;
    let independent = o.resume?.independent ?? spread?.independent ?? false;
    const existing = spread ? store.pagesOfSpread(spread.id) : [];
    let left: Quad = o.resume?.left ?? existing.find((p) => p.spread?.side === 'L')?.corners ?? splitSpread(geo)[0];
    let right: Quad = o.resume?.right ?? existing.find((p) => p.spread?.side === 'R')?.corners ?? splitSpread(geo)[1];
    let filter: FilterName = o.resume?.filter ?? existing[0]?.filter ?? store.state.settings.defaultFilter;
    let confirmed = o.resume?.confirmed ?? !o.uncertain;
    let bitmap: ImageBitmap | null = null;
    let analysis: Img | null = null;
    let applied = false;
    let draftTimer: number | undefined;
    let fitted = { w: 0, h: 0 };

    const stageInner = h('div', { class: 'stage-inner' });
    const banner = h('div', { class: 'warn', role: 'status' });
    const stage = h('div', { class: 'stage' }, stageInner, banner);
    const apply = h('button', { class: 'btn primary', disabled: true }, o.mode === 'retake' ? 'Replace' : 'Apply');
    const confirmBtn = h('button', { class: 'btn' }, 'Confirm split');
    const modeBtn = h('button', { class: 'btn', 'aria-pressed': 'false' });
    const sub = h('p', { class: 'hint' });

    const halves = (): [Quad, Quad] => (independent ? [left, right] : splitSpread(geo));
    const valid = () => (independent ? isValidCrop(left, 0.005) && isValidCrop(right, 0.005) : isValidSpread(geo));

    const persistDraft = () => {
      if (applied) return;
        const data: SpreadDraftData = { geo, independent, left, right, filter, confirmed };
        if (o.mode === 'new') store.saveDraft({ kind: 'newSpread', id: o.draftId, data }, o.blob);
        else if (o.mode === 'edit') store.saveDraft({ kind: 'spread', id: o.spreadId!, data });
    };
    const saveDraft = () => { window.clearTimeout(draftTimer); draftTimer = window.setTimeout(persistDraft, 400); };

    function warnings(): string[] {
      const out: string[] = [];
      if (!confirmed && o.mode !== 'edit') out.push(o.uncertain && !o.outlineGuessed
        ? 'I could not find the fold between the pages. Drag the two centre handles onto it, or tap Confirm split if the middle is right.'
        : 'I could not find the page edges. Move the corners onto the pages, then confirm the split.');
      else if (!confirmed) out.push('Confirm the split to continue.');
      if (!valid()) out.push('The corners must form two convex pages; move a handle.');
      if (analysis && valid()) {
        // One short line however many edges are touched; the edges themselves are listed in the tooltip.
        const touched: string[] = [];
        const names = ['left', 'right'];
        halves().forEach((q, k) => boundaryInk(analysis!, q).forEach((v, side) => { if (v > WARN_INK) touched.push(`${SIDE_NAMES[side]} edge of the ${names[k]} page`); }));
        if (touched.length) out.push(`Writing touches ${touched.length === 1 ? 'an edge' : `${touched.length} edges`}: move ${touched.length === 1 ? 'that handle' : 'those handles'} outward.|${touched.join(', ')}`);
      }
      return out;
    }

    function refresh() {
      const w = warnings();
      banner.replaceChildren(...w.slice(0, 2).map((t) => { const [text, tip] = t.split('|'); return h('div', { title: tip }, text); }));
      banner.classList.toggle('on', w.length > 0);
      apply.disabled = !valid() || (!confirmed && o.mode !== 'edit');
      confirmBtn.hidden = confirmed || o.mode === 'edit';
      modeBtn.textContent = independent ? 'Link pages to the spread' : 'Adjust each page';
      modeBtn.setAttribute('aria-pressed', String(independent));
      sub.textContent = independent ? 'Each page has its own four corners.' : 'Drag the corners. Slide the two centre handles along the fold.';
    }

    const fit = () => ({ maxW: Math.max(100, stage.clientWidth - 24), maxH: Math.max(100, stage.clientHeight - 24) });

    function layout() {
      if (!bitmap) return;
      const { maxW, maxH } = fit();
      fitted = { w: maxW, h: maxH };
      const s = Math.min(maxW / bitmap.width, maxH / bitmap.height);
      const w = Math.round(bitmap.width * s), hh = Math.round(bitmap.height * s);
      // A relayout rebuilds the handles; keep keyboard focus on the same one.
      const focusedLabel = stageInner.contains(document.activeElement) ? (document.activeElement as HTMLElement).getAttribute('aria-label') : null;
      stageInner.replaceChildren();
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      c.getContext('2d')!.drawImage(bitmap, 0, 0, w, hh);
      c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Photo of the spread with page outlines');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'overlay'); svg.setAttribute('width', String(w)); svg.setAttribute('height', String(hh));
      const shade = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shade.setAttribute('fill-rule', 'evenodd'); shade.setAttribute('fill', 'rgba(0,0,0,.4)');
      const lp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const rp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      for (const [p, color] of [[lp, '#60a5fa'], [rp, '#34d399']] as const) { p.setAttribute('fill', 'none'); p.setAttribute('stroke', color); p.setAttribute('stroke-width', '2'); }
      svg.append(shade, lp, rp);
      stageInner.style.width = `${w}px`; stageInner.style.height = `${hh}px`;
      stageInner.append(c, svg);

      type Handle = { el: HTMLButtonElement; pos: () => Pt };
      const handles: Handle[] = [];
      const poly = (q: Quad) => `M${q.map((p) => `${p.x * w},${p.y * hh}`).join(' L')}Z`;
      const draw = () => {
        const [l, r] = halves();
        lp.setAttribute('d', poly(l)); rp.setAttribute('d', poly(r));
        shade.setAttribute('d', `M0,0H${w}V${hh}H0Z ${poly(l)} ${poly(r)}`);
        handles.forEach((hd) => { const p = hd.pos(); hd.el.style.left = `${p.x * w}px`; hd.el.style.top = `${p.y * hh}px`; });
      };
      const changed = () => { draw(); saveDraft(); };
      const done = () => { refresh(); };
      const addHandle = (label: string, pos: () => Pt, move: (p: Pt) => void, nudge: (dx: number, dy: number) => void, gutter = false) => {
        const el = h('button', { class: `handle${gutter ? ' gutter' : ''}`, type: 'button', 'aria-label': `${label}. Use arrow keys to move.` });
        let dragging = false;
        el.addEventListener('pointerdown', (e) => { dragging = true; el.setPointerCapture(e.pointerId); e.preventDefault(); });
        el.addEventListener('pointerup', () => { dragging = false; done(); });
        el.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          const r = stageInner.getBoundingClientRect();
          move({ x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) });
          changed();
        });
        el.addEventListener('keydown', (e) => {
          const step = e.shiftKey ? 0.05 : 0.01;
          const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          if (d[e.key]) { e.preventDefault(); nudge(d[e.key][0], d[e.key][1]); changed(); done(); }
        });
        stageInner.append(el);
        handles.push({ el, pos });
      };
      const NAMES = ['top left corner', 'top right corner', 'bottom right corner', 'bottom left corner'];
      const markMoved = () => { confirmed = true; };
      if (!independent) {
        geo.outer.forEach((_, i) => addHandle(`Spread ${NAMES[i]}`, () => geo.outer[i],
          (p) => { geo.outer[i] = p; }, (dx, dy) => { geo.outer[i] = { x: clamp01(geo.outer[i].x + dx), y: clamp01(geo.outer[i].y + dy) }; }));
        // Gutter ends slide along the outer top/bottom edges: project the pointer onto the edge.
        const slide = (a: Pt, b: Pt, p: Pt) => {
          const dx = b.x - a.x, dy = b.y - a.y;
          return Math.min(0.97, Math.max(0.03, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        };
        addHandle('Fold, top end', () => gutterPoints(geo)[0], (p) => { geo.tTop = slide(geo.outer[0], geo.outer[1], p); markMoved(); },
          (dx) => { geo.tTop = Math.min(0.97, Math.max(0.03, geo.tTop + dx)); markMoved(); }, true);
        addHandle('Fold, bottom end', () => gutterPoints(geo)[1], (p) => { geo.tBottom = slide(geo.outer[3], geo.outer[2], p); markMoved(); },
          (dx) => { geo.tBottom = Math.min(0.97, Math.max(0.03, geo.tBottom + dx)); markMoved(); }, true);
      } else {
        for (const [q, name] of [[left, 'Left page'], [right, 'Right page']] as const) {
          q.forEach((_, i) => addHandle(`${name} ${NAMES[i]}`, () => q[i],
            (p) => { q[i] = p; }, (dx, dy) => { q[i] = { x: clamp01(q[i].x + dx), y: clamp01(q[i].y + dy) }; }));
        }
      }
      draw();
      if (focusedLabel) [...stageInner.querySelectorAll<HTMLElement>('[aria-label]')].find((e) => e.getAttribute('aria-label') === focusedLabel)?.focus();
    }

    // ---- toolbar actions
    modeBtn.addEventListener('click', () => {
      if (!independent) { [left, right] = splitSpread(geo).map(cloneQuad) as [Quad, Quad]; independent = true; }
      else { independent = false; }
      confirmed = true; layout(); refresh(); saveDraft();
    });
    confirmBtn.addEventListener('click', () => { confirmed = true; refresh(); saveDraft(); });
    const autoBtn = h('button', { class: 'btn', onclick: () => {
      if (!analysis) return;
      const d = detectSpread(analysis);
      geo = { outer: d.outer, tTop: d.tTop, tBottom: d.tBottom };
      independent = false; confirmed = !d.uncertain; layout(); refresh(); saveDraft();
      toast(d.uncertain ? 'Found the pages but not the fold. Place the fold handles and confirm.' : 'Detected the spread.');
    } }, 'Auto-detect');
    const rotateBtn = h('button', { class: 'btn', 'aria-label': 'Rotate spread', onclick: () => {
      if (!analysis) return;
      const outer = turnOuter(geo.outer, 1);
      const g = findGutter(analysis, outer);
      geo = { outer, tTop: g.tTop, tBottom: g.tBottom };
      independent = false; confirmed = g.confident; layout(); refresh(); saveDraft();
    } }, icon('rotate', 20), ' Rotate');
    const filterChips = chips(FILTERS, filter, (id) => { filter = id; saveDraft(); });

    const finish = (ok: boolean) => {
      window.clearTimeout(draftTimer);
      if (ok) {
        applied = true;
        const [l, r] = halves();
        const target = o.mode === 'new'
          ? store.addSpread(o.blob, o.w, o.h, geo)
          : o.mode === 'retake' ? (store.retakeSpread(o.spreadId!, o.blob, o.w, o.h, geo), store.state.spreads.find((s) => s.id === o.spreadId)!)
          : (store.updateSpread(o.spreadId!, { outer: geo.outer, tTop: geo.tTop, tBottom: geo.tBottom, independent }), store.state.spreads.find((s) => s.id === o.spreadId)!);
        if (independent) store.updateSpread(target.id, { independent: true });
        const mine = store.pagesOfSpread(target.id);
        store.editPages(mine.map((p) => p.id), (p) => ({ ...p, filter, ...(independent ? { corners: cloneQuad(p.spread?.side === 'L' ? l : r) } : {}) }));
      }
      if (o.mode !== 'retake') store.clearDraft();
      dlg.close();
      resolve(ok);
    };
    apply.addEventListener('click', () => finish(true));

    const dlg = openDialog((close) => {
      void close;
      return h('div', { class: 'editor' },
        h('div', { class: 'head' }, h('button', { class: 'icon-btn', 'aria-label': 'Cancel', onclick: () => { if (!applied) finish(false); } }, icon('arrow-left')),
          h('h2', {}, o.mode === 'retake' ? 'Retake spread' : o.mode === 'edit' ? 'Edit spread' : 'Review spread'), apply),
        stage,
        h('div', { class: 'tools' }, sub, h('div', { class: 'row ed-tools' }, autoBtn, rotateBtn, modeBtn, confirmBtn), filterChips));
    }, 'Review spread', () => { bitmap?.close(); watch.disconnect(); window.removeEventListener('app-flush-drafts', persistDraft); window.clearTimeout(draftTimer); if (!applied) resolve(false); });
    window.addEventListener('app-flush-drafts', persistDraft);
    dlg.classList.add('full');
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); });

    const watch = new ResizeObserver(() => {
      const now = fit();
      if (!bitmap || (Math.abs(now.maxW - fitted.w) < 3 && Math.abs(now.maxH - fitted.h) < 3)) return;
      layout();
    });
    watch.observe(stage);

    void (async () => {
      try {
        bitmap = await decode(o.blob);
        const s = Math.min(1, ANALYSIS_SIDE / Math.max(bitmap.width, bitmap.height));
        const c = document.createElement('canvas'); c.width = Math.max(32, Math.round(bitmap.width * s)); c.height = Math.max(32, Math.round(bitmap.height * s));
        const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(bitmap, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height);
        analysis = { data: d.data, width: c.width, height: c.height };
        layout(); refresh();
      } catch { toast('This image could not be opened.'); finish(false); }
    })();
    refresh();
  });
}
