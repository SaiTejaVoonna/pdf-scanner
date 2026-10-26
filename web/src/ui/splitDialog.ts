import { safeFileName } from '../core/pdf';
import { extractPages, pageCount, parseRanges } from '../core/split';
import { zipStore } from '../core/zip';
import { fileCard, toolPage } from './toolPage';
import { chips, download, formatBytes, h, openDialog, toast } from '../dom';

/** Keeps chosen pages of a PDF as a new PDF, or saves every page as its own file (in a ZIP). Nothing is re-rendered. */
export function openSplit(): void {
  let file: File | null = null, data: Uint8Array | null = null, count = 0, mode: 'keep' | 'each' = 'keep';
  openDialog((close) => {
    const picker = h('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
    const info = h('small', {}, 'Choose the PDF to split');
    const pages = h('input', { type: 'text', placeholder: 'For example 1-3, 5', inputmode: 'numeric', 'aria-label': 'Pages to keep' });
    const pagesField = h('label', { class: 'field' }, 'Pages to keep', pages);
    const status = h('div', { class: 'hint', role: 'status' });
    const go = h('button', { class: 'btn primary', disabled: true }, 'Save');
    picker.addEventListener('change', async () => {
      const f = picker.files?.[0]; picker.value = '';
      if (!f) return;
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        count = await pageCount(bytes); file = f; data = bytes;
        info.textContent = `${f.name} · ${count} page${count === 1 ? '' : 's'} · ${formatBytes(f.size)}`; go.disabled = false; status.textContent = '';
      } catch { toast(`${f.name} is password protected or not a readable PDF.`); }
    });
    go.addEventListener('click', async () => {
      if (!file || !data) return;
      const base = safeFileName(file.name.replace(/\.pdf$/i, ''), 'document');
      go.disabled = true;
      try {
        if (mode === 'keep') {
          const r = parseRanges(pages.value, count);
          if ('error' in r) { status.textContent = r.error; return; }
          const out = await extractPages(data, r.pages);
          download(out, `${base}-pages.pdf`); status.textContent = `${r.pages.length} page${r.pages.length === 1 ? '' : 's'} · ${formatBytes(out.length)}`;
        } else {
          const files: { name: string; data: Uint8Array }[] = [];
          for (let i = 0; i < count; i++) { status.textContent = `Page ${i + 1} of ${count}…`; files.push({ name: `${base}-${String(i + 1).padStart(String(count).length, '0')}.pdf`, data: await extractPages(data, [i]) }); }
          download(zipStore(files), `${base}-pages.zip`, 'application/zip'); status.textContent = `${count} files saved in a ZIP.`;
        }
      } catch { status.textContent = 'This PDF could not be split.'; }
      finally { go.disabled = false; }
    });
    const modeChips = chips([{ id: 'keep' as const, label: 'Keep some pages' }, { id: 'each' as const, label: 'Every page on its own' }], mode, (id) => { mode = id; pagesField.hidden = id !== 'keep'; });
    return toolPage('Split PDF', close, picker,
      fileCard('pdf', 'PDF', info, () => picker.click(), 'Change'),
      modeChips, pagesField, status, h('div', { class: 'row end' }, go));
  }, 'Split PDF').classList.add('full');
}
