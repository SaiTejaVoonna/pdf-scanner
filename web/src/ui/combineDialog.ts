import { combinePdfs, pageCount, safeFileName } from '../core/pdf';
import { download, formatBytes, h, openDialog, toast } from '../dom';

interface Item { file: File; pages: number }

/** Combine PDFs without re-rendering them: text and vector content are kept. */
export function openCombine(): void {
  const items: Item[] = [];
  openDialog((close) => {
    const list = h('ul', { class: 'list' });
    const status = h('div', { class: 'hint', role: 'status' }, 'Add two or more PDFs, put them in order, then combine.');
    const go = h('button', { class: 'btn primary', disabled: true }, 'Combine & download');
    const picker = h('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: true, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });

    const draw = () => {
      list.replaceChildren(...items.map((it, i) => h('li', {},
        h('span', {}, `${it.file.name} · ${it.pages} p · ${formatBytes(it.file.size)}`),
        h('button', { class: 'icon-btn', 'aria-label': `Move ${it.file.name} up`, disabled: i === 0, onclick: () => { items.splice(i - 1, 0, items.splice(i, 1)[0]); draw(); } }, '↑'),
        h('button', { class: 'icon-btn', 'aria-label': `Move ${it.file.name} down`, disabled: i === items.length - 1, onclick: () => { items.splice(i + 1, 0, items.splice(i, 1)[0]); draw(); } }, '↓'),
        h('button', { class: 'icon-btn', 'aria-label': `Remove ${it.file.name}`, onclick: () => { items.splice(i, 1); draw(); } }, '✕'))));
      go.disabled = items.length < 2;
    };
    picker.addEventListener('change', async () => {
      for (const file of Array.from(picker.files ?? [])) {
        try { items.push({ file, pages: await pageCount(new Uint8Array(await file.arrayBuffer())) }); }
        catch { toast(`${file.name} is password protected or not a readable PDF, so it was skipped.`); }
      }
      picker.value = ''; draw();
    });
    go.addEventListener('click', async () => {
      go.disabled = true; status.textContent = 'Combining…';
      try {
        const bytes = await combinePdfs(await Promise.all(items.map(async (i) => new Uint8Array(await i.file.arrayBuffer()))));
        const name = `${safeFileName('Combined')}.pdf`;
        download(bytes, name); status.textContent = `${name} · ${formatBytes(bytes.length)}`; toast('Combined PDF ready.');
      } catch (e) { toast(`Could not combine: ${(e as Error).message}`); status.textContent = 'Failed.'; }
      finally { go.disabled = items.length < 2; }
    });
    return h('div', { class: 'dlg' }, h('h2', {}, 'Combine PDFs'), picker,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => picker.click() }, 'Add PDFs…')),
      list, status, h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: close }, 'Close'), go));
  }, 'Combine PDFs');
}
