import { compressToTarget } from '../core/compress';
import { safeFileName } from '../core/pdf';
import { toolPage } from './toolPage';
import { chips, download, formatBytes, h, openDialog, toast } from '../dom';
import { reencodeJpeg } from '../imaging';

const SIZES = [
  { id: 'gentle', label: 'Gentle', bytes: null }, { id: '2mb', label: '2 MB', bytes: 2 * 1048576 }, { id: '1mb', label: '1 MB', bytes: 1048576 },
  { id: '500kb', label: '500 KB', bytes: 512000 }, { id: '200kb', label: '200 KB', bytes: 204800 }, { id: 'custom', label: 'Custom', bytes: null },
] as const;
type SizeId = (typeof SIZES)[number]['id'];

/** Makes a scanned PDF smaller by re-encoding its photos. Text-only PDFs have nothing to shrink and are left as they are. */
export function openCompress(start?: { file: File }): void {
  let file: File | null = null, data: Uint8Array | null = null, sizeId: SizeId = '1mb';
  let result: { bytes: Uint8Array; name: string } | null = null;
  openDialog((close) => {
    const picker = h('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
    const info = h('div', { class: 'hint' }, 'Choose the PDF to make smaller.');
    const custom = h('input', { type: 'number', min: '10', step: '10', value: '300', 'aria-label': 'Largest size in KB' });
    const customField = h('label', { class: 'field', hidden: true }, 'Largest size (KB)', custom);
    const status = h('div', { class: 'hint', role: 'status' });
    const go = h('button', { class: 'btn primary', disabled: true }, 'Make smaller');
    const save = h('button', { class: 'btn primary', hidden: true }, 'Download');
    const load = async (f: File) => {
      file = f; data = new Uint8Array(await f.arrayBuffer()); result = null; save.hidden = true; status.textContent = '';
      info.textContent = `${f.name} · ${formatBytes(f.size)}`; go.disabled = false;
    };
    picker.addEventListener('change', async () => { const f = picker.files?.[0]; picker.value = ''; if (f) await load(f); });
    if (start) void load(start.file);
    const target = (): number | null => {
      if (sizeId === 'custom') { const v = Math.round(Number(custom.value)); return Number.isFinite(v) && v >= 10 ? v * 1024 : null; }
      return SIZES.find((s) => s.id === sizeId)!.bytes;
    };
    go.addEventListener('click', async () => {
      if (!file || !data) return;
      if (sizeId === 'custom' && target() === null) { toast('Enter a size of at least 10 KB.'); return; }
      go.disabled = true; save.hidden = true; status.textContent = 'Working…';
      try {
        const r = await compressToTarget(data, target(), reencodeJpeg, (i, n) => { status.textContent = `Trying a stronger setting (${i + 1} of ${n})…`; });
        const name = `${safeFileName(file.name.replace(/\.pdf$/i, ''), 'document')}-smaller.pdf`;
        if (r.images === 0) status.textContent = 'This PDF has no photos to shrink (it is mostly text or drawings), so it was left as it is.';
        else if (r.bytes.length >= data.length) status.textContent = 'This PDF is already as small as it can go without hurting the pages.';
        else {
          result = { bytes: r.bytes, name }; save.hidden = false;
          status.textContent = `${formatBytes(data.length)} → ${formatBytes(r.bytes.length)}${r.reached ? '' : '. This is as small as the strongest setting can make it, so it did not reach your size.'}`;
        }
      } catch { status.textContent = 'This PDF could not be read (it may be password protected).'; }
      finally { go.disabled = false; }
    });
    save.addEventListener('click', () => { if (result) download(result.bytes, result.name); });
    const sizeChips = chips(SIZES.map((s) => ({ id: s.id, label: s.label })), sizeId, (id) => { sizeId = id; customField.hidden = id !== 'custom'; });
    return toolPage('Compress PDF', close, picker,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => picker.click() }, 'Choose PDF…')), info,
      h('div', { class: 'field' }, h('span', {}, 'Make it no bigger than'), sizeChips), customField,
      h('p', { class: 'hint' }, 'Works on scanned PDFs (photos of pages). Text is not touched, so a PDF with no photos stays the same. Everything happens on this device.'),
      status, h('div', { class: 'row end' }, save, go));
  }, 'Compress PDF').classList.add('full');
}
