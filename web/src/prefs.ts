/** Small remembered choices that live in the browser (not in the documents). Every read and write survives a blocked storage. */
const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: the choice just isn't remembered */ } };

const AUTO_KEY = 'pdf-scanner.auto', SPEED_KEY = 'pdf-scanner.autospeed';
export type Speed = 'fast' | 'normal' | 'careful';
export const SPEED_ORDER: Speed[] = ['fast', 'normal', 'careful'];

export const readPref = read;
export const writePref = write;
/** Auto-capture on the live camera (on unless switched off). */
export const getAuto = (): boolean => read(AUTO_KEY) !== 'off';
export const setAuto = (on: boolean): void => write(AUTO_KEY, on ? 'on' : 'off');
export const getSpeed = (): Speed => { const v = read(SPEED_KEY) ?? ''; return (SPEED_ORDER as string[]).includes(v) ? (v as Speed) : 'normal'; };
export const setSpeed = (s: Speed): void => write(SPEED_KEY, s);
