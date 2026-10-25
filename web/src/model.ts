import { CornerNet } from './modelNet';

/** The model file's bytes, fetched once on first use. Resolves null (the app then uses the rules alone) when it is missing or broken. */
let bytes: Promise<ArrayBuffer | null> | null = null;
export function loadModelBytes(): Promise<ArrayBuffer | null> {
  bytes ??= (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}model/corners.bin`);
      return res.ok ? await res.arrayBuffer() : null;
    } catch { return null; }
  })();
  return bytes;
}

/** The network on this thread (used only when there is no background worker). */
let net: Promise<CornerNet | null> | null = null;
export function loadModel(): Promise<CornerNet | null> {
  net ??= loadModelBytes().then((b) => { try { return b ? new CornerNet(b.slice(0)) : null; } catch { return null; } });
  return net;
}
