import { h, openDialog, toast } from '../dom';
import { canvasToBlob, normalize } from '../imaging';

/**
 * Live in-page camera. `onShot` receives each captured JPEG. If the browser blocks the camera the dialog says why
 * and the user can still use "Take photo" (the phone's own camera app) or import images.
 */
export function openCamera(onShot: (blob: Blob) => Promise<void>, fallback: () => void): void {
  let stream: MediaStream | null = null;
  let shots = 0;
  const video = h('video', { autoplay: true, playsinline: true, muted: true, 'aria-label': 'Camera preview' });
  const msg = h('div', { class: 'msg', hidden: true, role: 'alert' });
  const shutter = h('button', { class: 'shutter', 'aria-label': 'Capture page', disabled: true });
  const done = h('button', { class: 'btn' }, 'Done');
  const last = h('img', { class: 'last-shot', alt: '', hidden: true });
  const flash = h('div', { class: 'flash', 'aria-hidden': 'true' });
  let lastUrl = '';
  const stop = () => stream?.getTracks().forEach((t) => t.stop());

  const dialog = openDialog((close) => {
    done.addEventListener('click', close);
    shutter.addEventListener('click', async () => {
      if (!video.videoWidth) return;
      shutter.disabled = true;
      try {
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d')!.drawImage(video, 0, 0);
        const raw = await canvasToBlob(c, 'image/jpeg', 0.95);
        const { blob } = await normalize(raw);
        await onShot(blob);
        shots++;
        done.textContent = `Done (${shots})`;
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        last.src = lastUrl; last.alt = `Last captured page (page ${shots} of this session)`; last.hidden = false;
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        toast(`Page ${shots} saved. Take the next one, or tap Done.`);
      } catch { toast('Could not capture the photo. Please try again.'); }
      finally { shutter.disabled = false; }
    });
    return h('div', { class: 'camera' }, video, msg, flash,
      h('div', { class: 'controls' }, last, h('button', { class: 'btn', onclick: close }, 'Close'), shutter, done));
  }, 'Camera', () => { stop(); if (lastUrl) URL.revokeObjectURL(lastUrl); });
  dialog.classList.add('full');

  const fail = (text: string) => { msg.hidden = false; msg.textContent = text; shutter.disabled = true;
    msg.append(' ', h('button', { class: 'btn', onclick: () => { dialog.close(); fallback(); } }, 'Use phone camera instead')); };

  if (!navigator.mediaDevices?.getUserMedia) { fail('This browser cannot open the camera here (it needs a secure https page).'); return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
    .then((s) => { stream = s; video.srcObject = s; shutter.disabled = false; if (!dialog.open) stop(); })
    .catch((e: DOMException) => fail(e.name === 'NotAllowedError' ? 'Camera access was denied. Allow it in the browser settings, or use the phone camera.' : 'The camera could not be started.'));
}
