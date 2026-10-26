import { askConfirm, h, openDialog, toast } from '../dom';
import * as store from '../store';
import { icon } from './icons';

const DAYS = 30;

/** "Recently deleted": PDFs and drafts stay here for a month and can be restored or deleted for good. */
export function openTrash(): void {
  const dlg = openDialog((close) => {
    const body = h('div', { class: 'trash' });
    const paint = () => {
      const docs = store.trashedDocs();
      body.replaceChildren(
        h('div', { class: 'nav' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', onclick: close }, icon('chevron-left', 26)),
          h('div', { class: 'titles' }, h('strong', {}, 'Recently deleted'), h('small', {}, `Kept for ${DAYS} days`)), h('span', { style: 'width:44px' })),
        h('div', { style: 'padding-top:16px' },
          docs.length === 0 ? h('p', { class: 'hint', style: 'text-align:center;padding:40px 20px' }, 'Nothing here.') : h('ul', { class: 'group trash-list' }, ...docs.map((d) => {
            const left = Math.max(0, DAYS - Math.floor((Date.now() - (d.deletedAt ?? 0)) / 86400000));
            const n = d.pages.length;
            return h('li', { class: 'row' }, h('span', { class: 'thumb-mini' }, icon('document', 22)),
              h('div', { class: 'grow' }, h('strong', {}, d.name), h('small', {}, `${n} page${n === 1 ? '' : 's'} · ${left} day${left === 1 ? '' : 's'} left`)),
              h('button', { class: 'btn', type: 'button', onclick: () => { store.restoreDoc(d.id); toast(`"${d.name}" restored.`); } }, 'Restore'),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Delete ${d.name} for good`, onclick: async () => { if (await askConfirm('Delete for good?', `"${d.name}" and its photos will be removed from this device.`, 'Delete for good')) store.purgeDoc(d.id); } }, icon('trash', 22)));
          })),
          docs.length ? h('div', { style: 'padding:0 16px' }, h('button', { class: 'btn danger wide', type: 'button', onclick: async () => { if (await askConfirm('Empty Recently deleted?', 'All of these documents will be removed for good.', 'Empty')) store.emptyTrash(); } }, 'Empty')) : null,
          h('div', { style: 'padding:12px 16px' }, h('button', { class: 'btn primary wide', type: 'button', onclick: close }, 'Done'))));
    };
    paint();
    const off = store.subscribe(() => { if (body.isConnected) paint(); else off(); });
    return body;
  }, 'Recently deleted');
  dlg.classList.add('full');
}
