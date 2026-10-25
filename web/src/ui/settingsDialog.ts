import { chips, h, openDialog } from '../dom';
import { state, updateSettings } from '../store';
import { backupEverything } from './backup';

declare const __APP_VERSION__: string;

export function openSettings(): void {
  openDialog((close) => {
    const s = state.settings;
    const sw = (label: string, checked: boolean, on: (v: boolean) => void) =>
      h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked, onchange: (e: Event) => on((e.target as HTMLInputElement).checked) }), label);
    return h('div', { class: 'dlg' },
      h('h2', {}, 'Settings'),
      sw('Auto-crop camera photos', s.autoCropCamera, (v) => updateSettings({ autoCropCamera: v })),
      sw('Auto-crop imported images', s.autoCropImport, (v) => updateSettings({ autoCropImport: v })),
      sw('Book reads right to left', s.bookRtl, (v) => updateSettings({ bookRtl: v })),
      h('p', { class: 'hint' }, 'For right-to-left books the right page of a spread comes first.'),
      sw('Guide lines on the single-page camera', s.guideLines, (v) => updateSettings({ guideLines: v })),
      h('p', { class: 'hint' }, 'Put one edge of the page (or the fold of a book) on a line and the app finds the other sides.'),
      h('p', { class: 'hint' }, 'When off, pages keep the full image. You can still crop any page, or several at once, later.'),
      h('div', {}, h('div', { class: 'hint' }, 'Filter for new pages'),
        chips([{ id: 'original', label: 'Original' }, { id: 'enhanced', label: 'Enhanced' }], s.defaultFilter, (id) => updateSettings({ defaultFilter: id }))),
      h('div', { class: 'storage-box' },
        h('div', { class: 'hint' }, state.protectedStorage ? 'Your browser promises to keep your scans on this device.' : 'Your browser may delete saved scans if you do not open the app for a few days (iPhone does this unless the app is installed: Share → Add to Home Screen).'),
        h('button', { class: 'btn', type: 'button', onclick: () => void backupEverything() }, 'Back up everything (ZIP)')),
      h('p', { class: 'hint' }, `PDF Scanner ${__APP_VERSION__} (beta). Open source. Works offline; your documents never leave this device.`),
      h('p', { class: 'hint' }, 'Credits: icons are Material Symbols by Google (Apache License 2.0); PDF files are made with pdf-lib (MIT).'),
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: close }, 'Done')));
  }, 'Settings');
}
