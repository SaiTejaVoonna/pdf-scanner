import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { Backdrop, C, Captions, EASE, Phone, SCREEN, Tap, fontFamily, useCam } from '../parts';
import { AT, DURATION, SCENES, SFX, VOICE } from './timeline';
import L from './layout.json';
import CAM from './camseq.json';
import words from './words.json';

// Every app screen here is the real web app (promo/capture/capture2.cjs); the camera part is a frame-by-frame recording of the
// app's live outline and auto-capture (capture-cam-video.cjs). The app is never named: the name is revealed later.
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const mid = (k: keyof typeof L) => ({ x: L[k].x + L[k].width / 2, y: L[k].y + L[k].height / 2 });
const rel = (scene: keyof typeof SCENES, abs: number) => abs - SCENES[scene].from;
const CAPTION_TOP = 1352;
const shot = (name: string) => staticFile(`v2/shots/${name}.png`);

/** Crossfades between real screenshots; each shows from frame `at` (relative to the scene). */
const Stack: React.FC<{ shots: { src: string; at: number }[]; fade?: number }> = ({ shots, fade = 6 }) => {
  const f = useCurrentFrame();
  return (
    <>
      {shots.map((s, i) => {
        const next = shots[i + 1];
        if (next && f > next.at + fade) return null;
        const opacity = i === 0 ? 1 : interpolate(f, [s.at, s.at + fade], [0, 1], clamp);
        return <Img key={s.src} src={shot(s.src)} style={{ position: 'absolute', inset: 0, width: SCREEN.w, height: SCREEN.h, opacity }} />;
      })}
    </>
  );
};

/** 1 · Hook: a crooked phone photo of a page, held up (slight handheld drift). */
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const out = interpolate(f, [62, 80], [0, 1], { ...clamp, easing: EASE });
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a2018', opacity: 1 - out }}>
      <Img src={staticFile('v2/photo-report.jpg')} style={{ position: 'absolute', left: -180, top: 0, width: 1440, height: 1920, filter: 'blur(40px) brightness(.7)' }} />
      <Img src={staticFile('v2/photo-report.jpg')} style={{ position: 'absolute', left: 60, top: 230, width: 960, height: 1280, borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,.5)',
        rotate: `${-3 + Math.sin(f / 14) * 0.8}deg`, translate: `${Math.sin(f / 11) * 6}px ${Math.cos(f / 13) * 8}px`, scale: String(interpolate(f, [0, 70], [0.94, 1.02], clamp) + out * 0.2) }} />
    </AbsoluteFill>
  );
};

// Real camera frames: reel frames are mapped to recording time. Real time up to the outline, then the "hold steady" part
// runs 1.25x slower so the auto-capture lands on "straightens it", then real time again.
const T_TAP = 0.7, T_OUTLINE = 1.6, T_CAPTURED = 3.06, SLOW = 1.25;
const camTime = (r: number) => {
  const tapR = rel('camera', AT.scanTap), outR = tapR + (T_OUTLINE - T_TAP) * 30, capR = outR + (T_CAPTURED - T_OUTLINE) * 30 * SLOW;
  if (r < tapR) return T_TAP - 0.02;
  if (r < outR) return T_TAP + (r - tapR) / 30;
  if (r < capR) return T_OUTLINE + (r - outR) / 30 / SLOW;
  return T_CAPTURED + (r - capR) / 30;
};
const CamFrames: React.FC = () => {
  const t = camTime(useCurrentFrame());
  let i = CAM.findIndex((c) => c.t > t); if (i < 0) i = CAM.length - 1;
  const a = CAM[Math.max(0, i - 1)], b = CAM[i];
  const mix = b.t === a.t ? 1 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const img = (c: typeof a, o: number) => <Img key={c.f} src={staticFile(`v2/cam/${c.f}.jpg`)} style={{ position: 'absolute', inset: 0, width: SCREEN.w, height: SCREEN.h, opacity: o }} />;
  return <>{img(a, 1)}{img(b, mix)}</>;
};

/** 2+3 · Open the app, tap Scan, the live outline finds the page, auto-capture, and the page flies out straight. */
const Camera: React.FC = () => {
  const f = useCurrentFrame(), s = rel('camera', AT.straighten);
  const cam = useCam([{ f: 0, z: 1, fx: 195, fy: 422 }, { f: 30, z: 1, fx: 195, fy: 470 }, { f: 40, z: 1.12, fx: 195, fy: 640 }, { f: 52, z: 1.1, fx: 195, fy: 400 }, { f: 110, z: 1.18, fx: 195, fy: 380 }]);
  const p = interpolate(f, [s, s + 22], [0, 1], { ...clamp, easing: EASE });
  const out = interpolate(f, [148, 158], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0' }}>
        <Phone style={{ translate: `0px ${interpolate(f, [0, 24], [1300, 0], { ...clamp, easing: EASE })}px` }}>
          <CamFrames />
          <Tap {...mid('scan')} at={rel('camera', AT.scanTap)} />
          <div style={{ position: 'absolute', inset: 0, background: `rgba(14,14,16,${0.55 * p})` }} />
        </Phone>
      </AbsoluteFill>
      {f >= s && (
        // The real first page of the exported PDF (cropped, straightened, Enhanced), coming off the tilted page in the viewfinder
        <div style={{ position: 'absolute', left: 540 - 330, top: interpolate(p, [0, 1], [540, 330]), width: 660, rotate: `${(1 - p) * -3}deg`, scale: String(0.62 + 0.38 * p), opacity: interpolate(f, [s, s + 4], [0, 1], clamp),
          boxShadow: '0 40px 90px rgba(0,0,0,.45)', borderRadius: 6, overflow: 'hidden' }}>
          <Img src={staticFile('v2/pdf/trim-1.png')} style={{ width: '100%', display: 'block' }} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/** 4 · Look: one tap on Enhanced (both states are real screenshots, revealed with a wipe). */
const Look: React.FC = () => {
  const f = useCurrentFrame(), t = rel('look', AT.enhancedTap);
  const wipe = interpolate(f, [t + 2, t + 22], [0, 100], { ...clamp, easing: EASE });
  const cam = useCam([{ f: 0, z: 1.05, fx: 195, fy: 430 }, { f: 14, z: 1.05, fx: 195, fy: 470 }, { f: 44, z: 1.42, fx: 195, fy: 330 }, { f: 100, z: 1.5, fx: 195, fy: 330 }]);
  return (
    <AbsoluteFill style={{ opacity: interpolate(f, [0, 8], [0, 1], clamp) }}>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0' }}>
        <Phone>
          <Img src={shot('04-look-original')} style={{ position: 'absolute', inset: 0, width: SCREEN.w, height: SCREEN.h }} />
          <Img src={shot('05-look-enhanced')} style={{ position: 'absolute', inset: 0, width: SCREEN.w, height: SCREEN.h, clipPath: `inset(0 ${100 - wipe}% 0 0)` }} />
          {wipe > 0 && wipe < 100 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${wipe}%`, width: 3, background: 'rgba(255,255,255,.9)', boxShadow: '0 0 18px 4px rgba(255,255,255,.6)' }} />}
          <Tap {...mid('enhanced')} at={t} />
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 5 · More pages, then a book spread imported as pages 4–5. */
const Pages: React.FC = () => {
  const f = useCurrentFrame(), r = rel('pages', AT.spreadIn);
  const cam = useCam([{ f: 0, z: 1.05, fx: 195, fy: 400 }, { f: 30, z: 1.05, fx: 195, fy: 420 }, { f: r, z: 1.05, fx: 195, fy: 420 }, { f: r + 18, z: 1.45, fx: 195, fy: 610 }, { f: 122, z: 1.5, fx: 195, fy: 610 }]);
  const ring = interpolate(f, [r + 14, r + 26], [0, 1], { ...clamp, easing: EASE });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0' }}>
        <Phone>
          <Stack shots={[{ src: '06-pages-3', at: 0 }, { src: '07-add-spread', at: rel('pages', AT.addTap) + 6 }, { src: '08-pages-spread', at: r }]} />
          <Tap {...mid('addPages')} at={rel('pages', AT.addTap)} />
          <Tap {...mid('importImages')} at={rel('pages', AT.importTap)} />
          <div style={{ position: 'absolute', left: 14 * 1.4, top: 487 * 1.4, width: 362 * 1.4, height: 246 * 1.4, borderRadius: 18, border: `5px solid ${C.acc}`, opacity: ring, scale: String(1.04 - 0.04 * ring), boxShadow: '0 0 0 8px rgba(53,82,217,.15)' }} />
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 6 · Size: the app's estimate for every quality, pick the one under 200 KB, Create PDF, saved. Then the real page: no watermark. */
const Size: React.FC = () => {
  const f = useCurrentFrame(), q = rel('size', AT.qualityTap), pg = rel('size', AT.pdfPage);
  const cam = useCam([{ f: 0, z: 1.1, fx: 195, fy: 520 }, { f: 26, z: 1.5, fx: 195, fy: 600 }, { f: q + 10, z: 1.5, fx: 195, fy: 620 }, { f: q + 22, z: 1.3, fx: 195, fy: 640 }, { f: 140, z: 1.3, fx: 195, fy: 600 }]);
  const pp = interpolate(f, [pg - 4, pg + 18], [0, 1], { ...clamp, easing: EASE });
  const out = interpolate(f, [184, 196], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0' }}>
        <Phone>
          <Stack shots={[{ src: '09-make-pdf', at: 0 }, { src: '10-make-pdf-picked', at: q + 2 }, { src: '11-pdf-saved', at: rel('size', AT.saved) - 4 }]} />
          <Tap {...mid('quality')} at={q} />
          <Tap {...mid('create')} at={rel('size', AT.createTap)} />
        </Phone>
      </AbsoluteFill>
      {f >= pg - 4 && (
        <AbsoluteFill style={{ background: `rgba(244,243,240,${0.75 * pp})` }}>
          <div style={{ position: 'absolute', left: 540 - 300, top: 170, width: 600, opacity: pp, translate: `0px ${(1 - pp) * 220}px`, rotate: `${(1 - pp) * 4}deg`, boxShadow: '0 30px 70px rgba(28,34,70,.28)', borderRadius: 6, overflow: 'hidden' }}>
            <Img src={staticFile('v2/pdf/trim-1.png')} style={{ width: '100%', display: 'block' }} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** 7 · Tools: each tile lights up on its word, then a quick real result: a photo resized under 50 KB. */
const Tools: React.FC = () => {
  const f = useCurrentFrame(), r = rel('tools', AT.resize);
  const keys = ['tCompress', 'tResize', 'tCombine', 'tSplit'] as const;
  const cam = useCam([{ f: 0, z: 1.25, fx: 195, fy: 220 }, { f: r - 4, z: 1.3, fx: 195, fy: 200 }, { f: r + 8, z: 1.9, fx: 195, fy: 585 }, { f: 128, z: 1.95, fx: 195, fy: 590 }]);
  return (
    <AbsoluteFill style={{ opacity: interpolate(f, [0, 8], [0, 1], clamp) }}>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0' }}>
        <Phone>
          <Stack shots={[{ src: '12-tools', at: 0 }, { src: '14-resize-done', at: r }]} />
          {f < r && keys.map((k, i) => {
            const t = rel('tools', AT.tiles[i]), on = interpolate(f, [t - 2, t + 4, t + 16], [0, 1, 0.55], clamp);
            return <div key={k} style={{ position: 'absolute', left: L[k].x * 1.4, top: L[k].y * 1.4, width: L[k].width * 1.4, height: L[k].height * 1.4, borderRadius: 26, border: `5px solid ${C.acc}`, opacity: on, scale: String(1.06 - 0.06 * on) }} />;
          })}
          {/* The real result row: 579 KB -> 49 KB */}
          <div style={{ position: 'absolute', left: 14 * 1.4, top: 612 * 1.4, width: 362 * 1.4, height: 50 * 1.4, borderRadius: 18, border: `4px solid ${C.acc}`, opacity: interpolate(f, [r + 10, r + 18], [0, 1], clamp) }} />
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Icon: React.FC<{ d: string }> = ({ d }) => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={C.acc} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICONS = {
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.6-3.4 3.4-5.5 7-5.5M15.5 16.5l4 4m0-4-4 4',
  phone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5ZM10.5 18.5h3M9.5 11V9.5a2.5 2.5 0 0 1 5 0V11M9 11h6v4H9z',
  offline: 'M2 8.5a15 15 0 0 1 4.3-2.6M9.6 5.1A15 15 0 0 1 22 8.5M5 12a10 10 0 0 1 3.3-2M15 10.2A10 10 0 0 1 19 12M8.5 15.5a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18',
};

/** 8 · Privacy: three calm rows, each on its words. */
const Privacy: React.FC = () => {
  const f = useCurrentFrame();
  const row = (at: number, icon: keyof typeof ICONS, title: string, note: string, i: number) => {
    const p = interpolate(f, [rel('privacy', at) - 2, rel('privacy', at) + 14], [0, 1], { ...clamp, easing: EASE });
    return (
      <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 34, padding: '34px 40px', borderTop: i ? '2px solid rgba(28,28,30,.07)' : 'none', opacity: p, translate: `${(1 - p) * 40}px 0px` }}>
        <div style={{ width: 104, height: 104, borderRadius: 30, background: C.accSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon d={ICONS[icon]} /></div>
        <div><div style={{ fontFamily, fontSize: 54, fontWeight: 750, color: C.ink, letterSpacing: -1 }}>{title}</div><div style={{ fontFamily, fontSize: 36, fontWeight: 500, color: C.mut, marginTop: 4 }}>{note}</div></div>
      </div>
    );
  };
  const enter = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: EASE });
  const out = interpolate(f, [150, 162], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - out) }}>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 360, background: 'rgba(255,255,255,.92)', borderRadius: 48, boxShadow: '0 30px 80px rgba(28,34,70,.14)', translate: `0px ${(1 - enter) * 60}px` }}>
        {row(AT.rowAccount, 'account', 'No account', 'Open it and start', 0)}
        {row(AT.rowPhone, 'phone', 'Stays on your phone', 'Nothing is uploaded', 1)}
        {row(AT.rowOffline, 'offline', 'Works offline', 'Even with no signal', 2)}
      </div>
    </AbsoluteFill>
  );
};

/** 9 · End card: no name yet, just the icon, what it costs, what's coming, and where the link is. */
const End: React.FC = () => {
  const f = useCurrentFrame();
  const a = interpolate(f, [2, 18], [0, 1], { ...clamp, easing: EASE });
  const b = interpolate(f, [rel('end', 958) - 2, rel('end', 958) + 14], [0, 1], { ...clamp, easing: EASE });
  const c = interpolate(f, [rel('end', 1008) - 4, rel('end', 1008) + 12], [0, 1], { ...clamp, easing: EASE });
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 380 }}>
      <Img src={staticFile('app-icon.png')} style={{ width: 220, height: 220, borderRadius: 54, boxShadow: '0 24px 60px rgba(28,34,70,.25)', opacity: a, scale: String(0.8 + 0.2 * a) }} />
      <div style={{ fontFamily, fontSize: 150, fontWeight: 850, letterSpacing: -5, color: C.ink, marginTop: 50, opacity: a, translate: `0px ${(1 - a) * 30}px` }}>Free.</div>
      <div style={{ fontFamily, fontSize: 54, fontWeight: 650, color: C.mut, marginTop: 10, opacity: b, translate: `0px ${(1 - b) * 20}px` }}>Android app coming soon</div>
      <div style={{ fontFamily, fontSize: 50, fontWeight: 750, color: C.acc, background: C.accSoft, borderRadius: 99, padding: '18px 44px', marginTop: 46, opacity: c, scale: String(0.9 + 0.1 * c) }}>Link in bio ↓</div>
    </AbsoluteFill>
  );
};

const Music: React.FC = () => {
  const talking = (f: number) => VOICE.some((v) => f >= v.from - 6 && f <= v.from + v.sec * 30 + 6);
  return (
    <Audio src={staticFile('music/house-vibez.mp3')} trimBefore={0} volume={(f) => {
      const fade = interpolate(f, [0, 20, DURATION - 40, DURATION], [0, 1, 1, 0], clamp);
      return fade * (talking(f) ? 0.11 : 0.2);
    }} />
  );
};

const seq = (name: string, k: keyof typeof SCENES, el: React.ReactNode) => <Sequence name={name} from={SCENES[k].from} durationInFrames={SCENES[k].dur}>{el}</Sequence>;

export const Reel2: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Backdrop />
    {seq('1 Hook', 'hook', <Hook />)}
    {seq('2 Camera', 'camera', <Camera />)}
    {seq('3 Look', 'look', <Look />)}
    {seq('4 Pages', 'pages', <Pages />)}
    {seq('5 Size', 'size', <Size />)}
    {seq('6 Tools', 'tools', <Tools />)}
    {seq('7 Privacy', 'privacy', <Privacy />)}
    {seq('8 End', 'end', <End />)}
    <Captions top={CAPTION_TOP} voice={VOICE} wordsFor={words} />
    {VOICE.map((v) => (
      <Sequence key={v.id} name={`Voice: ${v.id}`} from={v.from} durationInFrames={Math.ceil(v.sec * 30) + 2}>
        <Audio src={staticFile(`v2/voice/af_heart-${v.id}.wav`)} volume={1} />
      </Sequence>
    ))}
    {SFX.map((s, i) => (
      <Sequence key={i} name={`SFX: ${s.note}`} from={s.from} durationInFrames={s.cut}>
        <Audio src={staticFile(`sfx/${s.src}`)} volume={s.volume} />
      </Sequence>
    ))}
    {bgm && <Music />}
  </AbsoluteFill>
);
