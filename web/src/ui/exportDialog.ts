import { buildPdf, defaultName, pdfOverheadBytes, PAGE_SIZES, pickQualityForTarget, QUALITIES, safeFileName, type PageSizeName, type QualityName } from '../core/pdf';
import { chips, download, formatBytes, h, openDialog, toast } from '../dom';
import { canvasToBlob, renderPage } from '../imaging';
import { currentDoc, recordExport, state } from '../store';
import { icon } from './icons';
import { thumbUrl } from './thumbs';

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
  let name = currentDoc()?.name ?? defaultName();
  let size: PageSizeName = 'a4';
  let quality: QualityName = 'high';
  let busy = false;
  let closed = false;
  let estimating = true; // stops as soon as the real export starts, so two full renders never run at once
  const estimates: Partial<Record<QualityName, number>> = {};

  openDialog((close) => {
    const input = h('input', { type: 'text', value: name, maxlength: '100', oninput: () => { name = input.value; } });
    const target = h('input', { type: 'number', min: '0.05', step: '0.1', inputmode: 'decimal', placeholder: 'e.g. 2', 'aria-describedby': 'size-hint' });
    const progress = h('progress', { max: '1', value: '0', hidden: true, 'aria-label': 'Export progress' });
    const status = h('div', { class: 'hint', role: 'status' });
    const sizeHint = h('div', { class: 'hint', id: 'size-hint', role: 'status' }, 'Calculating file sizes…');
    const dl = h('button', { class: 'btn primary wide' }, 'Create PDF');
    const share = h('button', { class: 'btn wide' }, 'Share');
    const cancel = h('button', { class: 'btn wide', onclick: close }, 'Keep scanning');
    const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

    // Quality cards that show the estimated size once it is known.
    const QUALITY_NOTES: Record<QualityName, string> = { high: 'Sharpest', balanced: 'Good quality and size', small: 'Smaller file', tiny: 'Smallest file' };
    const qualityButtons = QUALITIES.map((q) => {
      const b = h('button', { type: 'button', class: 'qcard', role: 'radio', 'aria-checked': String(q.id === quality) }, h('strong', {}, q.label), h('span', { class: 'note' }, QUALITY_NOTES[q.id]), h('span', { class: 'size' }, 'Calculating…'));
      b.addEventListener('click', () => select(q.id));
      return b;
    });
    const select = (id: QualityName) => { quality = id; qualityButtons.forEach((b, i) => b.setAttribute('aria-checked', String(QUALITIES[i].id === id))); };
    const qualityRow = h('div', { class: 'qcards', role: 'radiogroup', 'aria-label': 'PDF quality' }, ...qualityButtons);
    const drawSizes = () => qualityButtons.forEach((b, i) => {
      const e = estimates[QUALITIES[i].id];
      b.querySelector('.size')!.textContent = e === undefined ? 'Calculating…' : `≈ ${formatBytes(e)}`;
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

    const strip = h('ul', { class: 'thumbstrip', 'aria-label': 'Pages in the PDF' });
    state.pages.forEach((p, i) => {
      const img = h('img', { alt: `Page ${i + 1}`, draggable: 'false' });
      thumbUrl(p).then((u) => { img.src = u; }).catch(() => undefined);
      strip.append(h('li', {}, img, h('span', {}, String(i + 1))));
    });

    // Work out the size of every quality in the background from a few sample pages (rendering every page twice is too heavy for a phone).
    void (async () => {
      const total: Record<string, number> = {};
      const top = QUALITIES[0].maxSide;
      const count = state.pages.length;
      const sample = count <= 3 ? state.pages.slice() : [state.pages[0], state.pages[Math.floor(count / 2)], state.pages[count - 1]];
      try {
        for (let i = 0; i < sample.length && !closed && estimating; i++) {
          const full = await renderPage(sample[i], top);
          for (const q of QUALITIES) {
            if (closed || !estimating) break;
            const c = scaled(full, q.maxSide);
            total[q.id] = (total[q.id] ?? 0) + (await canvasToBlob(c, 'image/jpeg', q.jpeg)).size;
            if (c !== full) c.width = c.height = 0;
          }
          full.width = full.height = 0;
          sizeHint.textContent = `Calculating file sizes… ${i + 1}/${sample.length}`;
        }
        if (closed || !estimating) return;
        const scale = count / Math.max(1, sample.length);
        for (const q of QUALITIES) estimates[q.id] = (total[q.id] ?? 0) * scale + pdfOverheadBytes(count);
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
      busy = true; estimating = false; progress.hidden = false; [dl, share, input, target].forEach((e) => ((e as HTMLButtonElement).disabled = true));
      try {
        const { bytes, file } = await build();
        status.textContent = `${file} · ${formatBytes(bytes.length)}`;
        recordExport(file.replace(/\.pdf$/i, ''), bytes, state.pages.length); // kept with the document, so it can be downloaded again
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
    const n = state.pages.length;
    status.textContent = '';
    return h('div', { class: 'sheet' },
      h('div', { class: 'sheet-body' },
        h('button', { class: 'back', type: 'button', onclick: close }, icon('chevron-left', 22), 'Back'),
        h('h2', {}, 'Ready to make your PDF'),
        h('p', { class: 'hint lead' }, `${n} page${n === 1 ? '' : 's'}, saved on this device`),
        strip,
        h('h3', {}, 'Image quality'), qualityRow, sizeHint,
        h('details', { class: 'more' }, h('summary', {}, 'More options'),
          h('label', { class: 'field' }, 'File name', input),
          h('div', {}, h('div', { class: 'hint' }, 'Page size'), chips(PAGE_SIZES, size, (id) => { size = id; })),
          h('label', { class: 'field' }, 'Keep under (MB), optional', target),
          h('p', { class: 'hint' }, 'We try to pick the best quality that fits. The final size is shown after the PDF is made, and if nothing fits you are told.')),
        progress, status),
      h('div', { class: 'sheet-actions' }, dl, share, cancel));
  }, 'Export PDF', () => { closed = true; }).classList.add('sheetdlg');
}
