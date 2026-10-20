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
