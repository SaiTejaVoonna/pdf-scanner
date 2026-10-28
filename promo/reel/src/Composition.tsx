import { Composition } from 'remotion';
import { Reel } from './Reel';
import { DURATION, FPS } from './timeline';

// Instagram Reel, 9:16. `bgm` switches the background music; everything else is identical in both versions.
export const MyComposition = () => (
  <Composition id="Reel" component={Reel} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ bgm: true }} />
);
