import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/fonts';
import words from './words.json';
import { VOICE } from './timeline';

// Inter (SIL OFL 1.1), bundled locally so rendering needs no network. One variable file covers every weight.
export const fontFamily = 'Inter';
loadFont({ family: fontFamily, url: staticFile('InterVariable.woff2'), weight: '100 900' });

// Colours taken from the app's own tokens (web/src/style.css): calm paper background, one blue accent.
export const C = { bg: '#f4f3f0', ink: '#1c1c1e', mut: '#6f7076', acc: '#3552d9', accSoft: 'rgba(53,82,217,.12)' };
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** The app's soft tinted backdrop (same radial tints as the app's --tint). */
export const Backdrop: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg, backgroundImage: 'radial-gradient(70% 38% at 0% 0%, #d6e3ff 0%, transparent 62%), radial-gradient(60% 34% at 100% 6%, #fde6d4 0%, transparent 62%), radial-gradient(80% 40% at 50% 110%, #e4e9fb 0%, transparent 70%)' }} />
);

// Phone geometry: the app screenshots are 390 x 844 CSS px (captured at 3x).
export const K = 1.4; // canvas px per CSS px at zoom 1
export const SCREEN = { w: 390 * K, h: 844 * K };
const BEZEL = 14;
export const PHONE = { x: (1080 - SCREEN.w) / 2 - BEZEL, y: 104 };
export const SCREEN_X = PHONE.x + BEZEL, SCREEN_Y = PHONE.y + BEZEL;

type CamKey = { f: number; z: number; fx: number; fy: number };
/** A gentle 2.5D camera: zoom `z` toward the screen point (fx, fy) in CSS px; keys are eased in and out. */
export const useCam = (keys: CamKey[]) => {
  const f = useCurrentFrame();
  const at = (k: keyof CamKey) => keys.length === 1 ? keys[0][k] : interpolate(f, keys.map((x) => x.f), keys.map((x) => x[k]), { ...clamp, easing: EASE_IO });
  const z = at('z'), px = SCREEN_X + at('fx') * K, py = SCREEN_Y + at('fy') * K;
  const pull = Math.min(1, Math.max(0, (z - 1) / 0.7));
  const tx = px + (540 - px) * pull, ty = py + (800 - py) * pull;
  return { translate: `${tx - px * z}px ${ty - py * z}px`, scale: String(z) };
};

/** Crossfades between real app screenshots: each entry shows from frame `at` (relative to the scene). */
export const ScreenStack: React.FC<{ shots: { src: string; at: number }[]; fade?: number }> = ({ shots, fade = 6 }) => {
  const f = useCurrentFrame();
  return (
    <>
      {shots.map((s, i) => {
        const next = shots[i + 1];
        const opacity = i === 0 ? 1 : interpolate(f, [s.at, s.at + fade], [0, 1], clamp);
        if (next && f > next.at + fade) return null;
        return <Img key={s.src} src={staticFile(`shots/${s.src}.png`)} style={{ position: 'absolute', inset: 0, width: SCREEN.w, height: SCREEN.h, opacity }} />;
      })}
    </>
  );
};

/** The phone body; children are laid out in screen CSS px scaled by K (so taps line up with layout.json). */
export const Phone: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: 'absolute', left: PHONE.x, top: PHONE.y, width: SCREEN.w + BEZEL * 2, height: SCREEN.h + BEZEL * 2, borderRadius: 74, background: '#0e0e10', boxShadow: '0 50px 90px rgba(28,34,70,.28), 0 12px 28px rgba(28,34,70,.18), inset 0 0 0 2px #2a2a2e', ...style }}>
    <div style={{ position: 'absolute', left: BEZEL, top: BEZEL, width: SCREEN.w, height: SCREEN.h, borderRadius: 60, overflow: 'hidden', background: '#fff' }}>
      {children}
    </div>
  </div>
);

/** A finger tap at (x, y) screen CSS px: a soft press dot with one ring. */
export const Tap: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const f = useCurrentFrame();
  if (f < at - 6 || f > at + 20) return null;
  const press = interpolate(f, [at - 6, at, at + 6, at + 14], [0, 1, 1, 0], clamp);
  const ring = interpolate(f, [at, at + 18], [0.6, 1.9], { ...clamp, easing: EASE });
  const ringO = interpolate(f, [at, at + 18], [0.55, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: x * K, top: y * K, width: 0, height: 0 }}>
      <div style={{ position: 'absolute', left: -34, top: -34, width: 68, height: 68, borderRadius: 99, background: 'rgba(255,255,255,.55)', border: '3px solid rgba(53,82,217,.85)', opacity: press, scale: String(0.8 + 0.2 * press), boxShadow: '0 4px 14px rgba(0,0,0,.25)' }} />
      <div style={{ position: 'absolute', left: -34, top: -34, width: 68, height: 68, borderRadius: 99, border: '4px solid #3552d9', opacity: ringO, scale: String(ring) }} />
    </div>
  );
};

type Line = { id: string; from: number; sec: number };
type Words = Record<string, { w: string; s: number; e: number }[]>;
/** Word-by-word captions for the voice line that is playing (timings measured from the generated voice). */
export const Captions: React.FC<{ top: number; voice?: readonly Line[]; wordsFor?: Words }> = ({ top, voice = VOICE, wordsFor = words as Words }) => {
  const f = useCurrentFrame();
  // The latest line that has started wins, so a quick next line replaces the previous caption instead of waiting for it to fade.
  const line = [...voice].reverse().find((v) => f >= v.from - 4 && f <= v.from + v.sec * 30 + 12);
  if (!line) return null;
  const t = (f - line.from) / 30;
  const ws = wordsFor[line.id];
  const enter = interpolate(f, [line.from - 4, line.from + 4], [0, 1], clamp);
  const leave = interpolate(f, [line.from + line.sec * 30 + 4, line.from + line.sec * 30 + 12], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top, display: 'flex', justifyContent: 'center', opacity: Math.min(enter, leave), translate: `0px ${(1 - enter) * 14}px` }}>
      <div style={{ fontFamily, fontSize: 58, lineHeight: 1.18, fontWeight: 700, textAlign: 'center', letterSpacing: -0.6, color: C.ink, textWrap: 'balance' as never,
        background: 'rgba(255,255,255,.9)', borderRadius: 30, padding: '18px 34px', boxShadow: '0 10px 30px rgba(28,34,70,.14)' }}>
        {ws.map((w, i) => {
          const cur = ws.reduce((k, x, j) => (t >= x.s - 0.04 ? j : k), -1);
          const on = i <= cur, now = i === cur;
          return <span key={i} style={{ color: now ? C.acc : on ? C.ink : 'rgba(28,28,30,.32)' }}>{w.w}{i < ws.length - 1 ? ' ' : ''}</span>;
        })}
      </div>
    </div>
  );
};
