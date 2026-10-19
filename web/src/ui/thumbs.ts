import { canvasToBlob, renderPage } from '../imaging';
import type { PageModel } from '../store';

const thumbs = new Map<string, Promise<string>>();
const thumbKey = (p: PageModel) => `${p.id}|${p.rotation}|${p.filter}|${p.w}x${p.h}|${p.corners.map((c) => `${c.x.toFixed(4)},${c.y.toFixed(4)}`).join(';')}`;

/** Small JPEG preview of a page as it will be exported (cached per page edit). */
export function thumbUrl(p: PageModel): Promise<string> {
  const key = thumbKey(p);
  let hit = thumbs.get(key);
  if (!hit) {
    hit = renderPage(p, 360).then((c) => canvasToBlob(c, 'image/jpeg', 0.8)).then((b) => URL.createObjectURL(b));
    thumbs.set(key, hit);
  }
  return hit;
}
