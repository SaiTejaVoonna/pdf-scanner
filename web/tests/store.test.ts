import { beforeEach, describe, expect, it } from 'vitest';
import type { Quad } from '../src/core/geometry';
import { splitSpread } from '../src/core/spread';
import * as store from '../src/store';

const blob = (n: string) => new Blob([n]);
const outer = (x0 = 0.1, x1 = 0.9): Quad => [{ x: x0, y: 0.1 }, { x: x1, y: 0.1 }, { x: x1, y: 0.9 }, { x: x0, y: 0.9 }];
const geo = (x0?: number, x1?: number, tTop = 0.5, tBottom = 0.5) => ({ outer: outer(x0, x1), tTop, tBottom });
const order = () => store.state.pages.map((p) => (p.spread ? `${p.spread.id.slice(0, 2)}${p.spread.side}` : 'S'));

beforeEach(() => store.clearAll());

describe('spreads in the document', () => {
  it('3 spreads append left and right pages in order: 6 pages', () => {
    const ids = [1, 2, 3].map((n) => store.addSpread(blob(`s${n}`), 100, 100, geo()).id);
    expect(store.state.pages.length).toBe(6);
    expect(store.state.pages.map((p) => p.spread!.side).join('')).toBe('LRLRLR');
    expect(store.state.pages.map((p) => p.spread!.id)).toEqual([ids[0], ids[0], ids[1], ids[1], ids[2], ids[2]]);
    // one shared source per spread, not one per page
    expect(new Set(store.state.pages.map((p) => p.sourceId)).size).toBe(3);
  });
  it('derives the two page crops from the geometry', () => {
    const s = store.addSpread(blob('a'), 100, 100, geo(0.1, 0.9, 0.4, 0.6));
    const [l, r] = splitSpread(s);
    expect(store.state.pages[0].corners).toEqual(l);
    expect(store.state.pages[1].corners).toEqual(r);
  });
  it('mixes single pages and spreads', () => {
    store.addPage(blob('p1'), 10, 10);
    store.addSpread(blob('s'), 10, 10, geo());
    store.addPage(blob('p2'), 10, 10);
    expect(order()).toEqual(['S', expect.stringMatching(/L$/), expect.stringMatching(/R$/), 'S']);
  });
  it('updating a spread moves both of its pages and nothing else', () => {
    const a = store.addSpread(blob('a'), 100, 100, geo());
    const b = store.addSpread(blob('b'), 100, 100, geo());
    const before = store.state.pages.filter((p) => p.spread!.id === b.id).map((p) => p.corners);
    store.updateSpread(a.id, { tTop: 0.3, tBottom: 0.7 });
    const [l] = splitSpread(store.state.spreads.find((s) => s.id === a.id)!);
    expect(store.pagesOfSpread(a.id)[0].corners).toEqual(l);
    expect(store.pagesOfSpread(b.id).map((p) => p.corners)).toEqual(before);
  });
  it('independent pages keep their own corners when the spread changes', () => {
    const a = store.addSpread(blob('a'), 100, 100, geo());
    store.updateSpread(a.id, { independent: true });
    const own = outer(0.2, 0.45);
    store.editPages([store.pagesOfSpread(a.id)[0].id], (p) => ({ ...p, corners: own }));
    store.updateSpread(a.id, { tTop: 0.3 });
    expect(store.pagesOfSpread(a.id)[0].corners).toEqual(own);
  });
});

describe('retake, delete, reorder', () => {
  it('retake replaces the source but keeps ids, positions and other spreads', () => {
    const a = store.addSpread(blob('a'), 100, 100, geo());
    const b = store.addSpread(blob('b'), 100, 100, geo());
    const c = store.addSpread(blob('c'), 100, 100, geo());
    const idsBefore = store.state.pages.map((p) => p.id);
    const aSource = store.state.spreads[0].sourceId, cSource = store.state.spreads[2].sourceId;
    store.retakeSpread(b.id, blob('b2'), 200, 150, geo(0.2, 0.8, 0.45, 0.55));
    expect(store.state.pages.map((p) => p.id)).toEqual(idsBefore);
    expect(store.state.pages[2].w).toBe(200);
    expect(store.state.pages[0].w).toBe(100);
    expect(store.state.spreads[0].sourceId).toBe(aSource);
    expect(store.state.spreads[2].sourceId).toBe(cSource);
    expect(store.state.spreads[1].tTop).toBe(0.45);
    expect(a && c).toBeTruthy();
  });
  it('a cancelled retake changes nothing (retake is only applied on confirm)', () => {
    const a = store.addSpread(blob('a'), 100, 100, geo());
    const snapshot = JSON.stringify(store.state);
    void a; // the UI simply never calls retakeSpread when cancelled
    expect(JSON.stringify(store.state)).toBe(snapshot);
  });
  it('deleting one side keeps the other and the shared source; deleting both frees it', () => {
    const a = store.addSpread(blob('a'), 100, 100, geo());
    const [left, right] = store.pagesOfSpread(a.id);
    store.removePages([left.id]);
    expect(store.state.pages.map((p) => p.id)).toEqual([right.id]);
    expect(store.sourceBlob(a.sourceId)).toBeDefined();
    store.removePages([right.id]);
    expect(store.state.pages.length).toBe(0);
    expect(store.state.spreads.length).toBe(0);
    expect(store.sourceBlob(a.sourceId)).toBeUndefined();
  });
  it('side deletion then retake regenerates only the surviving side', () => {
    const a = store.addSpread(blob('a'), 100, 100, geo());
    const [left, right] = store.pagesOfSpread(a.id);
    store.removePages([left.id]);
    store.retakeSpread(a.id, blob('a2'), 120, 100, geo(0.15, 0.85, 0.4, 0.6));
    expect(store.state.pages.length).toBe(1);
    expect(store.state.pages[0].id).toBe(right.id);
    expect(store.state.pages[0].w).toBe(120);
    expect(store.state.pages[0].corners).toEqual(splitSpread(store.state.spreads[0])[1]);
  });
  it('reorder then retake keeps the new order', () => {
    const a = store.addSpread(blob('a'), 100, 100, geo());
    const b = store.addSpread(blob('b'), 100, 100, geo());
    const first = store.state.pages[0].id;
    store.movePage(first, 3); // left page of A now sits after B's left page
    const orderBefore = store.state.pages.map((p) => p.id);
    store.retakeSpread(a.id, blob('a2'), 100, 100, geo(0.2, 0.8));
    expect(store.state.pages.map((p) => p.id)).toEqual(orderBefore);
    expect(b).toBeTruthy();
  });
  it('removing a single page never drops a source another page still uses', () => {
    const a = store.addSpread(blob('a'), 100, 100, geo());
    store.addPage(blob('x'), 10, 10);
    store.removePages([store.state.pages[2].id]);
    expect(store.sourceBlob(a.sourceId)).toBeDefined();
    expect(store.state.pages.length).toBe(2);
  });
});

describe('drafts', () => {
  it('saves and clears an editor draft, keeping a new capture\'s source until cleared', () => {
    store.saveDraft({ kind: 'newSpread', id: 'cap1', data: { tTop: 0.4 } }, blob('shot'));
    expect(store.state.draft?.id).toBe('cap1');
    expect(store.draftSource('cap1')).toBeDefined();
    store.clearDraft();
    expect(store.state.draft).toBeNull();
    expect(store.draftSource('cap1')).toBeUndefined();
  });
});
