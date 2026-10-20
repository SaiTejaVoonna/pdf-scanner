import { writeFileSync } from 'node:fs';

export interface Scene { name: string; page: { x: number; y: number } | null; /** frames to take sliding in from the left before it rests */ slide?: number; frames: number }

const W = 640, H = 480, FPS = 10, PW = 330, PH = 420;

/** A synthetic "phone video": a desk, then a page that slides in and rests, then the desk again, then a second page. Written as a y4m for Chromium's fake camera. */
export function writeVideo(file: string, scenes: Scene[]): number {
  const frames: Buffer[] = [];
  for (const sc of scenes) {
    for (let f = 0; f < sc.frames; f++) {
      const y = Buffer.alloc(W * H);
      let ox = sc.page?.x ?? 0;
      if (sc.page && sc.slide && f < sc.slide) ox -= Math.round((1 - f / sc.slide) * 260);
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const on = sc.page && c > ox && c < ox + PW && r > sc.page.y && r < sc.page.y + PH;
        const text = on && r > sc.page!.y + 40 && (r - sc.page!.y) % 26 < 8 && c > ox + 36 && c < ox + PW - 36 && ((c * 7 + r * 3) % 11) < 8;
        y[r * W + c] = text ? 55 : on ? 232 + (((c * 3 + r) % 5) - 2) : 78 + (((c * 5 + r * 3) % 9) - 4);
      }
      const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
      frames.push(Buffer.concat([Buffer.from('FRAME\n'), y, uv]));
    }
  }
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`), ...frames]));
  return scenes.reduce((n, s) => n + s.frames, 0) / FPS;
}
