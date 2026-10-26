type Child = Node | string | null | false | undefined;

/** Tiny hyperscript helper: h('button', { class: 'btn', onclick: fn, 'aria-label': 'x' }, 'Text'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'hidden' || key === 'selected') (el as unknown as Record<string, unknown>)[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const c of children) if (c !== null && c !== false && c !== undefined) el.append(c);
  return el;
}

/**
 * Shows a short message. Modal dialogs live in the browser's top layer and would hide a toast placed in the
 * page, so the toast goes inside the topmost open dialog when there is one.
 */
export function toast(message: string, action?: { label: string; run: () => void }): void {
  const open = [...document.querySelectorAll('dialog[open]')];
  const container: Element = open.length ? open[open.length - 1] : document.body;
  let host = container.querySelector(':scope > .toasts');
  if (!host) { host = h('div', { class: 'toasts', 'aria-live': 'polite', role: 'status' }); container.append(host); }
  const t = h('div', { class: 'toast' }, message);
  if (action) t.append(h('button', { class: 'toast-action', type: 'button', onclick: () => { t.remove(); action.run(); } }, action.label));
  host.append(t);
  setTimeout(() => { t.remove(); if (host && !host.childElementCount) host.remove(); }, action ? 9000 : 6000);
}

/** Opens a modal <dialog> built by `build`; removed from the DOM when closed. `close(value)` resolves nothing special. */
export function openDialog(build: (close: () => void) => HTMLElement, label: string, onClosed?: () => void): HTMLDialogElement {
  const dialog = h('dialog', { 'aria-label': label });
  const close = () => dialog.close();
  dialog.append(build(close));
  dialog.addEventListener('close', () => { dialog.remove(); onClosed?.(); });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

/**
 * A bottom sheet (menus and small tasks): a frosted card that slides up on a phone and sits in the middle on a wide screen.
 * `build` returns what goes inside; tapping the dimmed area closes it.
 */
export function openSheet(build: (close: () => void) => Node | Node[], label: string, onClosed?: () => void): HTMLDialogElement {
  const dialog = h('dialog', { class: 'sheetdlg', 'aria-label': label });
  const close = () => dialog.close();
  const sheet = h('div', { class: 'sheet', tabindex: '-1', autofocus: true }, h('div', { class: 'grab', 'aria-hidden': 'true' }));
  const content = build(close);
  sheet.append(...(Array.isArray(content) ? content : [content]));
  dialog.append(sheet);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { dialog.remove(); onClosed?.(); });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

/** One tappable row of a sheet: an icon, a label, and what happens (the sheet closes first). */
export function sheetItem(icon: Node, label: string, run: () => void, close: () => void, danger = false): HTMLButtonElement {
  return h('button', { class: `item${danger ? ' danger' : ''}`, type: 'button', onclick: () => { close(); run(); } }, icon, label);
}

/** Shares a file with the phone's share sheet where the browser allows it; otherwise saves it. */
export async function shareFile(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
  try {
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return; }
  } catch (e) { if ((e as DOMException).name === 'AbortError') return; }
  download(blob, filename, blob.type);
  toast('Sharing files is not supported here, so the PDF was saved instead.');
}

export function chips<T extends string>(items: { id: T; label: string }[], current: T, onPick: (id: T) => void, disabled = false): HTMLElement {
  const wrap = h('div', { class: 'chips', role: 'radiogroup' });
  const buttons = items.map((it) => {
    const b = h('button', {
      type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(it.id === current), disabled,
      onclick: () => { buttons.forEach((x, i) => x.setAttribute('aria-checked', String(items[i].id === it.id))); onPick(it.id); },
    }, it.label);
    return b;
  });
  wrap.append(...buttons);
  return wrap;
}

export function download(bytes: Uint8Array | Blob, filename: string, type = 'application/pdf'): void {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const formatBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** An in-app question with two buttons (the browser's own pop-ups can be blocked or hidden on phones). Resolves true on the main button. */
export function askConfirm(title: string, text: string, ok = 'Delete', danger = true): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    openDialog((close) => h('div', { class: 'dlg' }, h('h2', {}, title), h('p', {}, text),
      h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: close }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => { answer = true; close(); } }, ok))), title, () => resolve(answer));
  });
}

/** An in-app text prompt. Resolves with the text, or null when cancelled. */
export function askText(title: string, value: string, ok = 'Save'): Promise<string | null> {
  return new Promise((resolve) => {
    let answer: string | null = null;
    openDialog((close) => {
      const input = h('input', { type: 'text', value, maxlength: '100', 'aria-label': title });
      const save = () => { answer = input.value; close(); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      setTimeout(() => { input.focus(); input.select(); }, 0);
      return h('div', { class: 'dlg' }, h('h2', {}, title), h('label', { class: 'field' }, input),
        h('div', { class: 'row end' }, h('button', { class: 'btn', type: 'button', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', type: 'button', onclick: save }, ok)));
    }, title, () => resolve(answer));
  });
}
