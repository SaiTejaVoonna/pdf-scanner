import { h } from '../dom';
import { icon, type IconName } from './icons';

/** A full-screen page for one tool: a back arrow and the tool's name on top, the controls below. */
export function toolPage(title: string, close: () => void, ...content: (Node | null)[]): HTMLElement {
  return h('div', { class: 'toolpage' },
    h('div', { class: 'nav' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, icon('chevron-left', 26)), h('div', { class: 'titles' }, h('h2', { class: 'ttl' }, title)), h('span', { style: 'width:44px' })),
    h('div', { class: 'toolbody dlg' }, ...content));
}

/** The "choose a file" card at the top of a tool page: an icon, what it is, a line about the current choice, and "Change". */
export function fileCard(ic: IconName, title: string, sub: Node | string, onclick: () => void, action = 'Choose'): HTMLElement {
  return h('button', { class: 'fcard frost', type: 'button', onclick },
    h('span', { class: 'ico' }, icon(ic, 22)), h('span', { class: 'grow' }, h('b', {}, title), sub instanceof Node ? sub : h('small', {}, sub)), h('span', { class: 'chg' }, action));
}
