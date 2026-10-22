import { askConfirm, h, openDialog, toast } from '../dom';
import * as store from '../store';
import { icon } from './icons';

const DAYS = 30;

/** "Recently deleted": documents stay here for a month and can be restored or deleted for good. */
export function openTrash(): void {
  openDialog((close) => {
    const body = h('div', { class: 'dlg trash' });
    const paint = () => {
      const docs = store.trashedDocs();
      body.replaceChildren(
        h('h2', {}, 'Recently deleted'),
        h('p', { class: 'hint' }, `Deleted documents stay here for ${DAYS} days, then they are removed for good.`),
        docs.length === 0 ? h('p', {}, 'Nothing here.') : h('ul', { class: 'trash-list' }, ...docs.map((d) => {
          const left = Math.max(0, DAYS - Math.floor((Date.now() - (d.deletedAt ?? 0)) / 86400000));
          return h('li', {}, h('div', {}, h('strong', {}, d.name), h('div', { class: 'hint' }, `${d.pages.length} page${d.pages.length === 1 ? '' : 's'} · ${left} day${left === 1 ? '' : 's'} left`)),
            h('button', { class: 'btn', type: 'button', onclick: () => { store.restoreDoc(d.id); toast(`"${d.name}" restored.`); } }, 'Restore'),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Delete ${d.name} for good`, onclick: async () => { if (await askConfirm('Delete for good?', `"${d.name}" and its photos will be removed from this device.`, 'Delete for good')) store.purgeDoc(d.id); } }, icon('trash')));
        })),
        h('div', { class: 'row end' },
          docs.length ? h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await askConfirm('Empty Recently deleted?', 'All of these documents will be removed for good.', 'Empty')) store.emptyTrash(); } }, 'Empty') : null,
          h('button', { class: 'btn primary', type: 'button', onclick: close }, 'Done')));
    };
    paint();
    const off = store.subscribe(() => { if (body.isConnected) paint(); else off(); });
    return body;
  }, 'Recently deleted');
}
