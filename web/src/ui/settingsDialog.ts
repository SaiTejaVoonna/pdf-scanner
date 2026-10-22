import { chips, h, openDialog } from '../dom';
import { state, updateSettings } from '../store';

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
      sw('Guide lines on the single-page camera', s.guideLines, (v) => updateSettings({ guideLines: v })),
      h('p', { class: 'hint' }, 'Put one edge of the page (or the fold of a book) on a line and the app finds the other sides.'),
      h('p', { class: 'hint' }, 'When off, pages keep the full image. You can still crop any page, or several at once, later.'),
      h('div', {}, h('div', { class: 'hint' }, 'Filter for new pages'),
        chips([{ id: 'original', label: 'Original' }, { id: 'enhanced', label: 'Enhanced' }], s.defaultFilter, (id) => updateSettings({ defaultFilter: id }))),
      h('p', { class: 'hint' }, `PDF Scanner ${__APP_VERSION__} (beta). Open source. Works offline; your documents never leave this device.`),
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: close }, 'Done')));
  }, 'Settings');
}
