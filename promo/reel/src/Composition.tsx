import { Composition } from 'remotion';
import { Reel } from './Reel';
import { DURATION, FPS } from './timeline';
import { Reel2 } from './v2/Reel2';
import { DURATION as DURATION2 } from './v2/timeline';

// Instagram Reels, 9:16. `bgm` switches the background music; everything else is identical in both versions.
// "Reel" is the first reel; "Reel2" is the second (scanner first, then size and tools; the app is not named).
export const MyComposition = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ bgm: true }} />
    <Composition id="Reel2" component={Reel2} durationInFrames={DURATION2} fps={FPS} width={1080} height={1920} defaultProps={{ bgm: true }} />
  </>
);
