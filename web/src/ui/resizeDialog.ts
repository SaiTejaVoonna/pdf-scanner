import { safeFileName } from '../core/pdf';
import { fitBox, fitWithin, outputName, padJpeg, searchQuality, toPixels, type Unit } from '../core/sizing';
import { zipStore } from '../core/zip';
import { chips, download, formatBytes, h, openDialog, toast } from '../dom';
import { canvasToBlob, decode } from '../imaging';
import { icon } from './icons';
import { fileCard, toolPage } from './toolPage';

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

/** Common sizes that forms ask for. They are starting points: always check the rules of the form you are filling in. */
const PRESETS = [
  { id: 'passport', label: 'Passport 35×45 mm', w: 35, h: 45, unit: 'mm' as Unit, dpi: 300, min: '', max: '' },
  { id: 'square', label: 'Square 100×100 px', w: 100, h: 100, unit: 'px' as Unit, dpi: 300, min: '', max: '' },
  { id: 'signature', label: 'Signature 140×60 px', w: 140, h: 60, unit: 'px' as Unit, dpi: 300, min: '', max: '50' },
  { id: 'id600', label: 'ID 600×600 px', w: 600, h: 600, unit: 'px' as Unit, dpi: 300, min: '', max: '' },
  { id: 'u50', label: 'Under 50 KB', w: 0, h: 0, unit: 'px' as Unit, dpi: 300, min: '', max: '50' },
  { id: 'u100', label: 'Under 100 KB', w: 0, h: 0, unit: 'px' as Unit, dpi: 300, min: '', max: '100' },
  { id: 'u200', label: 'Under 200 KB', w: 0, h: 0, unit: 'px' as Unit, dpi: 300, min: '', max: '200' },
];

/** Resizes photos for upload forms: a longest side, or an exact size (pixels or millimetres at a DPI), with a file-size range. */
export function openResize(): void {
  const items: Item[] = [];
  let results: Result[] = [];
  let mode: 'side' | 'exact' = 'side';
  let sizeId: SizeId = '1280';
  let format: 'jpeg' | 'png' = 'jpeg';
  let fit: 'crop' | 'fit' = 'crop';
  let unit: Unit = 'px';

  openDialog((close) => {
    const list = h('ul', { class: 'list' });
    const status = h('div', { class: 'hint', role: 'status' }, '');
    const resultList = h('ul', { class: 'result-list', 'aria-label': 'Resized images' });
    const picker = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
    const custom = h('input', { type: 'number', min: '64', max: '10000', step: '1', value: '1000', id: 'rs-custom', 'aria-label': 'Longest side in pixels' });
    const customField = h('label', { class: 'field', hidden: true }, 'Longest side (pixels)', custom);
    const wIn = h('input', { type: 'number', min: '1', step: 'any', value: '413', 'aria-label': 'Width' });
    const hIn = h('input', { type: 'number', min: '1', step: 'any', value: '531', 'aria-label': 'Height' });
    const dpiIn = h('input', { type: 'number', min: '50', max: '1200', step: '1', value: '300' });
    const dpiField = h('label', { class: 'field', hidden: true }, 'DPI (dots per inch)', dpiIn);
    const maxKb = h('input', { type: 'number', min: '1', step: '1', placeholder: 'No limit', id: 'rs-max', 'aria-describedby': 'rs-hint' });
    const minKb = h('input', { type: 'number', min: '1', step: '1', placeholder: 'No minimum', id: 'rs-min' });
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
        catch { toast(`Skipped ${file.name}: not an image.`); }
      }
      picker.value = ''; draw();
    });

    const sideLimit = (): number | null => {
      if (sizeId === 'custom') { const v = Math.round(Number(custom.value)); return Number.isFinite(v) && v >= 16 ? v : null; }
      return SIZES.find((s) => s.id === sizeId)!.side;
    };
    const kb = (el: HTMLInputElement): number | null => { const v = Number(el.value); return el.value && v > 0 ? Math.floor(v * 1024) : null; };
    const exactSize = (): [number, number] | null => {
      const w = Number(wIn.value), hh = Number(hIn.value), dpi = Number(dpiIn.value);
      if (!(w > 0) || !(hh > 0) || (unit === 'mm' && !(dpi >= 50))) return null;
      const pw = toPixels(w, unit, dpi), ph = toPixels(hh, unit, dpi);
      return pw >= 16 && ph >= 16 && pw <= 10000 && ph <= 10000 ? [pw, ph] : null;
    };

    async function resizeOne(it: Item, side: number | null, exact: [number, number] | null, max: number | null, min: number | null, taken: Set<string>): Promise<Result> {
      const bmp = await decode(it.file);
      try {
        const type = format === 'png' ? 'image/png' : 'image/jpeg';
        let [w, hh] = exact ?? fitWithin(bmp.width, bmp.height, side);
        const render = (cw: number, ch: number) => {
          const c = document.createElement('canvas'); c.width = cw; c.height = ch;
          const g = c.getContext('2d')!;
          g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); // a white background (also under transparent PNGs)
          g.imageSmoothingQuality = 'high';
          if (exact) { const b = fitBox(bmp.width, bmp.height, cw, ch, fit); g.drawImage(bmp, b.sx, b.sy, b.sWidth, b.sHeight, b.dx, b.dy, b.dWidth, b.dHeight); }
          else g.drawImage(bmp, 0, 0, cw, ch);
          return c;
        };
        let canvas = render(w, hh);
        let blob: Blob, note: string | undefined;
        const startW = w;
        if (max === null) blob = await canvasToBlob(canvas, type, 0.85);
        else {
          // Lower the JPEG quality first. In "longest side" mode, if that is not enough the pixels shrink too; an exact size never changes.
          let found: Blob | null = null;
          for (let attempt = 0; attempt < 12 && !found; attempt++) {
            if (format === 'jpeg') {
              const hit = await searchQuality(async (q) => (await canvasToBlob(canvas, type, q)).size, max, exact ? 0.15 : 0.4);
              if (hit) found = await canvasToBlob(canvas, type, hit.quality);
            } else {
              const b = await canvasToBlob(canvas, type);
              if (b.size <= max) found = b;
            }
            if (!found) {
              if (exact || w <= 32 || hh <= 32) break;
              w = Math.max(16, Math.round(w * 0.8)); hh = Math.max(16, Math.round(hh * 0.8));
              canvas = render(w, hh);
            }
          }
          if (found) { blob = found; if (w !== startW) note = 'also made smaller to fit the limit'; }
          else { blob = await canvasToBlob(canvas, type, exact ? 0.15 : 0.4); note = 'could not reach the limit'; }
        }
        if (min !== null && blob.size < min) {
          if (format === 'jpeg') { blob = new Blob([padJpeg(new Uint8Array(await blob.arrayBuffer()), min) as BlobPart], { type }); note = [note, 'padded to the minimum size'].filter(Boolean).join('; '); }
          else note = [note, 'PNG cannot reach the minimum'].filter(Boolean).join('; ');
        }
        return { name: outputName(it.file.name, format === 'png' ? 'png' : 'jpg', taken), blob, w, h: hh, before: it.file.size, note };
      } finally { bmp.close(); }
    }

    go.addEventListener('click', async () => {
      const side = mode === 'side' ? sideLimit() : null;
      const exact = mode === 'exact' ? exactSize() : null;
      if (mode === 'side' && sizeId === 'custom' && side === null) { toast('Enter at least 16 pixels.'); return; }
      if (mode === 'exact' && exact === null) { toast('Enter a width and height, and a DPI for millimetres.'); return; }
      const max = kb(maxKb), min = kb(minKb);
      if (max !== null && min !== null && min > max) { toast('Smallest cannot be bigger than largest.'); return; }
      go.disabled = true; zipBtn.hidden = true; results = []; resultList.replaceChildren();
      const taken = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        status.textContent = `Resizing ${i + 1} of ${items.length}…`;
        try { results.push(await resizeOne(items[i], side, exact, max, min, taken)); }
        catch { toast(`Could not resize ${items[i].file.name}.`); }
      }
      const missed = results.filter((r) => r.note?.includes('could not reach the limit')).length;
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

    const sideBox = h('div', { class: 'field-group' }, h('div', { class: 'field' }, h('span', {}, 'Size (longest side)'), chips(SIZES.map((s) => ({ id: s.id, label: s.label })), sizeId, (id) => { sizeId = id; customField.hidden = id !== 'custom'; })), customField);
    const unitChips = chips([{ id: 'px' as const, label: 'px' }, { id: 'mm' as const, label: 'mm' }], unit, (id) => { unit = id; dpiField.hidden = id !== 'mm'; });
    const fitChips = chips([{ id: 'crop' as const, label: 'Crop to fill' }, { id: 'fit' as const, label: 'Fit on white' }], fit, (id) => { fit = id; });
    const exactBox = h('div', { class: 'field-group', hidden: true },
      h('div', { class: 'field' }, h('span', {}, 'Common sizes (check your form)'), chips(PRESETS.map((p) => ({ id: p.id, label: p.label })), '' as string, (id) => {
        const p = PRESETS.find((x) => x.id === id)!;
        if (p.w) { wIn.value = String(p.w); hIn.value = String(p.h); dpiIn.value = String(p.dpi); unit = p.unit; unitChips.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-checked', String((['px', 'mm'] as const)[i] === unit))); dpiField.hidden = unit !== 'mm'; }
        maxKb.value = p.max; minKb.value = p.min;
      })),
      h('div', { class: 'row size-row' }, h('label', { class: 'field' }, 'Width', wIn), h('label', { class: 'field' }, 'Height', hIn), h('div', { class: 'field' }, h('span', {}, 'Unit'), unitChips)),
      dpiField, h('div', { class: 'field' }, h('span', {}, 'If the shape differs'), fitChips));
    const modeChips = chips([{ id: 'side' as const, label: 'Longest side' }, { id: 'exact' as const, label: 'Exact size' }], mode, (id) => { mode = id; sideBox.hidden = id !== 'side'; exactBox.hidden = id !== 'exact'; });
    const formatChips = chips([{ id: 'jpeg' as const, label: 'JPEG (smaller)' }, { id: 'png' as const, label: 'PNG' }], format, (id) => { format = id; });
    return toolPage('Resize photo', close, picker,
      fileCard('image', 'Photos', 'Choose photos', () => picker.click(), 'Add'),
      list, modeChips, sideBox, exactBox,
      h('div', { class: 'field' }, h('span', {}, 'Format'), formatChips),
      h('div', { class: 'row size-row' }, h('label', { class: 'field' }, 'Largest file (KB)', maxKb), h('label', { class: 'field' }, 'Smallest file (KB)', minKb)),
      h('div', { class: 'hint', id: 'rs-hint' }, 'Quality is lowered to fit the largest size.'),
      status, resultList,
      h('div', { class: 'row end' }, zipBtn, go));
  }, 'Resize photo').classList.add('full');
}
