import { buildPdf, defaultName, PAGE_SIZES, QUALITIES, safeFileName, type PageSizeName, type QualityName } from '../core/pdf';
import { chips, download, formatBytes, h, openDialog, toast } from '../dom';
import { canvasToBlob, renderPage } from '../imaging';
import { state } from '../store';

/** Renders every page, builds the PDF in the browser, then offers Download and (where supported) Share. */
export function openExport(): void {
  let name = defaultName();
  let size: PageSizeName = 'a4';
  let quality: QualityName = 'high';
  let busy = false;

  openDialog((close) => {
    const input = h('input', { type: 'text', value: name, maxlength: '100', oninput: () => { name = input.value; } });
    const progress = h('progress', { max: '1', value: '0', hidden: true, 'aria-label': 'Export progress' });
    const status = h('div', { class: 'hint', role: 'status' }, `${state.pages.length} page(s) will be exported as one PDF.`);
    const dl = h('button', { class: 'btn primary' }, 'Download PDF');
    const share = h('button', { class: 'btn' }, 'Share');
    const cancel = h('button', { class: 'btn', onclick: close }, 'Close');
    let canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

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
      busy = true; progress.hidden = false; [dl, share, input].forEach((e) => ((e as HTMLButtonElement).disabled = true));
      try {
        const { bytes, file } = await build();
        status.textContent = `${file} · ${formatBytes(bytes.length)}`;
        if (action === 'share') {
          const f = new File([bytes as BlobPart], file, { type: 'application/pdf' });
          if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: file });
          else { download(bytes, file); toast('Sharing files is not supported here, so the PDF was downloaded instead.'); }
        } else { download(bytes, file); toast('PDF ready. Check your downloads.'); }
      } catch (e) {
        if ((e as DOMException).name !== 'AbortError') { toast(`Export failed: ${(e as Error).message}`); status.textContent = 'Export failed.'; }
      } finally { busy = false; progress.hidden = true; [dl, share, input].forEach((el) => ((el as HTMLButtonElement).disabled = false)); }
    }
    dl.addEventListener('click', () => void run('download'));
    share.addEventListener('click', () => void run('share'));
    if (!canShare) { canShare = false; share.hidden = true; }
    return h('div', { class: 'dlg' }, h('h2', {}, 'Export PDF'),
      h('label', { class: 'field' }, 'File name', input),
      h('div', {}, h('div', { class: 'hint' }, 'Page size'), chips(PAGE_SIZES, size, (id) => { size = id; })),
      h('div', {}, h('div', { class: 'hint' }, 'PDF quality'), chips(QUALITIES, quality, (id) => { quality = id; })),
      progress, status, h('div', { class: 'row end' }, cancel, share, dl));
  }, 'Export PDF');
}
