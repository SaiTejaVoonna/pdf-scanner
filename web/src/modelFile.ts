/**
 * Which weights file the app loads, relative to the app's base path. Engine v2 is `model/corners2.bin` (2.8 MB); engine v1,
 * `model/corners.bin` (1 MB), stays in the repository and works with the same code: change this one line to go back.
 * public/sw.js keeps a copy of the same file for offline use (tests/modelNet.test.ts checks that the two names match).
 */
export const MODEL_FILE = 'model/corners2.bin';
