/**
 * The app's icon set: simple outline icons drawn for this project on a 24x24 grid (2px-ish round strokes, no fills), so they
 * look the same on every phone and take the surrounding text colour (light and dark mode just work). No font, no download.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

export const ICON_PATHS = {
  scan: ['M4 8V6a2 2 0 0 1 2-2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M20 16v2a2 2 0 0 1-2 2h-2', 'M8 20H6a2 2 0 0 1-2-2v-2', 'M8 9h8', 'M7 12h10', 'M8 15h8'],
  camera: ['M4 9a2 2 0 0 1 2-2h1.6l1.1-1.6A1 1 0 0 1 9.5 5h5a1 1 0 0 1 .8.4L16.4 7H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'],
  image: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M4 17l5-5 4 4 2-2 5 5'],
  combine: ['M4 9a2 2 0 0 1 2-2h6l4 4v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M12 7v4h4', 'M8 5V4a1 1 0 0 1 1-1h6.5L20 7.5V14a1 1 0 0 1-1 1h-1'],
  resize: ['M4 9h5V4', 'M20 9h-5V4', 'M4 15h5v5', 'M20 15h-5v5'],
  gear: ['M12 3.5l1.3 2.1a6.7 6.7 0 0 1 1.8.8l2.4-.5 1.7 2.9-1.6 1.8c.1.6.1 1.1 0 1.7l1.6 1.8-1.7 2.9-2.4-.5a6.7 6.7 0 0 1-1.8.8L12 20.5l-1.3-2.1a6.7 6.7 0 0 1-1.8-.8l-2.4.5-1.7-2.9 1.6-1.8a6.4 6.4 0 0 1 0-1.7L4.8 9.9l1.7-2.9 2.4.5a6.7 6.7 0 0 1 1.8-.8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  trash: ['M4 7h16', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12', 'M10 11v6', 'M14 11v6'],
  lock: ['M6 11h12v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  document: ['M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'],
  more: [],
  'chevron-right': ['M9 6l6 6-6 6'],
  'chevron-left': ['M15 6l-6 6 6 6'],
  'arrow-left': ['M19 12H5', 'M11 6l-6 6 6 6'],
  'arrow-up': ['M12 19V5', 'M6 11l6-6 6 6'],
  'arrow-down': ['M12 5v14', 'M6 13l6 6 6-6'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  rotate: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
} as const;

export type IconName = keyof typeof ICON_PATHS;
export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

/** An <svg> icon; decorative (aria-hidden), the button or text around it carries the name. */
export function icon(name: IconName, size = 24): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', `icon icon-${name}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of ICON_PATHS[name]) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  if (name === 'more') {
    for (const cy of [6, 12, 18]) {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', '12'); c.setAttribute('cy', String(cy)); c.setAttribute('r', '1.6'); c.setAttribute('fill', 'currentColor');
      svg.append(c);
    }
  }
  return svg;
}
