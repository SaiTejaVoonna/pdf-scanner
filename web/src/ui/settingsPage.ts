import { chips, h, openSheet } from '../dom';
import { getAuto, getSpeed, setAuto, setSpeed, type Speed } from '../prefs';
import { state, trashedDocs, updateSettings } from '../store';
import { backupEverything } from './backup';
import { icon, type IconName } from './icons';
import { openTrash } from './trashDialog';

declare const __APP_VERSION__: string;

const row = (color: string, ic: IconName, title: string, note: string, trailing?: Node | null, onclick?: () => void): HTMLElement => {
  const inner = [h('span', { class: 'ico', style: `background:${color}` }, icon(ic, 18)), h('div', { class: 'grow' }, h('b', {}, title), h('small', {}, note)), trailing ?? null];
  return onclick
    ? h('button', { class: 'row', type: 'button', style: 'width:100%;border:0;background:transparent;text-align:left;cursor:pointer;color:inherit', onclick }, ...inner)
    : h('div', { class: 'row' }, ...inner);
};
const toggle = (label: string, checked: boolean, on: (v: boolean) => void): HTMLInputElement =>
  h('input', { class: 'sw', type: 'checkbox', role: 'switch', 'aria-label': label, checked, onchange: (e: Event) => on((e.target as HTMLInputElement).checked) });
const labelled = (color: string, ic: IconName, title: string, note: string, checked: boolean, on: (v: boolean) => void): HTMLElement => {
  const sw = toggle(title, checked, on);
  const r = h('label', { class: 'row', style: 'cursor:pointer' }, h('span', { class: 'ico', style: `background:${color}` }, icon(ic, 18)), h('div', { class: 'grow' }, h('b', {}, title), h('small', {}, note)), sw);
  return r;
};

/** The Settings tab: short grouped rows with switches. Everything is stored on this device. */
export function buildSettings(): HTMLElement {
  const s = state.settings;
  const speedLabels: Record<Speed, string> = { fast: 'Fast', normal: 'Normal', careful: 'Careful' };
  const speed = chips((Object.keys(speedLabels) as Speed[]).map((id) => ({ id, label: speedLabels[id] })), getSpeed(), (id) => setSpeed(id));
  speed.classList.add('seg');
  const filter = chips([{ id: 'original' as const, label: 'Original' }, { id: 'enhanced' as const, label: 'Enhanced' }], s.defaultFilter, (id) => updateSettings({ defaultFilter: id }));
  filter.classList.add('seg');
  const kept = state.protectedStorage;
  const trash = trashedDocs().length;
  return h('div', { class: 'settings' },
    h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'Settings')),
    h('div', { class: 'lab' }, 'Scanning'),
    h('div', { class: 'group set' },
      labelled('#3552d9', 'wand', 'Auto-crop camera photos', 'Crop the page when you take it', s.autoCropCamera, (v) => updateSettings({ autoCropCamera: v })),
      labelled('#6b6bd6', 'image', 'Auto-crop imported images', 'Crop photos you import', s.autoCropImport, (v) => updateSettings({ autoCropImport: v })),
      labelled('#2fa84f', 'camera', 'Auto-capture', 'Take the photo when the page is steady', getAuto(), (v) => setAuto(v)),
      h('div', { class: 'row' }, h('span', { class: 'ico', style: 'background:#8e8e93' }, icon('tune', 18)), h('div', { class: 'grow' }, h('b', {}, 'Auto-capture speed'), speed)),
      labelled('#e08a1e', 'book', 'Book reads right to left', 'The right page of a spread comes first', s.bookRtl, (v) => updateSettings({ bookRtl: v })),
      h('div', { class: 'row' }, h('span', { class: 'ico', style: 'background:#3aa0c8' }, icon('tune', 18)), h('div', { class: 'grow' }, h('b', {}, 'Filter for new pages'), filter))),
    h('div', { class: 'lab' }, 'Your files'),
    h('div', { class: 'group set' },
      row('#2fa84f', 'lock', 'Stays on this device', kept ? 'Your browser promises to keep your scans' : 'Nothing is uploaded. Install the app so the browser keeps your scans'),
      row('#3aa0c8', 'cloud', 'Back up everything', 'Save a ZIP of all your PDFs and scans', null, () => void backupEverything()),
      row('#8e8e93', 'trash', 'Recently deleted', trash ? `${trash} item${trash === 1 ? '' : 's'}, kept for 30 days` : 'Nothing here', null, () => openTrash())),
    h('div', { class: 'lab' }, 'About'),
    h('div', { class: 'group set' },
      row('#8e8e93', 'info', 'Credits and licences', 'Open-source parts we use', null, () => openSheet(() => [
        h('h2', {}, 'Credits'),
        h('p', { class: 'hint' }, 'Icons: Material Symbols by Google (Apache License 2.0). PDF files: pdf-lib (MIT). The page-corner model is trained on generated pages; see docs/THIRD_PARTY.md.'),
      ], 'Credits')),
      row('#8e8e93', 'document', `PDF Scanner ${__APP_VERSION__}`, 'Open source. Works offline. Your documents never leave this device.')));
}
