// 0.37 Octopath-style UI kit: gold filigree corners, cursor, rule ornaments and a shared font stack.
// Everything is inline SVG data URIs so the sandboxed iframe / offline release never fetches assets.
const svg = (body: string, box = '0 0 24 24') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${box}'>${body}</svg>`)}")`;
const cornerBody = (transform: string) => `<g transform='${transform}'><g fill='none' stroke='#d8b978' stroke-linecap='round'><path d='M1.5 22.5V8Q1.5 1.5 8 1.5h14.5' stroke-width='1.1'/><path d='M4.5 22.5v-12q0-6 6-6h12' stroke-width='.7' opacity='.55'/><path d='M1.5 13.5h3M13.5 1.5v3' stroke-width='.9'/></g><path d='M8.6 5.6l3 3-3 3-3-3z' fill='#f0d99c'/><circle cx='15.5' cy='8.6' r='.9' fill='#d8b978'/><circle cx='8.6' cy='15.5' r='.9' fill='#d8b978'/></g>`;
export const OCTO_CORNERS = {
  tl: svg(cornerBody('')),
  tr: svg(cornerBody('matrix(-1 0 0 1 24 0)')),
  bl: svg(cornerBody('matrix(1 0 0 -1 0 24)')),
  br: svg(cornerBody('matrix(-1 0 0 -1 24 24)')),
};
/** Gold pointer used as the selection cursor (menu rows, commands, choices). */
export const OCTO_CURSOR = svg(`<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff1c6'/><stop offset='.55' stop-color='#e2bf73'/><stop offset='1' stop-color='#9c7836'/></linearGradient></defs><path d='M2 3.2 17 10 2 16.8 5.6 10z' fill='url(#g)' stroke='#3b2c14' stroke-width='.9' stroke-linejoin='round'/>`, '0 0 20 20');
export const OCTO_DIAMOND = svg(`<path d='M6 .8 11.2 6 6 11.2.8 6z' fill='#0d1019' stroke='#d8b978' stroke-width='1'/><path d='M6 3.6 8.4 6 6 8.4 3.6 6z' fill='#efd89b'/>`, '0 0 12 12');
export const OCTO_STAR = svg(`<path d='M10 0l2.3 7.7L20 10l-7.7 2.3L10 20l-2.3-7.7L0 10l7.7-2.3z' fill='#f3dea6'/>`, '0 0 20 20');
/** Key-art style serif for headings/labels; body copy keeps the readable system sans. */
export const OCTO_SERIF = `'Noto Serif SC','Source Han Serif SC','Source Han Serif CN','思源宋体','Songti SC','STSong','SimSun',serif`;
export const OCTO_SANS = `'Noto Sans SC','PingFang SC','Microsoft YaHei','Source Han Sans SC',system-ui,sans-serif`;
/** Four corner layers + a panel fill, for a single `background` declaration. */
export function octoFrame(fill: string, size = 22) {
  const c = OCTO_CORNERS;
  return `${c.tl} left 3px top 3px/${size}px ${size}px no-repeat,${c.tr} right 3px top 3px/${size}px ${size}px no-repeat,${c.bl} left 3px bottom 3px/${size}px ${size}px no-repeat,${c.br} right 3px bottom 3px/${size}px ${size}px no-repeat,${fill}`;
}
/** Deep ink-navy panel used across menus, battle windows and the lobby. */
export const OCTO_FILL = 'linear-gradient(180deg,rgba(22,27,43,.95),rgba(10,12,21,.96) 55%,rgba(7,9,16,.97))';
export const OCTO_FILL_SOFT = 'linear-gradient(180deg,rgba(20,25,40,.86),rgba(8,10,18,.9))';
