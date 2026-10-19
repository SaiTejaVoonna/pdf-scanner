import { safeFileName } from '../core/pdf';
import { fitWithin, outputName, searchQuality } from '../core/sizing';
import { zipStore } from '../core/zip';
import { chips, download, formatBytes, h, openDialog, toast } from '../dom';
import { canvasToBlob, decode } from '../imaging';
import { icon } from './icons';

interface Item { file: File; w: number; h: number }
interface Result { name: string; blob: Blob; w: number; h: number; before: number; note?: string }

const SIZES = [
  { id: 'orig', label: 'Original', side: null },
  { id: '2048', label: 'Large 2048', side: 2048 },
  { id: '1280', label: 'Medium 1280', side: 1280 },
  { id: '800', label: 'Small 800', side: 800 },
  { id: 'custom', label: 'Custom', side: null },
] as const;
type SizeId = (typeof SIZES)[number]['id'];

/** Shrinks photos for upload forms (portals that cap file size or pixels). Everything happens in the browser. */
export function openResize(): void {
  const items: Item[] = [];
  let results: Result[] = [];
  let sizeId: SizeId = '1280';
  let format: 'jpeg' | 'png' = 'jpeg';

  openDialog((close) => {
    const list = h('ul', { class: 'list' });
    const status = h('div', { class: 'hint', role: 'status' }, 'Add photos, pick a size, and optionally a maximum file size.');
    const resultList = h('ul', { class: 'result-list', 'aria-label': 'Resized images' });
    const picker = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
    const custom = h('input', { type: 'number', min: '64', max: '10000', step: '1', value: '1000', id: 'rs-custom', 'aria-label': 'Longest side in pixels' });
    const customField = h('label', { class: 'field', hidden: true }, 'Longest side (pixels)', custom);
    const maxMb = h('input', { type: 'number', min: '0.01', step: '0.1', placeholder: 'No limit', id: 'rs-max', 'aria-describedby': 'rs-hint' });
    const go = h('button', { class: 'btn primary', disabled: true }, 'Resize');
    const zipBtn = h('button', { class: 'btn', hidden: true }, 'Download all (ZIP)');

    const draw = () => {
      list.replaceChildren(...items.map((it, i) => h('li', {},
        h('span', {}, `${it.file.name} · ${it.w}×${it.h} · ${formatBytes(it.file.size)}`),
        h('button', { class: 'icon-btn', 'aria-label': `Remove ${it.file.name}`, onclick: () => { items.splice(i, 1); draw(); } }, icon('close', 20)))));
      go.disabled = items.length === 0;
    };
    picker.addEventListener('change', async () => {
      for (const file of Array.from(picker.files ?? [])) {
        try { const b = await decode(file); items.push({ file, w: b.width, h: b.height }); b.close(); }
        catch { toast(`${file.name} could not be read as an image, so it was skipped.`); }
      }
      picker.value = ''; draw();
    });

    const sideLimit = (): number | null => {
      if (sizeId === 'custom') { const v = Math.round(Number(custom.value)); return Number.isFinite(v) && v >= 16 ? v : null; }
      return SIZES.find((s) => s.id === sizeId)!.side;
    };
    const targetBytes = (): number | null => { const v = Number(maxMb.value); return maxMb.value && v > 0 ? Math.floor(v * 1048576) : null; };

    async function resizeOne(it: Item, side: number | null, target: number | null, taken: Set<string>): Promise<Result> {
      const bmp = await decode(it.file);
      try {
        const type = format === 'png' ? 'image/png' : 'image/jpeg';
        let [w, hh] = fitWithin(bmp.width, bmp.height, side);
        const render = (cw: number, ch: number) => {
          const c = document.createElement('canvas'); c.width = cw; c.height = ch;
          const g = c.getContext('2d')!;
          if (format === 'jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); }
          g.imageSmoothingQuality = 'high';
          g.drawImage(bmp, 0, 0, cw, ch);
          return c;
        };
        let canvas = render(w, hh);
        let blob: Blob, note: string | undefined;
        if (target === null) blob = await canvasToBlob(canvas, type, 0.85);
        else {
          // Lower JPEG quality first; if even that is too big (or the format is PNG), shrink the pixels and try again.
          let found: Blob | null = null;
          for (let attempt = 0; attempt < 12 && !found; attempt++) {
            if (format === 'jpeg') {
              const hit = await searchQuality(async (q) => (await canvasToBlob(canvas, type, q)).size, target);
              if (hit) found = await canvasToBlob(canvas, type, hit.quality);
            } else {
              const b = await canvasToBlob(canvas, type);
              if (b.size <= target) found = b;
            }
            if (!found) {
              if (w <= 32 || hh <= 32) break;
              w = Math.max(16, Math.round(w * 0.8)); hh = Math.max(16, Math.round(hh * 0.8));
              canvas = render(w, hh);
            }
          }
          if (found) { blob = found; if (w !== fitWithin(bmp.width, bmp.height, side)[0]) note = 'also made smaller to fit the limit'; }
          else { blob = await canvasToBlob(canvas, type, 0.4); note = 'could not reach the limit'; }
        }
        return { name: outputName(it.file.name, format === 'png' ? 'png' : 'jpg', taken), blob, w, h: hh, before: it.file.size, note };
      } finally { bmp.close(); }
    }

    go.addEventListener('click', async () => {
      const side = sideLimit();
      if (sizeId === 'custom' && side === null) { toast('Enter a size of at least 16 pixels.'); return; }
      const target = targetBytes();
      go.disabled = true; zipBtn.hidden = true; results = []; resultList.replaceChildren();
      const taken = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        status.textContent = `Resizing ${i + 1} of ${items.length}…`;
        try { results.push(await resizeOne(items[i], side, target, taken)); }
        catch { toast(`${items[i].file.name} could not be resized.`); }
      }
      const missed = results.filter((r) => r.note === 'could not reach the limit').length;
      status.textContent = results.length ? `Done: ${results.length} image${results.length > 1 ? 's' : ''} resized.${missed ? ` ${missed} could not reach the size limit.` : ''}` : 'Nothing was resized.';
      resultList.replaceChildren(...results.map((r) => h('li', {},
        h('span', { class: 'name' }, r.name),
        h('span', { class: 'sizes' }, `${r.w}×${r.h} · ${formatBytes(r.before)} → ${formatBytes(r.blob.size)}${r.note ? ` (${r.note})` : ''}`),
        h('button', { class: 'btn', 'aria-label': `Download ${r.name}`, onclick: () => download(r.blob, r.name, r.blob.type) }, 'Save'))));
      zipBtn.hidden = results.length < 2;
      go.disabled = items.length === 0;
    });
    zipBtn.addEventListener('click', async () => {
      const files = await Promise.all(results.map(async (r) => ({ name: r.name, data: new Uint8Array(await r.blob.arrayBuffer()) })));
      download(zipStore(files), `${safeFileName('Resized images')}.zip`, 'application/zip');
    });

    const sizeChips = chips(SIZES.map((s) => ({ id: s.id, label: s.label })), sizeId, (id) => { sizeId = id; customField.hidden = id !== 'custom'; });
    const formatChips = chips([{ id: 'jpeg' as const, label: 'JPEG (smaller)' }, { id: 'png' as const, label: 'PNG' }], format, (id) => { format = id; });
    return h('div', { class: 'dlg' }, h('h2', {}, 'Resize images'), picker,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => picker.click() }, 'Add images…')),
      list,
      h('div', { class: 'field' }, h('span', {}, 'Size (longest side)'), sizeChips), customField,
      h('div', { class: 'field' }, h('span', {}, 'Format'), formatChips),
      h('label', { class: 'field' }, 'Keep each image under (MB, optional)', maxMb),
      h('div', { class: 'hint', id: 'rs-hint' }, 'Useful for upload portals with a size limit. Quality is lowered just enough; if that is not enough the image is also made smaller.'),
      status, resultList,
      h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: close }, 'Close'), zipBtn, go));
  }, 'Resize images');
}
