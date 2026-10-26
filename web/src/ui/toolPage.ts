import { h } from '../dom';
import { icon } from './icons';

/** A full-screen page for one tool: a back arrow and the tool's name on top, the controls below. */
export function toolPage(title: string, close: () => void, ...content: (Node | null)[]): HTMLElement {
  return h('div', { class: 'toolpage' },
    h('div', { class: 'nav' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, icon('chevron-left', 26)), h('div', { class: 'titles' }, h('strong', {}, title)), h('span', { style: 'width:44px' })),
    h('div', { class: 'toolbody dlg' }, ...content));
}
