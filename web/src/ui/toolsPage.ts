import { h } from '../dom';
import { openCombine } from './combineDialog';
import { openCompress } from './compressDialog';
import { icon, type IconName } from './icons';
import { openResize } from './resizeDialog';
import { openSplit } from './splitDialog';

const TOOLS: { name: string; note: string; icon: IconName; color: string; open: () => void }[] = [
  { name: 'Compress PDF', note: 'Make a scanned PDF smaller', icon: 'compress', color: '#3552d9', open: () => openCompress() },
  { name: 'Resize photo', note: 'Exact size or KB for forms', icon: 'resize', color: '#8a5cf0', open: openResize },
  { name: 'Combine PDFs', note: 'Join PDFs in order', icon: 'combine', color: '#2fa84f', open: openCombine },
  { name: 'Split PDF', note: 'Keep pages or save each one', icon: 'split', color: '#e08a1e', open: openSplit },
];

/** The Tools tab: tools that work on files you already have. Everything runs on this device. */
export function buildTools(): HTMLElement {
  return h('div', { class: 'tools-page' },
    h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'Tools')),
    h('p', { class: 'page-sub' }, 'Work on a PDF or a photo. Nothing leaves this device.'),
    h('div', { class: 'tool-grid' }, ...TOOLS.map((t) => h('button', { class: 'tool-tile', type: 'button', onclick: t.open },
      h('span', { class: 'tool-ic', style: `background:${t.color}` }, icon(t.icon, 24)),
      h('span', {}, h('strong', {}, t.name), h('span', { class: 'hint' }, t.note))))));
}
