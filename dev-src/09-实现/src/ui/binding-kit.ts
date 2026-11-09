// 装订套件 · Binding kit (replaces the 0.37 octo-kit).
// Every surface is a part of a book: leather covers, paper pages, brass fittings, ribbons, bookplates, fore-edge
// index tabs, marginalia, errata slips and colophon stamps. Ornament stays on frames and edges; text and numbers
// sit on quiet paper and are read first. SVG pieces are inline data URIs (offline-safe); textures arrive as CSS
// custom properties (`--bk-tex-*`) that fall back to these drawings until the raster tiles are ready.
import {BINDING_ART} from './art-binding';

const svg = (body: string, box = '0 0 24 24', extra = '') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${box}'${extra}>${body}</svg>`)}")`;

/** Functional colours (see 设计/方向-booksea.md): one job each, never decoration. */
export const BK = {
  leather: '#5b1f1c', leatherDeep: '#3a1412', cloth: '#22344d', clothDeep: '#152234', velvet: '#6c1520', velvetDeep: '#2a080c',
  page: '#efe3c8', page2: '#e6d6b4', pageEdge: '#d6c29c', card: '#f6ecd6',
  ink: '#23180f', ink2: '#5e4b3a', ink3: '#6b5644', rule: 'rgba(35,24,15,.22)',
  brass: '#b58b4c', brassHi: '#dcb878', brassDeep: '#6e4e26',
  ribbon: '#b3262b', ribbonDeep: '#8a1a1f', ribbonHi: '#d0454a',
  errata: '#f2e2a0', blot: '#7a1f1a', marbleA: '#2e4a6b', marbleB: '#c08a3e',
  green: '#3f6b48', blue: '#2f5277', night: '#140c09',
} as const;

/** Display type for titles and labels only (subset fonts arrive later; system serifs are the fallback). */
export const BK_DISPLAY = `'Booksea Display','Noto Serif CJK SC','Noto Serif SC','Source Han Serif SC','Source Han Serif CN','Songti SC','STSong','SimSun',serif`;
/** Latin set only where a printed book carries Latin: ex libris, plate numbers, colophons. */
export const BK_LATIN = `'Booksea Latin','IM Fell English','P052','Palatino Linotype','Book Antiqua',Palatino,Georgia,serif`;
/** Reading text: system Song/Ming faces. Player text and long descriptions always use this or the sans. */
export const BK_SERIF = `'Noto Serif CJK SC','Noto Serif SC','Source Han Serif SC','Songti SC','STSong','SimSun',serif`;
export const BK_SANS = `'Noto Sans CJK SC','Noto Sans SC','PingFang SC','Microsoft YaHei','Source Han Sans SC',system-ui,sans-serif`;
/** Numbers set like lead type: old-style serif figures, tabular so columns line up. */
export const BK_FIGURES = `'Booksea Latin','IM Fell English',Georgia,'Times New Roman',serif`;

// ---- texture fallbacks (tiny procedural tiles; the raster textures replace them via --bk-tex-*) ----
export const BK_GRAIN = svg(`<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .38  0 0 0 0 .3  0 0 0 0 .2  0 0 0 .12 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/>`, '0 0 200 200', " width='200' height='200'");
export const BK_HIDE = svg(`<filter id='h'><feTurbulence type='fractalNoise' baseFrequency='.35' numOctaves='4' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .1  0 0 0 0 .03  0 0 0 0 .02  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(#h)'/>`, '0 0 220 220', " width='220' height='220'");

// ---- brass corner protector (top-left; mirror with transforms) ----
const cornerBody = (t: string) => `<defs><linearGradient id='b' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#efd394'/><stop offset='.42' stop-color='#b58b4c'/><stop offset='1' stop-color='#6e4e26'/></linearGradient></defs><g transform='${t}'><path d='M0 0H54L41 13H13V41L0 54Z' fill='url(#b)' stroke='#43290f' stroke-width='1.3'/><path d='M4.5 4.5H45L38 9.5H9.5V38L4.5 45Z' fill='none' stroke='#fbe6b0' stroke-opacity='.5'/><path d='M18 13c6 2.5 10 6 12.5 12M13 18c2.5 6 6 10 12 12.5' fill='none' stroke='#4f3517' stroke-width='1.3' stroke-linecap='round'/><circle cx='9' cy='9' r='3.2' fill='#f3dca0' stroke='#4f3517' stroke-width='.9'/><circle cx='8.2' cy='8.2' r='1' fill='#fff6d8'/></g>`;
export const BK_CORNERS = {
  tl: svg(cornerBody(''), '0 0 60 60'),
  tr: svg(cornerBody('matrix(-1 0 0 1 60 0)'), '0 0 60 60'),
  bl: svg(cornerBody('matrix(1 0 0 -1 0 60)'), '0 0 60 60'),
  br: svg(cornerBody('matrix(-1 0 0 -1 60 60)'), '0 0 60 60'),
};
/** Four brass corners over a cover fill, for one `background` declaration (covers only, never pages). */
export function brassCorners(size = 34, inset = -2) {
  const c = BK_CORNERS, at = (x: string, y: string) => `${x} ${inset}px ${y} ${inset}px/${size}px ${size}px no-repeat`;
  return `${c.tl} ${at('left', 'top')},${c.tr} ${at('right', 'top')},${c.bl} ${at('left', 'bottom')},${c.br} ${at('right', 'bottom')}`;
}

// ---- manicule ☞ : the printer's pointing hand marks the current line ----
const maniculeBody = (fill: string) => `<path fill='${fill}' d='M1.5 6.5h7v11h-7z'/><path fill='${fill}' d='M8.5 7.4c2.6-1 5.6-1.9 8.6-1.9h17.2c1.5 0 2.7.9 2.7 2.1s-1.2 2.1-2.7 2.1H21.6c1.7.4 2.3 1.3 2.3 2.3 0 1.1-.9 1.9-2.4 1.9h-.8c1.4.4 1.9 1.3 1.9 2.1 0 1-.9 1.7-2.3 1.7h-1.1c1.1.4 1.4 1.1 1.4 1.8 0 .9-.8 1.6-2.1 1.6h-6.7c-1.6 0-3.3-.6-3.3-1.6z'/><path fill='none' stroke='${fill === '#fff' ? '#23180f' : '#f3e6c8'}' stroke-width='.7' stroke-opacity='.6' d='M3.5 8.5v7M5.5 8.5v7M21 10.6h-6M20.2 14.2h-5M18.8 17.7h-4'/>`;
export const BK_MANICULE = svg(maniculeBody('#23180f'), '0 0 38 24');
export const BK_MANICULE_LIGHT = svg(maniculeBody('#f1dfb4'), '0 0 38 24');

// ---- printer's ornaments ----
const hedera = (fill: string) => `<path fill='${fill}' d='M12 21C6.5 17.6 3 14.4 3 10.2 3 6.6 5.7 4.2 8.6 4.2c1.6 0 2.7.7 3.4 1.7.7-1 1.8-1.7 3.4-1.7 2.9 0 5.6 2.4 5.6 6 0 4.2-3.5 7.4-9 10.8z'/><path fill='none' stroke='${fill}' stroke-width='1.3' stroke-linecap='round' d='M12 5.6C12 3.4 13.4 1.8 15.6 1.4'/><path fill='none' stroke='#f3e6c8' stroke-opacity='.55' stroke-width='.8' d='M12 7.6v10.8M12 11.5l-3-2M12 14l3-2.2'/>`;
export const BK_FLEURON = svg(hedera('#5e4b3a'), '0 0 24 24');
export const BK_FLEURON_LIGHT = svg(hedera('#cdb27a'), '0 0 24 24');
/** Thick-thin rule with a hedera leaf in the middle: chapter breaks and page heads. */
export const BK_RULE = svg(`<path d='M0 5.5h104M0 8h104M136 5.5h104M136 8h104' stroke='#5e4b3a' stroke-width='.8'/><path d='M8 6.75h92M140 6.75h92' stroke='#5e4b3a' stroke-width='1.6' stroke-opacity='.25'/><g transform='translate(110 -3) scale(.85)'>${hedera('#5e4b3a')}</g>`, '0 0 240 14');
export const BK_RULE_LIGHT = svg(`<path d='M0 5.5h104M0 8h104M136 5.5h104M136 8h104' stroke='#cdb27a' stroke-width='.8'/><g transform='translate(110 -3) scale(.85)'>${hedera('#cdb27a')}</g>`, '0 0 240 14');

// ---- bookplate (ex libris) frame: double rule drawn with box-shadows, flourishes in the corners ----
const plateCorner = (t: string, c: string) => `<g transform='${t}' fill='none' stroke='${c}' stroke-linecap='round'><path d='M2 20V8Q2 2 8 2h12' stroke-width='1.1'/><path d='M6 14c0-5 3-8 8-8' stroke-width='.8'/><path d='M7.5 7.5c2.4 2.4 2.4 5.2 0 7.6M7.5 7.5c2.4 2.4 5.2 2.4 7.6 0' stroke-width='.7'/></g>`;
export function plateCorners(color: string = BK.ink2, size = 18, inset = 3) {
  const c = (t: string) => svg(plateCorner(t, color), '0 0 24 24');
  const at = (x: string, y: string) => `${x} ${inset}px ${y} ${inset}px/${size}px ${size}px no-repeat`;
  return `${c('')} ${at('left', 'top')},${c('matrix(-1 0 0 1 24 0)')} ${at('right', 'top')},${c('matrix(1 0 0 -1 0 24)')} ${at('left', 'bottom')},${c('matrix(-1 0 0 -1 24 24)')} ${at('right', 'bottom')}`;
}

// ---- inked rubber stamps wear unevenly: a speckle mask for stamp boxes ----
export const BK_STAMP_WEAR = svg(`<filter id='w'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75'/></filter><rect width='100%' height='100%' filter='url(#w)'/>`, '0 0 160 160', " width='160' height='160'");
/** A soaked ink blot with satellite drops (defeat page). */
export const BK_BLOT = svg(`<path fill='#4a1210' d='M101 22c18 3 24 22 37 25 15 4 32-6 40 8 7 13-9 24-6 38 3 15 23 22 17 37-6 16-28 9-39 19-12 11-9 33-26 36-17 2-23-19-38-22-15-4-32 8-42-5-9-13 7-26 3-41-4-14-25-21-20-36 5-15 27-11 38-20 11-10 15-32 36-39z'/><circle cx='186' cy='34' r='6' fill='#4a1210'/><circle cx='22' cy='160' r='8' fill='#4a1210'/><circle cx='174' cy='176' r='4' fill='#4a1210'/><circle cx='36' cy='26' r='3.5' fill='#4a1210'/><circle cx='150' cy='12' r='2.5' fill='#4a1210'/>`, '0 0 200 200');

/** A ragged lower edge for torn pages: polygon points for clip-path (stable per seed). */
export function tornEdge(seed = 7, teeth = 28, depth = 2.6) {
  const pts = ['0% 0%', '100% 0%'];
  for (let i = teeth; i >= 0; i--) {const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453, r = x - Math.floor(x); pts.push(`${(i / teeth * 100).toFixed(2)}% calc(100% - ${(r * depth).toFixed(2)}%)`);}
  return `polygon(${pts.join(',')})`;
}

/** Shared custom properties: palette, fonts and the raster textures inlined for the pre-download pages. */
export const BINDING_VARS = `--bk-leather:${BK.leather};--bk-leather-deep:${BK.leatherDeep};--bk-cloth:${BK.cloth};--bk-velvet:${BK.velvet};--bk-page:${BK.page};--bk-page2:${BK.page2};--bk-card:${BK.card};--bk-ink:${BK.ink};--bk-ink2:${BK.ink2};--bk-ink3:${BK.ink3};--bk-rule:${BK.rule};--bk-brass:${BK.brass};--bk-brass-hi:${BK.brassHi};--bk-brass-deep:${BK.brassDeep};--bk-ribbon:${BK.ribbon};--bk-ribbon-deep:${BK.ribbonDeep};--bk-errata:${BK.errata};--bk-blot:${BK.blot};--bk-display:${BK_DISPLAY};--bk-latin:${BK_LATIN};--bk-serif:${BK_SERIF};--bk-sans:${BK_SANS};--bk-figures:${BK_FIGURES}`;

/** One stylesheet with the inline textures as custom properties, so each data URI exists once in the document. */
export function installBinding(doc: Document) {
  if (!doc?.getElementById || doc.getElementById('booksea-binding-style')) return;
  const style = doc.createElement('style'); style.id = 'booksea-binding-style';
  const tex = (art: string, fallback: string) => art ? `url("${art}")` : fallback;
  style.textContent = `:root{--bk-tex-paper:${tex(BINDING_ART.paper, BK_GRAIN)};--bk-tex-leather:${tex(BINDING_ART.leather, BK_HIDE)};--bk-tex-marble:${tex(BINDING_ART.marble, BK_HIDE)};--bk-tex-cloth:${BK_HIDE};--bk-tex-velvet:${BK_HIDE};--bk-tex-marble-fairy:${BK_HIDE};--bk-tex-marble-theater:${BK_HIDE}}`;
  doc.head?.append(style);
}
/** Paper page fill: texture tile over the page colour, with a gutter shadow on the bound side. */
export const paperFill = (gutter: 'left' | 'right' | 'none' = 'none', tile = 360) => `${gutter === 'none' ? '' : `linear-gradient(${gutter === 'left' ? 90 : 270}deg,rgba(80,56,30,.28),rgba(80,56,30,0) 7%),`}var(--bk-tex-paper,${BK_GRAIN}) 0 0/${tile}px auto,${BK.page}`;
export const leatherFill = (tile = 300) => `radial-gradient(ellipse at 30% 18%,rgba(140,58,48,.38),transparent 62%),var(--bk-tex-leather,${BK_HIDE}) 0 0/${tile}px auto,${BK.leather}`;
