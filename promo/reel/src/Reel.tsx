import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { Backdrop, C, Captions, EASE, Phone, ScreenStack, SCREEN, Tap, fontFamily, useCam } from './parts';
import { BEATS, DURATION, SCENES, SFX, VOICE } from './timeline';
import L from './layout.json';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const mid = (k: keyof typeof L) => ({ x: L[k].x + L[k].width / 2, y: L[k].y + L[k].height / 2 });
const CAPTION_TOP = 1352;

/** 1 · Hook: a real phone-style photo of a page, then the flat page the app produced from it. */
const Hook: React.FC = () => {
  const f = useCurrentFrame(), t = BEATS.hookFlatten;
  const flat = interpolate(f, [t, t + 16], [0, 1], { ...clamp, easing: EASE });
  return (
    <AbsoluteFill style={{ backgroundColor: '#2a2018' }}>
      <Img src={staticFile('photo-report.jpg')} style={{ position: 'absolute', left: -180, top: 0, width: 1440, height: 1920, filter: 'blur(40px) brightness(.7)' }} />
      <Img src={staticFile('photo-report.jpg')} style={{ position: 'absolute', left: 0, top: 200, width: 1080, height: 1440, boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        scale: String(interpolate(f, [0, t], [0.96, 1.02], clamp)), filter: `blur(${flat * 10}px) brightness(${1 - flat * 0.45})` }} />
      <div style={{ position: 'absolute', left: 540 - 380, top: 300, width: 760, opacity: flat,
        rotate: `${(1 - flat) * -5}deg`, scale: String(0.9 + 0.1 * flat), boxShadow: '0 40px 80px rgba(0,0,0,.45)' }}>
        <Img src={staticFile('pdf/trim-1.png')} style={{ width: '100%', display: 'block' }} />
      </div>
    </AbsoluteFill>
  );
};

/** 2 · Add the photo: the phone rises, Import photos is tapped, the page lands in the document. */
const Add: React.FC = () => {
  const f = useCurrentFrame();
  const cam = useCam([{ f: 0, z: 1, fx: 195, fy: 422 }, { f: 22, z: 1, fx: 195, fy: 422 }, { f: 34, z: 1.32, fx: 195, fy: 404 }, { f: 48, z: 1.32, fx: 195, fy: 300 }, { f: 80, z: 1.08, fx: 195, fy: 300 }]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0' }}>
        <Phone style={{ translate: `0px ${interpolate(f, [0, 24], [1300, 0], { ...clamp, easing: EASE })}px` }}>
          <ScreenStack shots={[{ src: '01-home', at: 0 }, { src: '02-pages-1', at: BEATS.addSwap }]} />
          <Tap {...mid('import')} at={BEATS.addTap} />
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 3 · Crop: Auto finds the edges (real result), then a corner is nudged (real drag, frame by frame). */
const Crop: React.FC = () => {
  const f = useCurrentFrame(), d = BEATS.cropDragStart;
  const drag = Array.from({ length: 12 }, (_, i) => ({ src: `05-drag-${String(i + 1).padStart(2, '0')}`, at: d + i * 2 }));
  const cam = useCam([{ f: 0, z: 1.08, fx: 195, fy: 300 }, { f: 24, z: 1.18, fx: 195, fy: 420 }, { f: 50, z: 1.18, fx: 195, fy: 380 }, { f: 64, z: 1.95, fx: 80, fy: 520 }, { f: 104, z: 1.95, fx: 80, fy: 520 }, { f: 134, z: 1.1, fx: 195, fy: 380 }]);
  const c = mid('cornerBL'), p = interpolate(f, [d, d + 24], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0' }}>
        <Phone>
          <ScreenStack fade={3} shots={[{ src: '03-editor-full', at: 0 }, { src: '04-editor-auto', at: BEATS.cropAuto + 4 }, ...drag, { src: '06-editor-after-drag', at: d + 26 }]} />
          <Tap {...mid('auto')} at={BEATS.cropAuto} />
          {f >= d - 6 && f <= d + 30 && (
            <div style={{ position: 'absolute', left: (c.x - 7 * p) * 1.4 - 30, top: (c.y + 5 * p) * 1.4 - 30, width: 60, height: 60, borderRadius: 99, background: 'rgba(255,255,255,.5)', border: '3px solid rgba(53,82,217,.9)', boxShadow: '0 6px 16px rgba(0,0,0,.3)', opacity: interpolate(f, [d - 6, d, d + 24, d + 30], [0, 1, 1, 0], clamp) }} />
          )}
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 4 · Look: Enhanced is tapped and the page brightens (both states are real screenshots, revealed with a wipe). */
const Look: React.FC = () => {
  const f = useCurrentFrame(), t = BEATS.lookTap;
  const wipe = interpolate(f, [t + 2, t + 22], [0, 100], { ...clamp, easing: EASE });
  const cam = useCam([{ f: 0, z: 1.12, fx: 195, fy: 470 }, { f: 30, z: 1.12, fx: 195, fy: 520 }, { f: 52, z: 1.5, fx: 195, fy: 330 }, { f: 120, z: 1.58, fx: 195, fy: 330 }]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0' }}>
        <Phone>
          <Img src={staticFile('shots/07-look-original.png')} style={{ position: 'absolute', inset: 0, width: SCREEN.w, height: SCREEN.h }} />
          <Img src={staticFile('shots/08-look-enhanced.png')} style={{ position: 'absolute', inset: 0, width: SCREEN.w, height: SCREEN.h, clipPath: `inset(0 ${100 - wipe}% 0 0)` }} />
          {wipe > 0 && wipe < 100 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${wipe}%`, width: 3, background: 'rgba(255,255,255,.9)', boxShadow: '0 0 18px 4px rgba(255,255,255,.6)' }} />}
          <Tap {...mid('enhanced')} at={t} />
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 5 · More pages: three pages, then a book spread imported as pages 4–5. */
const Pages: React.FC = () => {
  const f = useCurrentFrame(), r = BEATS.pagesResult;
  const cam = useCam([{ f: 0, z: 1.05, fx: 195, fy: 400 }, { f: 40, z: 1.05, fx: 195, fy: 420 }, { f: 70, z: 1.05, fx: 195, fy: 420 }, { f: 92, z: 1.45, fx: 195, fy: 610 }, { f: 126, z: 1.5, fx: 195, fy: 610 }]);
  const ring = interpolate(f, [r + 14, r + 26], [0, 1], { ...clamp, easing: EASE });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0' }}>
        <Phone>
          <ScreenStack shots={[{ src: '09-pages-3', at: 0 }, { src: '10-add-spread', at: BEATS.pagesAdd + 6 }, { src: '12-pages-spread', at: r }]} />
          <Tap {...mid('addPages')} at={BEATS.pagesAdd} />
          <Tap {...mid('importImages')} at={BEATS.pagesSpread} />
          <div style={{ position: 'absolute', left: 14 * 1.4, top: 487 * 1.4, width: 362 * 1.4, height: 246 * 1.4, borderRadius: 18, border: `5px solid ${C.acc}`, opacity: ring, scale: String(1.04 - 0.04 * ring), boxShadow: '0 0 0 8px rgba(53,82,217,.15)' }} />
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 6 · Save: size choices with real estimates, Create PDF, PDF saved. */
const Save: React.FC = () => {
  const f = useCurrentFrame();
  const cam = useCam([{ f: 0, z: 1.25, fx: 195, fy: 520 }, { f: 40, z: 1.25, fx: 195, fy: 560 }, { f: 62, z: 1.55, fx: 195, fy: 600 }, { f: 104, z: 1.6, fx: 195, fy: 600 }]);
  const out = interpolate(f, [90, 104], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ ...cam, transformOrigin: '0 0', opacity: 1 - out }}>
        <Phone>
          <ScreenStack shots={[{ src: '13-make-pdf', at: 0 }, { src: '14-pdf-saved', at: BEATS.saveDone - 4 }]} />
          <Tap {...mid('create')} at={BEATS.saveTap} />
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 7 · Outro: the real PDF pages, then the name, what it is, and where to get it. */
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const page = (src: string, i: number, x: number, rot: number) => {
    const p = interpolate(f, [8 + i * 5, 34 + i * 5], [0, 1], { ...clamp, easing: EASE });
    return (
      <div key={src} style={{ position: 'absolute', left: 540 + x - 210, top: 210, width: 420, opacity: p, rotate: `${rot * p}deg`, translate: `0px ${(1 - p) * 120}px`, boxShadow: '0 30px 60px rgba(28,34,70,.25)', borderRadius: 4, overflow: 'hidden' }}>
        <Img src={staticFile(`pdf/${src.replace('page', 'trim')}.png`)} style={{ width: '100%', display: 'block' }} />
      </div>
    );
  };
  const brand = interpolate(f, [104, 120], [0, 1], { ...clamp, easing: EASE });
  const line2 = interpolate(f, [114, 130], [0, 1], { ...clamp, easing: EASE });
  return (
    <AbsoluteFill>
      {page('page-2', 0, -200, -9)}
      {page('page-3', 1, 200, 9)}
      {page('page-1', 2, 0, 0)}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 800, display: 'flex', justifyContent: 'center', opacity: interpolate(f, [40, 54], [0, 1], clamp) }}>
        <div style={{ fontFamily, fontSize: 40, fontWeight: 600, color: C.ink, background: 'rgba(255,255,255,.85)', borderRadius: 99, padding: '14px 30px', boxShadow: '0 8px 22px rgba(28,34,70,.12)' }}>Physics notes.pdf · 5 pages</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 920, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, opacity: brand, translate: `0px ${(1 - brand) * 30}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Img src={staticFile('app-icon.png')} style={{ width: 104, height: 104, borderRadius: 26, boxShadow: '0 10px 24px rgba(28,34,70,.2)' }} />
          <div style={{ fontFamily, fontSize: 96, fontWeight: 800, letterSpacing: -2.5, color: C.ink }}>PDF Scanner</div>
        </div>
        <div style={{ fontFamily, fontSize: 46, fontWeight: 600, color: C.mut, opacity: line2 }}>Free · Works offline · Private</div>
        <div style={{ fontFamily, fontSize: 42, fontWeight: 700, color: C.acc, background: C.accSoft, borderRadius: 99, padding: '14px 32px', opacity: line2 }}>saitejavoonna.github.io/pdf-scanner</div>
      </div>
    </AbsoluteFill>
  );
};

/** Music sits low and dips under the voice; `bgm=false` renders the same edit without it. */
const Music: React.FC = () => {
  const talking = (f: number) => VOICE.some((v) => f >= v.from - 6 && f <= v.from + v.sec * 30 + 6);
  return (
    <Audio src={staticFile('music/house-vibez.mp3')} trimBefore={0} volume={(f) => {
      const fade = interpolate(f, [0, 20, DURATION - 40, DURATION], [0, 1, 1, 0], clamp);
      return fade * (talking(f) ? 0.11 : 0.2);
    }} />
  );
};

export const Reel: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Backdrop />
    <Sequence name="1 Hook" from={SCENES.hook.from} durationInFrames={SCENES.hook.dur}><Hook /></Sequence>
    <Sequence name="2 Add photo" from={SCENES.add.from} durationInFrames={SCENES.add.dur}><Add /></Sequence>
    <Sequence name="3 Crop" from={SCENES.crop.from} durationInFrames={SCENES.crop.dur}><Crop /></Sequence>
    <Sequence name="4 Look" from={SCENES.look.from} durationInFrames={SCENES.look.dur}><Look /></Sequence>
    <Sequence name="5 Pages" from={SCENES.pages.from} durationInFrames={SCENES.pages.dur}><Pages /></Sequence>
    <Sequence name="6 Save" from={SCENES.save.from} durationInFrames={SCENES.save.dur}><Save /></Sequence>
    <Sequence name="7 Outro" from={SCENES.outro.from} durationInFrames={SCENES.outro.dur}><Outro /></Sequence>
    <Captions top={CAPTION_TOP} />
    {VOICE.map((v) => (
      <Sequence key={v.id} name={`Voice: ${v.id}`} from={v.from} durationInFrames={Math.ceil(v.sec * 30) + 2}>
        <Audio src={staticFile(`voice/af_heart-${v.id}.wav`)} volume={1} />
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
