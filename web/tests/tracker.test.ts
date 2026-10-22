import { describe, expect, it } from 'vitest';
import { AutoTracker, type Observation } from '../src/live/tracker';
import type { Quad } from '../src/core/geometry';

const box = (x: number, y: number, w = 0.6, h = 0.7): Quad => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const run = (tr: AutoTracker, obs: Observation[]) => obs.map((o) => tr.push(o));
const frames = (n: number, q: Quad | null, t0 = 0, dt = 100, sharp = 1000): Observation[] => Array.from({ length: n }, (_, i) => ({ t: t0 + i * dt, quad: q, sharp }));

describe('AutoTracker', () => {
  it('fires once after the page holds still, and not before', () => {
    const tr = new AutoTracker('normal');
    const r = run(tr, frames(12, box(0.2, 0.1)));
    const at = r.findIndex((x) => x.fire);
    expect(at).toBeGreaterThanOrEqual(5);
    expect(r.filter((x) => x.fire)).toHaveLength(1);
  });
  it('does not fire while the page is moving', () => {
    const tr = new AutoTracker('normal');
    const r = run(tr, Array.from({ length: 30 }, (_, i) => ({ t: i * 100, quad: box(0.1 + (i % 2) * 0.1, 0.1), sharp: 1000 })));
    expect(r.some((x) => x.fire)).toBe(false);
  });
  it('does not fire on a tiny outline or on nothing', () => {
    const tr = new AutoTracker();
    expect(run(tr, frames(20, box(0.4, 0.4, 0.2, 0.2))).some((x) => x.fire)).toBe(false);
    expect(run(new AutoTracker(), frames(20, null)).some((x) => x.fire)).toBe(false);
  });
  it('does not fire on blurry frames', () => {
    const tr = new AutoTracker('fast');
    const obs = [...frames(1, box(0.2, 0.1), 0, 100, 1000), ...frames(15, box(0.2, 0.1), 100, 100, 200)];
    expect(run(tr, obs).some((x) => x.fire)).toBe(false);
  });
  it('never fires on a run that is blurry throughout, even when nothing sharper was seen', () => {
    expect(run(new AutoTracker('fast'), frames(30, box(0.2, 0.1), 0, 100, 60)).some((x) => x.fire)).toBe(false);
  });
  it('a sharp frame after a blurry stretch does fire', () => {
    const tr = new AutoTracker('fast');
    expect(run(tr, [...frames(6, box(0.2, 0.1), 0, 100, 60), ...frames(10, box(0.2, 0.1), 600, 100, 900)]).some((x) => x.fire)).toBe(true);
  });
  it('faster speed fires sooner than careful', () => {
    const at = (s: 'fast' | 'careful') => run(new AutoTracker(s), frames(30, box(0.2, 0.1))).findIndex((x) => x.fire);
    expect(at('fast')).toBeLessThan(at('careful'));
  });
  it('captures the same page only once, then again after the page is turned away and back', () => {
    const tr = new AutoTracker('fast');
    const fires = (o: Observation[]) => run(tr, o).filter((x) => x.fire).length;
    expect(fires(frames(40, box(0.2, 0.1)))).toBe(1);               // 4 s on the same page: one shot
    expect(fires(frames(5, null, 4000))).toBe(0);                   // page leaves the view
    expect(fires(frames(10, box(0.2, 0.1), 4500))).toBe(1);         // next page
  });
  it('re-arms when the camera moves to a clearly different place without losing sight', () => {
    const tr = new AutoTracker('fast');
    run(tr, frames(10, box(0.05, 0.05)));
    expect(run(tr, frames(25, box(0.35, 0.2), 2000)).filter((x) => x.fire)).toHaveLength(1);
  });
});
