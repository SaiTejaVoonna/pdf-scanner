import { h, openDialog } from '../dom';
import { openCombine } from './combineDialog';
import { openCompress } from './compressDialog';
import { icon, type IconName } from './icons';
import { openResize } from './resizeDialog';
import { openSplit } from './splitDialog';

const TOOLS: { name: string; note: string; icon: IconName; open: () => void }[] = [
  { name: 'Compress PDF', note: 'Make a scanned PDF smaller', icon: 'compress', open: openCompress },
  { name: 'Resize photo', note: 'Exact size or KB for forms', icon: 'resize', open: openResize },
  { name: 'Combine PDFs', note: 'Join PDFs in order', icon: 'combine', open: openCombine },
  { name: 'Split PDF', note: 'Keep pages or save each one', icon: 'split', open: openSplit },
];

/** The tools that work on files you already have (PDFs and photos). Everything runs on this device. */
export function openTools(): void {
  openDialog((close) => h('div', { class: 'dlg tools-hub' }, h('h2', {}, 'Tools'), h('p', { class: 'hint' }, 'Work on a PDF or a photo. Nothing leaves this device.'),
    h('div', { class: 'tool-grid' }, ...TOOLS.map((t) => h('button', { class: 'tool-tile', type: 'button', onclick: () => { close(); t.open(); } },
      h('span', { class: 'tool-ic' }, icon(t.icon, 28)), h('strong', {}, t.name), h('span', { class: 'hint' }, t.note)))),
    h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: close }, 'Close'))), 'Tools');
}
