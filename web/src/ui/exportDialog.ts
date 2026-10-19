import { buildPdf, defaultName, pdfOverheadBytes, PAGE_SIZES, pickQualityForTarget, QUALITIES, safeFileName, type PageSizeName, type QualityName } from '../core/pdf';
import { chips, download, formatBytes, h, openDialog, toast } from '../dom';
import { canvasToBlob, renderPage } from '../imaging';
import { state } from '../store';

/** Draws `src` at `maxSide` (never enlarging) onto a fresh canvas. */
function scaled(src: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const longest = Math.max(src.width, src.height);
  if (longest <= maxSide) return src;
  const s = maxSide / longest;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * s)); c.height = Math.max(1, Math.round(src.height * s));
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Renders every page, builds the PDF in the browser, then offers Download and (where supported) Share. */
export function openExport(): void {
  let name = defaultName();
  let size: PageSizeName = 'a4';
  let quality: QualityName = 'high';
  let busy = false;
  let closed = false;
  const estimates: Partial<Record<QualityName, number>> = {};

  openDialog((close) => {
    const input = h('input', { type: 'text', value: name, maxlength: '100', oninput: () => { name = input.value; } });
    const target = h('input', { type: 'number', min: '0.05', step: '0.1', inputmode: 'decimal', placeholder: 'e.g. 2', 'aria-describedby': 'size-hint' });
    const progress = h('progress', { max: '1', value: '0', hidden: true, 'aria-label': 'Export progress' });
    const status = h('div', { class: 'hint', role: 'status' }, `${state.pages.length} page(s) will be exported as one PDF.`);
    const sizeHint = h('div', { class: 'hint', id: 'size-hint', role: 'status' }, 'Calculating file sizes…');
    const dl = h('button', { class: 'btn primary' }, 'Download PDF');
    const share = h('button', { class: 'btn' }, 'Share');
    const cancel = h('button', { class: 'btn', onclick: close }, 'Close');
    const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

    // Quality chips that show the estimated size once it is known.
    const qualityButtons = QUALITIES.map((q) => {
      const b = h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(q.id === quality) }, q.label);
      b.addEventListener('click', () => select(q.id));
      return b;
    });
    const select = (id: QualityName) => { quality = id; qualityButtons.forEach((b, i) => b.setAttribute('aria-checked', String(QUALITIES[i].id === id))); };
    const qualityRow = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'PDF quality' }, ...qualityButtons);
    const drawSizes = () => qualityButtons.forEach((b, i) => {
      const e = estimates[QUALITIES[i].id];
      b.textContent = e === undefined ? QUALITIES[i].label : `${QUALITIES[i].label} · ≈ ${formatBytes(e)}`;
    });
    const applyTarget = () => {
      const mb = parseFloat(target.value);
      if (!Number.isFinite(mb) || mb <= 0) { sizeHint.textContent = Object.keys(estimates).length === QUALITIES.length ? 'Estimates are approximate; the final size is shown after export.' : sizeHint.textContent; return; }
      if (Object.keys(estimates).length < QUALITIES.length) { sizeHint.textContent = 'Still calculating file sizes…'; return; }
      const pick = pickQualityForTarget(estimates, mb * 1048576);
      if (pick) { select(pick); sizeHint.textContent = `${QUALITIES.find((q) => q.id === pick)!.label} fits under ${mb} MB (≈ ${formatBytes(estimates[pick]!)}).`; }
      else { select('tiny'); sizeHint.textContent = `Even Tiny is about ${formatBytes(estimates.tiny!)}, more than ${mb} MB. Remove pages or split the document.`; }
    };
    target.addEventListener('input', applyTarget);

    // Work out the size of every quality in the background, one page at a time.
    void (async () => {
      const total: Record<string, number> = {};
      const top = QUALITIES[0].maxSide;
      try {
        for (let i = 0; i < state.pages.length && !closed; i++) {
          const full = await renderPage(state.pages[i], top);
          for (const q of QUALITIES) {
            if (closed) break;
            const c = scaled(full, q.maxSide);
            total[q.id] = (total[q.id] ?? 0) + (await canvasToBlob(c, 'image/jpeg', q.jpeg)).size;
            if (c !== full) c.width = c.height = 0;
          }
          full.width = full.height = 0;
          sizeHint.textContent = `Calculating file sizes… ${i + 1}/${state.pages.length}`;
        }
        if (closed) return;
        for (const q of QUALITIES) estimates[q.id] = (total[q.id] ?? 0) + pdfOverheadBytes(state.pages.length);
        drawSizes();
        sizeHint.textContent = 'Estimates are approximate; the final size is shown after export.';
        applyTarget();
      } catch { if (!closed) sizeHint.textContent = 'Could not estimate sizes; the final size is shown after export.'; }
    })();

    async function build(): Promise<{ bytes: Uint8Array; file: string }> {
      const q = QUALITIES.find((x) => x.id === quality)!;
      const jpegs = [];
      for (let i = 0; i < state.pages.length; i++) {
        status.textContent = `Rendering page ${i + 1} of ${state.pages.length}…`;
        progress.value = i / state.pages.length;
        const canvas = await renderPage(state.pages[i], q.maxSide);
        const blob = await canvasToBlob(canvas, 'image/jpeg', q.jpeg);
        jpegs.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
        canvas.width = canvas.height = 0; // release memory
      }
      const file = safeFileName(name);
      return { bytes: await buildPdf(jpegs, size, file), file: `${file}.pdf` };
    }
    async function run(action: 'download' | 'share') {
      if (busy || state.pages.length === 0) return;
      busy = true; progress.hidden = false; [dl, share, input, target].forEach((e) => ((e as HTMLButtonElement).disabled = true));
      try {
        const { bytes, file } = await build();
        status.textContent = `${file} · ${formatBytes(bytes.length)}`;
        if (action === 'share') {
          const f = new File([bytes as BlobPart], file, { type: 'application/pdf' });
          if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: file });
          else { download(bytes, file); toast('Sharing files is not supported here, so the PDF was downloaded instead.'); }
        } else { download(bytes, file); toast(`PDF ready (${formatBytes(bytes.length)}). Check your downloads.`); }
      } catch (e) {
        if ((e as DOMException).name !== 'AbortError') { toast(`Export failed: ${(e as Error).message}`); status.textContent = 'Export failed.'; }
      } finally { busy = false; progress.hidden = true; [dl, share, input, target].forEach((el) => ((el as HTMLButtonElement).disabled = false)); }
    }
    dl.addEventListener('click', () => void run('download'));
    share.addEventListener('click', () => void run('share'));
    if (!canShare) share.hidden = true;
    return h('div', { class: 'dlg' }, h('h2', {}, 'Export PDF'),
      h('label', { class: 'field' }, 'File name', input),
      h('div', {}, h('div', { class: 'hint' }, 'Page size'), chips(PAGE_SIZES, size, (id) => { size = id; })),
      h('div', {}, h('div', { class: 'hint' }, 'PDF quality (estimated file size)'), qualityRow),
      h('label', { class: 'field' }, 'Keep under (MB), optional', target), sizeHint,
      progress, status, h('div', { class: 'row end' }, cancel, share, dl));
  }, 'Export PDF', () => { closed = true; });
}
