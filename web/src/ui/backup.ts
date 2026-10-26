import { zipStore, type ZipEntry } from '../core/zip';
import { download, toast } from '../dom';
import { currentDoc, liveDocs, pdfBlob, sourceBlob } from '../store';
import { safeFileName } from '../core/pdf';

/** One ZIP with every document's original photos and saved PDFs, so nothing depends on the browser keeping its storage. */
export async function backupEverything(): Promise<void> {
  currentDoc(); // make sure the open document is up to date
  const docs = liveDocs();
  if (docs.length === 0) { toast('Nothing to back up yet.'); return; }
  const entries: ZipEntry[] = [];
  const used = new Set<string>();
  const unique = (name: string) => { let n = name, i = 2; while (used.has(n)) n = `${name} (${i++})`; used.add(n); return n; };
  try {
    for (const d of docs) {
      const folder = unique(safeFileName(d.name, 'Document'));
      const sources = [...new Set(d.pages.map((p) => p.sourceId))];
      let n = 1;
      for (const id of sources) { const b = sourceBlob(id); if (b) entries.push({ name: `${folder}/photo-${String(n++).padStart(3, '0')}.jpg`, data: new Uint8Array(await b.arrayBuffer()) }); }
      for (const e of d.exports) { const b = pdfBlob(e.id); if (b) entries.push({ name: `${folder}/${safeFileName(e.name)}.pdf`, data: new Uint8Array(await b.arrayBuffer()) }); }
    }
    download(zipStore(entries), `PDF Scanner backup ${new Date().toISOString().slice(0, 10)}.zip`, 'application/zip');
    toast('Backup saved.');
  } catch (e) { toast('Backup failed.'); }
}
