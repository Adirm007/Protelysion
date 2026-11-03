/** 0.44 敌役图鉴界面：书间顶栏、旅途手记与战况都能打开同一个面板。
 *  未遭遇：只有剪影与「？？？」；遭遇过的那一阶：设定、战斗数值、全部技能；旧旅程击败过：只有设定。 */
import {DEX_GROUPS,DEX_BY_ID,TIER_LABELS,dexState,type BestiaryService,type DexDetail,type DexSkill,type DexSpecies} from '../game/bestiary';
import type {DexArtCache} from './bestiary-art';
import {gameDom} from './game-dom';
import {OCTO_SERIF,OCTO_SANS,OCTO_FILL,octoFrame} from './octo-kit';

const STYLE_ID = 'booksea-bestiary-style';
const ROLE_CLASS: Record<string, string> = {普通: 'is-common', 精英: 'is-elite', Boss: 'is-boss'};
export const BESTIARY_STYLE = `
.bs-dex{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(ellipse at 50% 35%,#0d1222e0,#030409f2);color:#eee6d2;font:14px/1.6 ${OCTO_SANS};letter-spacing:.02em}
.bs-stage .bs-dex,.rpg-ui~.bs-dex{position:absolute}
.bs-dex[hidden],.bs-dex [hidden]{display:none!important}
.bs-dex *{box-sizing:border-box}
.bs-dex button,.bs-dex input,.bs-dex select{font:inherit;color:inherit}
.bs-dex button{cursor:pointer}
.bs-dex-card{position:relative;display:flex;flex-direction:column;width:min(1060px,100%);height:min(780px,100%);border:1px solid #d8b97899;background:${octoFrame(OCTO_FILL, 26)};box-shadow:inset 0 0 0 4px #05070dcc,inset 0 0 0 5px #d8b97826,0 24px 70px #000d}
.bs-dex-card:focus{outline:none}
.bs-dex-head{display:flex;align-items:flex-end;gap:16px;padding:22px 70px 12px 30px;background:linear-gradient(90deg,transparent,#d8b97866 18%,#d8b97866 82%,transparent) bottom/100% 1px no-repeat}
.bs-dex-head h2{margin:0;font:600 23px/1.3 ${OCTO_SERIF};letter-spacing:.24em;background:linear-gradient(180deg,#fff6dc 10%,#e9cf93 55%,#a88146);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 2px #000c)}
.bs-dex-head p{margin:0 0 2px;color:#b9ae96;font-size:12.5px;letter-spacing:.08em}
.bs-dex-close{position:absolute;right:18px;top:16px;width:40px;height:40px;border-radius:50%;border:1px solid #d8b97880;background:radial-gradient(circle at 50% 35%,#2a3046e6,#080a12e6);color:#f3dfa8;font:24px/1 system-ui!important}
.bs-dex-close:hover,.bs-dex-close:focus-visible{border-color:#f3dfa8;outline:2px solid #cdbf9b;outline-offset:2px}
.bs-dex-body{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
.bs-dex-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 30px 10px}
.bs-dex-filter{display:flex;border:1px solid #d8b97855}
.bs-dex-filter button{min-height:34px;padding:4px 14px;border:0;background:#0c0f1acc;color:#d5c8aa;letter-spacing:.12em}
.bs-dex-filter button+button{border-left:1px solid #d8b97833}
.bs-dex-filter button[aria-pressed=true]{background:linear-gradient(180deg,#5c4826,#2a2216);color:#fff1cc}
.bs-dex-tools select,.bs-dex-tools input{min-height:34px;padding:4px 10px;border:1px solid #d8b97855;border-radius:0;background:#0b0d16e6;color:#efe6d2}
.bs-dex-tools input{flex:1;min-width:140px}
.bs-dex-tools select:focus-visible,.bs-dex-tools input:focus-visible,.bs-dex-filter button:focus-visible{outline:2px solid #cdbf9b;outline-offset:1px}
.bs-dex-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 30px 24px;scrollbar-width:thin;scrollbar-color:#9a8f7466 transparent}
.bs-dex-group{margin:0 0 18px}
.bs-dex-group h3{display:flex;align-items:baseline;gap:12px;margin:0 0 10px;padding:6px 0;border-bottom:1px solid #d8b97830;font:500 16px/1.4 ${OCTO_SERIF};letter-spacing:.16em;color:#f1e3c1}
.bs-dex-group h3:before{content:'';align-self:center;width:7px;height:7px;transform:rotate(45deg);background:#d8b978;flex:none}
.bs-dex-group h3 small{font:12px/1.4 ${OCTO_SANS};letter-spacing:.06em;color:#9d9483}
.bs-dex-group h3 b{margin-left:auto;font:500 13px/1 ${OCTO_SERIF};color:#d8c294;letter-spacing:.08em}
.bs-dex-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
.bs-dex-cell{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:6px 6px 8px;border:1px solid #d8b97833;background:linear-gradient(180deg,#151a2acc,#07090fcc);text-align:center;transition:border-color .15s,transform .15s}
.bs-dex-cell:hover,.bs-dex-cell:focus-visible{border-color:#f3dfa8;transform:translateY(-2px);outline:none;box-shadow:0 0 0 1px #f3dfa855,0 8px 18px #0008}
.bs-dex-art{position:relative;display:grid;place-items:center;aspect-ratio:3/4;overflow:hidden;border:1px solid #d8b97840;background:radial-gradient(ellipse at 50% 40%,#2b3150,#0a0c14 70%)}
.bs-dex-art img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 6px #000a)}
.bs-dex-art .bs-dex-seal{font:600 30px/1 ${OCTO_SERIF};color:#e9d7a6;opacity:.85;text-shadow:0 2px 6px #000}
.bs-dex-cell.is-locked .bs-dex-art{background:radial-gradient(ellipse at 50% 42%,#1b1f2e,#06070c 72%)}
.bs-dex-cell.is-locked .bs-dex-seal{color:#5e6378;opacity:.9}
.bs-dex-cell.is-locked .bs-dex-art:after{content:'';position:absolute;inset:18% 26% 10%;border-radius:46% 46% 30% 30%;background:radial-gradient(ellipse at 50% 30%,#2a2f42,#11131d 70%);opacity:.75}
.bs-dex-cell.is-locked .bs-dex-seal{position:relative;z-index:1}
.bs-dex-name{font:500 13px/1.35 ${OCTO_SERIF};color:#f1e6c9;letter-spacing:.06em;word-break:break-all;min-height:2.7em;display:flex;align-items:center;justify-content:center}
.bs-dex-cell.is-locked .bs-dex-name{color:#6f7486}
.bs-dex-gem{position:absolute;top:10px;left:10px;z-index:2;width:9px;height:9px;transform:rotate(45deg);border:1px solid #0008;background:#9d9a90;box-shadow:0 0 0 1px #d8b97855}
.bs-dex-cell.is-elite .bs-dex-gem,.bs-dex-hero .is-elite{background:#7d9be6}
.bs-dex-cell.is-boss .bs-dex-gem,.bs-dex-hero .is-boss{background:#e06a64}
.bs-dex-cell.is-locked .bs-dex-gem{display:none}
.bs-dex-pips{display:flex;justify-content:center;gap:3px}
.bs-dex-pips i{width:7px;height:7px;transform:rotate(45deg);border:1px solid #d8b97855;background:#0c0e16}
.bs-dex-pips i.on{background:#f0d99c;border-color:#f0d99c;box-shadow:0 0 4px #f0d99c99}
.bs-dex-legacy{font-size:10.5px;color:#a49a86;letter-spacing:.04em}
.bs-dex-empty{padding:40px 0;text-align:center;color:#8f8878}
.bs-dex-detail{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 30px 28px;scrollbar-width:thin;scrollbar-color:#9a8f7466 transparent}
.bs-dex-back{display:inline-flex;align-items:center;gap:6px;min-height:34px;margin:0 0 12px;padding:4px 14px 4px 10px;border:1px solid #d8b97866;background:#0c0f1acc;color:#e8d8b0;letter-spacing:.12em}
.bs-dex-back:hover,.bs-dex-back:focus-visible{border-color:#f3dfa8;outline:2px solid #cdbf9b;outline-offset:2px}
.bs-dex-hero{display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:22px;align-items:start;margin-bottom:16px}
.bs-dex-hero .bs-dex-art{border-color:#d8b97877;box-shadow:inset 0 0 0 3px #05070dcc,0 10px 26px #0009}
.bs-dex-hero .bs-dex-seal{font-size:58px}
.bs-dex-eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 4px;color:#d8b978;font:13px/1.4 ${OCTO_SERIF};letter-spacing:.24em}
.bs-dex-eyebrow i{width:9px;height:9px;transform:rotate(45deg);background:#9d9a90;flex:none}
.bs-dex-hero h3{margin:0;font:600 30px/1.25 ${OCTO_SERIF};letter-spacing:.14em;background:linear-gradient(180deg,#fff6dc 10%,#e9cf93 60%,#a88146);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 2px #000c)}
.bs-dex-motif{margin:6px 0 0;color:#cbbd9c;letter-spacing:.06em}
.bs-dex-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0}
.bs-dex-tab{display:flex;flex-direction:column;align-items:center;min-width:68px;padding:5px 8px;border:1px solid #d8b97844;background:#0b0e18cc;color:#d9cba8;line-height:1.25}
.bs-dex-tab small{font-size:10.5px;color:#9f9581;letter-spacing:0}
.bs-dex-tab[aria-selected=true]{border-color:#f3dfa8;background:linear-gradient(180deg,#5a4626,#221b12);color:#fff2cc;box-shadow:0 0 0 1px #f3dfa855}
.bs-dex-tab:disabled{opacity:.42;cursor:default}
.bs-dex-tab:not(:disabled):hover,.bs-dex-tab:focus-visible{border-color:#f3dfa8;outline:none}
.bs-dex-sec{margin:0 0 14px;padding:14px 18px;border:1px solid #ded8ca26;background:#11131c9e}
.bs-dex-sec h4{display:flex;align-items:center;gap:10px;margin:0 0 10px;font:500 15px/1.5 ${OCTO_SERIF};letter-spacing:.14em;color:#f1e3c1}
.bs-dex-sec h4:before{content:'';width:7px;height:7px;transform:rotate(45deg);background:#d8b978;flex:none}
.bs-dex-sec h4 small{font:12px/1 ${OCTO_SANS};color:#9d9483;letter-spacing:.04em}
.bs-dex-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px 18px;margin:0;font-size:13px}
.bs-dex-facts div{display:flex;gap:10px;padding:3px 0;border-bottom:1px dashed #ffffff12}
.bs-dex-facts dt{flex:none;color:#c9b88d;letter-spacing:.08em}
.bs-dex-facts dd{margin:0;color:#e8e0cd}
.bs-dex-quote{position:relative;margin:12px 0 0;padding:12px 16px 12px 22px;border-left:2px solid #d8b97899;background:linear-gradient(90deg,#d8b9781a,transparent);color:#e9dfc8;font:14px/1.75 ${OCTO_SERIF}}
.bs-dex-quote cite{display:block;margin-top:4px;color:#a99d84;font:12px/1.4 ${OCTO_SANS};font-style:normal;letter-spacing:.1em}
.bs-dex-note{margin:8px 0 0;color:#a39a87;font-size:12.5px}
.bs-dex-rules{margin:10px 0 0;padding-left:18px;color:#e2d8c2;font-size:13px}
.bs-dex-rules li{padding:2px 0}
.bs-dex-tiles{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px}
.bs-dex-tile{padding:8px 4px;border:1px solid #d8b97830;background:linear-gradient(180deg,#181d2ecc,#090b13cc);text-align:center}
.bs-dex-tile b{display:block;font:18px/1.3 ${OCTO_SERIF};color:#f3e7c9;word-break:break-all}
.bs-dex-tile span{font-size:11px;color:#c9b98f;letter-spacing:.1em}
.bs-dex-tile.is-hp b{color:#f0a49a}.bs-dex-tile.is-mp b{color:#9fc0f2}.bs-dex-tile.is-sp b{color:#e6d38d}
.bs-dex-res{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}
.bs-dex-res span{min-width:74px;padding:4px 10px;border:1px solid #ffffff22;background:#0d1019;text-align:center;font-size:12.5px}
.bs-dex-res span b{margin-right:6px;font-family:${OCTO_SERIF}}
.bs-dex-res .is-weak{border-color:#e7a35a99;color:#f4c58f}.bs-dex-res .is-crit{border-color:#e0646499;color:#f3a29a}
.bs-dex-res .is-resist{border-color:#6fb6a899;color:#a6d8cc}.bs-dex-res .is-null{border-color:#8a90b099;color:#b9bfd8}
.bs-dex-res .is-plain{color:#a9a294}
.bs-dex-skills{display:flex;flex-direction:column;gap:6px}
.bs-dex-skill{border:1px solid #ffffff17;background:#0c0e16b8}
.bs-dex-skill summary{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;list-style:none}
.bs-dex-skill summary::-webkit-details-marker{display:none}
.bs-dex-skill summary:focus-visible{outline:2px solid #cdbf9b;outline-offset:-2px}
.bs-dex-skill[open] summary{border-bottom:1px solid #ffffff12}
.bs-dex-kind{flex:none;min-width:42px;padding:1px 7px;border:1px solid #d8b97866;color:#e6d3a4;font-size:11px;text-align:center;letter-spacing:.06em}
.bs-dex-kind.k-被动,.bs-dex-kind.k-阶段{border-color:#a0b4f066;color:#c3d0f3}
.bs-dex-kind.k-登神,.bs-dex-kind.k-法则,.bs-dex-kind.k-领域{border-color:#e0646488;color:#f3b0a8}
.bs-dex-kind.k-专属{border-color:#c3a8de88;color:#dcc8ec}
.bs-dex-skill summary strong{font:500 14px/1.4 ${OCTO_SERIF};color:#f3e8cc;letter-spacing:.04em}
.bs-dex-skill summary em{margin-left:auto;font-style:normal;font-size:11.5px;color:#a49a86}
.bs-dex-skill-body{padding:8px 14px 12px;font-size:13px;color:#ddd4c0}
.bs-dex-skill-body p{margin:0 0 6px}
.bs-dex-skill-body ul{margin:0;padding-left:18px;color:#c9c0ad}
.bs-dex-skill-body li{padding:1px 0}
.bs-dex-lock{padding:30px 0;text-align:center;color:#9d9483}
@media(max-width:760px){.bs-dex{padding:0}.bs-dex-card{height:100%;border:0}.bs-dex-head{padding:16px 58px 10px 18px}.bs-dex-head h2{font-size:19px}.bs-dex-tools,.bs-dex-scroll{padding-left:14px;padding-right:14px}.bs-dex-detail{padding:12px 14px 22px}.bs-dex-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.bs-dex-hero{grid-template-columns:116px 1fr;gap:14px}.bs-dex-hero h3{font-size:22px}.bs-dex-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}.bs-dex-tab{min-width:0;flex:1 0 22%}.bs-dex-group h3 small{display:none}}
@media(pointer:coarse){.bs-dex-tools input{font-size:16px}}
@media(prefers-reduced-motion:reduce){.bs-dex-cell{transition:none}.bs-dex-cell:hover{transform:none}}
`;

const fmt = (n: number) => Math.round(n).toLocaleString('zh-CN');
const day = (at: number) => {if (!at) return '—'; const d = new Date(at); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;};
type Filter = 'all' | 'known' | 'unknown';

export function mountBestiaryPanel(doc: Document, service: BestiaryService, art?: DexArtCache) {
  const {el, button} = gameDom(doc);
  if (!doc.getElementById(STYLE_ID)) {const css = el('style'); css.id = STYLE_ID; css.textContent = BESTIARY_STYLE; doc.head.append(css);}
  const root = el('section', 'bs-dex'), card = el('div', 'bs-dex-card'), head = el('header', 'bs-dex-head'), body = el('div', 'bs-dex-body');
  root.hidden = true; root.dataset.bookseaOverlay = 'bestiary'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'bs-dex-title');
  const titleBox = el('div'), title = el('h2', '', '敌役图鉴'), sub = el('p'); title.id = 'bs-dex-title'; titleBox.append(title, sub);
  const closeButton = button('×', () => close(), 'bs-dex-close'); closeButton.setAttribute('aria-label', '关闭图鉴');
  head.append(titleBox, closeButton);
  const tools = el('div', 'bs-dex-tools'), filterBox = el('div', 'bs-dex-filter'), themeSelect = el('select'), search = el('input'), scroll = el('div', 'bs-dex-scroll'), detail = el('article', 'bs-dex-detail');
  filterBox.setAttribute('role', 'group'); filterBox.setAttribute('aria-label', '筛选');
  themeSelect.setAttribute('aria-label', '主题');
  search.type = 'search'; search.placeholder = '搜索已遭遇的名字'; search.setAttribute('aria-label', '搜索已遭遇的名字'); search.autocomplete = 'off';
  const allTheme = doc.createElement('option'); allTheme.value = ''; allTheme.textContent = '全部主题'; themeSelect.append(allTheme);
  for (const g of DEX_GROUPS) {const o = doc.createElement('option'); o.value = g.id; o.textContent = g.id === 'special' ? g.name : `${g.id.slice(1)} · ${g.name}`; themeSelect.append(o);}
  tools.append(filterBox, themeSelect, search); detail.hidden = true;
  body.append(tools, scroll, detail); card.append(head, body); root.append(card);
  // 点到图鉴里的空白处、或重绘移走了获得焦点的格子时，焦点留在图鉴内（Esc 与 Tab 仍归图鉴处理）。
  card.tabIndex = -1;
  const keepFocus = () => {if (!root.hidden && !root.contains(doc.activeElement)) card.focus({preventScroll: true});};
  let filter: Filter = 'all', opener: HTMLElement | null = null, current: string | undefined, currentTier: number | undefined, listScroll = 0;
  const filters: [Filter, string][] = [['all', '全部'], ['known', '已遭遇'], ['unknown', '未遭遇']];
  for (const [id, label] of filters) {const b = button(label, () => {filter = id; renderIndex();}); b.dataset.filter = id; filterBox.append(b);}
  themeSelect.onchange = () => {scroll.scrollTop = 0; renderIndex(); keepFocus();};
  search.oninput = () => renderIndex();

  function artFor(s: DexSpecies, known: boolean, large = false) {
    const box = el('span', 'bs-dex-art'), url = known ? art?.get(s.designId) : undefined;
    if (url) {const img = el('img'); img.src = url; img.alt = ''; img.draggable = false; img.decoding = 'async'; box.append(img);}
    else box.append(el('span', 'bs-dex-seal', known ? [...s.name.replace(/[「」]/g, '')][0] ?? '？' : '？'));
    if (large) box.classList.add('is-large');
    return box;
  }
  function renderHead() {
    const s = service.summary();
    sub.textContent = `已遭遇 ${s.known} / ${s.total} · 击败过 ${s.defeated} · 已解锁层级 ${s.tiers} / ${s.tierTotal}`;
  }
  function renderIndex() {
    renderHead();
    for (const b of Array.from(filterBox.querySelectorAll<HTMLButtonElement>('button'))) b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
    const store = service.store(), legacy = service.legacy(), q = search.value.trim().toLowerCase(), theme = themeSelect.value, summary = service.summary();
    const frag = doc.createDocumentFragment();
    let shown = 0;
    for (const g of DEX_GROUPS) {
      if (theme && g.id !== theme) continue;
      const cells: HTMLElement[] = [];
      for (const s of g.species) {
        const st = dexState(store, legacy, s.id);
        if (filter === 'known' && !st.known || filter === 'unknown' && st.known) continue;
        if (q && (!st.known || !s.name.toLowerCase().includes(q))) continue;
        const cell = el('button', 'bs-dex-cell ' + (st.known ? 'is-known ' + (ROLE_CLASS[s.role] ?? '') : 'is-locked'));
        cell.type = 'button'; cell.dataset.id = s.id;
        cell.setAttribute('aria-label', st.known ? `${s.name}，${s.role}${st.tiers.length ? `，已解锁${st.tiers.length}个层级` : ''}` : '未遭遇的敌人');
        const pips = el('span', 'bs-dex-pips');
        for (let t = 1; t <= 7; t++) {const i = el('i'); if (st.tiers.includes(t)) i.className = 'on'; pips.append(i);}
        cell.append(el('span', 'bs-dex-gem'), artFor(s, st.known), el('span', 'bs-dex-name', st.known ? s.name : '？？？'));
        if (st.legacy) cell.append(el('span', 'bs-dex-legacy', '旧旅程击败过')); else cell.append(pips);
        cell.onclick = () => openDetail(s.id);
        cells.push(cell);
      }
      if (!cells.length) continue;
      shown += cells.length;
      const section = el('section', 'bs-dex-group'), h = el('h3'), count = summary.groups[g.id];
      h.append(el('span', '', g.name), el('small', '', g.subtitle), el('b', '', `${count?.known ?? 0} / ${count?.total ?? g.species.length}`));
      const grid = el('div', 'bs-dex-grid'); grid.append(...cells); section.dataset.group = g.id; section.append(h, grid); frag.append(section);
    }
    scroll.replaceChildren(frag);
    if (!shown) scroll.append(el('p', 'bs-dex-empty', q ? '没有找到这个名字。只能搜索已经遭遇过的敌人。' : filter === 'known' ? '还没有遭遇过任何敌人。进入书海，与它们交手后这里会写上名字。' : '这一页已经全部写满了。'));
  }
  const factList = (rows: [string, string][]) => {const dl = el('dl', 'bs-dex-facts'); for (const [k, v] of rows) {if (!v) continue; const row = el('div'); row.append(el('dt', '', k), el('dd', '', v)); dl.append(row);} return dl;};
  const section = (heading: string, small = '') => {const s = el('section', 'bs-dex-sec'), h = el('h4', '', heading); if (small) h.append(el('small', '', small)); s.append(h); return s;};
  function skillRow(k: DexSkill) {
    const d = el('details', 'bs-dex-skill'), sum = el('summary'), meta = [k.quality, k.cost && k.cost !== '无消耗' ? k.cost : '', k.cast, k.uses].filter(Boolean).join(' · ');
    sum.append(el('span', 'bs-dex-kind k-' + k.kind, k.kind), el('strong', '', k.name)); if (meta) sum.append(el('em', '', meta));
    const b = el('div', 'bs-dex-skill-body');
    if (k.summary) b.append(el('p', '', k.summary));
    if (k.effects.length) {const ul = el('ul'); for (const line of k.effects) ul.append(el('li', '', line)); b.append(ul);}
    if (!b.childNodes.length) b.append(el('p', '', '没有额外说明。'));
    d.append(sum, b); return d;
  }
  function renderDetail() {
    if (!current) return;
    const s = DEX_BY_ID[current]!; let d: DexDetail;
    try {d = service.detail(current, currentTier);} catch (e) {detail.replaceChildren(el('p', 'bs-dex-lock', '这一页暂时读不出来：' + String((e as Error)?.message ?? e))); return;}
    currentTier = d.tier;
    const back = button('‹ 返回图鉴', () => showIndex(), 'bs-dex-back');
    const hero = el('div', 'bs-dex-hero'), copy = el('div'), eyebrow = el('p', 'bs-dex-eyebrow'), gem = el('i', d.known ? ROLE_CLASS[d.role] ?? '' : '');
    const group = DEX_GROUPS.find(g => g.species.some(x => x.id === s.id))!;
    eyebrow.append(gem, el('span', '', d.known ? `${group.name} · ${d.role}` : group.name));
    copy.append(eyebrow, el('h3', '', d.name));
    if (!d.known) {
      hero.append(artFor(s, false, true), copy);
      copy.append(el('p', 'bs-dex-motif', '尚未遭遇。'));
      detail.replaceChildren(back, hero, el('p', 'bs-dex-lock', '在书海中与它交手后，这一页会写上它的名字、它的数值与它的全部手段。'));
      return;
    }
    const lore = d.lore!;
    copy.append(el('p', 'bs-dex-motif', `「${lore.motif}」 · ${lore.build}${lore.element && lore.element !== '无' ? ' · ' + lore.element + '属性' : ''}`));
    const tabs = el('div', 'bs-dex-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '生命层级');
    for (const t of d.tiers) {
      const b = el('button', 'bs-dex-tab'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(t.tier === d.tier)); b.disabled = !t.unlocked;
      b.append(el('span', '', TIER_LABELS[t.tier - 1]!), el('small', '', t.unlocked ? (t.lo === t.hi ? `Lv ${t.lo}` : `Lv ${t.lo}–${t.hi}`) : t.range));
      b.title = t.unlocked ? `${t.label}：遭遇 ${t.seen ?? 0} 场，击败 ${t.defeated ?? 0} 只` : `${t.label}（${t.range}）：尚未遭遇`;
      b.onclick = () => {currentTier = t.tier; const top = detail.scrollTop; renderDetail(); detail.scrollTop = top;};
      tabs.append(b);
    }
    copy.append(tabs); hero.append(artFor(s, true, true), copy);
    const blocks: HTMLElement[] = [back, hero];
    // 设定
    const loreSec = section('设定');
    loreSec.append(factList([
      ['所属', `${lore.theme.name}${lore.theme.subtitle ? ' · ' + lore.theme.subtitle : ''}`],
      ['出没', lore.scenes.join('、')],
      ['母题', lore.motif],
      ['本相', `${lore.build} · 核心：${lore.cores.join(' / ')}`],
      ['掉落', lore.drop ? `${lore.drop.quality} · ${lore.drop.name}` : ''],
      ['神国', d.role === 'Boss' && d.tier === 7 ? lore.realm : ''],
      ['法则', d.tier && d.tier >= 6 ? lore.laws.join('、') : ''],
    ]));
    if (lore.drop?.text) loreSec.append(el('p', 'bs-dex-note', lore.drop.text));
    if (lore.note) {const q = el('blockquote', 'bs-dex-quote', lore.note.text); if (lore.note.voice) q.append(el('cite', '', '—— 夜梦 · ' + lore.note.voice)); loreSec.append(q);}
    if (lore.rules?.length) {const ul = el('ul', 'bs-dex-rules'); for (const r of lore.rules) ul.append(el('li', '', r)); loreSec.append(ul);}
    blocks.push(loreSec);
    if (d.stats) {
      const st = d.stats, statSec = section('战斗数值', `${TIER_LABELS[(d.tier ?? 1) - 1]} · Lv ${st.level}${st.level !== st.templateLevel ? `（${st.templateLevel} 级模板＋挑战成长）` : ''} · ${st.quality}`);
      const tiles = el('div', 'bs-dex-tiles');
      for (const [k, v, cls] of [...Object.entries(st.attributes).map(([k, v]) => [k, fmt(v), ''] as const), ['生命', fmt(st.max.hp), 'is-hp'], ['法力', fmt(st.max.mp), 'is-mp'], ['体力', fmt(st.max.sp), 'is-sp']] as const) {const t = el('div', 'bs-dex-tile ' + cls); t.append(el('b', '', v), el('span', '', k)); tiles.append(t);}
      const res = el('div', 'bs-dex-res');
      for (const r of st.resistance) {const span = el('span', r.label === '弱点' ? 'is-weak' : r.label === '特攻' ? 'is-crit' : r.label === '抵抗' ? 'is-resist' : r.label === '无效' ? 'is-null' : 'is-plain'); span.append(el('b', '', r.element), el('span', '', r.label === '—' ? '×1' : `${r.label} ×${r.value}`)); res.append(span);}
      statSec.append(tiles, res);
      if (st.phase) statSec.append(el('p', 'bs-dex-note', '多阶段：' + st.phase + '。'));
      blocks.push(statSec);
      const skillSec = section('技能', `${d.skills.length} 项 · 点开查看效果`), list = el('div', 'bs-dex-skills');
      for (const k of d.skills) list.append(skillRow(k));
      skillSec.append(list); blocks.push(skillSec);
    } else {
      const lock = section('战斗数值与技能');
      lock.append(el('p', 'bs-dex-note', d.legacy ? '这是旧旅程里击败过的敌人，那时还没有记下它的等级。再次遭遇后，这一页会补上它的数值与技能。' : '再次遭遇后会记下它的数值与技能。'));
      blocks.push(lock);
    }
    if (d.record) {
      const r = d.record, recSec = section('记录');
      recSec.append(factList([['遭遇', `${fmt(r.n)} 场`], ['击败', `${fmt(r.k)} 只`], ['出现层数', r.d0 === r.d1 ? `第 ${r.d0} 层` : `第 ${r.d0}–${r.d1} 层`], ['首次遭遇', day(r.f)], ['最近遭遇', day(r.l)]]));
      blocks.push(recSec);
    }
    detail.replaceChildren(...blocks);
  }
  function openDetail(id: string, tier?: number) {
    if (!DEX_BY_ID[id]) return;
    if (detail.hidden) listScroll = scroll.scrollTop;
    current = id; currentTier = tier; detail.hidden = false; tools.hidden = true; scroll.hidden = true; detail.scrollTop = 0;
    renderHead(); renderDetail();
    detail.querySelector<HTMLElement>('.bs-dex-back')?.focus({preventScroll: true});
  }
  function showIndex() {
    const from = current; current = undefined; detail.hidden = true; tools.hidden = false; scroll.hidden = false; renderIndex(); scroll.scrollTop = listScroll;
    (from ? scroll.querySelector<HTMLElement>(`[data-id="${from}"]`) : null)?.focus({preventScroll: true});
  }
  function close() {root.hidden = true; current = undefined; opener?.focus?.({preventScroll: true});}
  root.addEventListener('click', e => {if (e.target === root) close();});
  root.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') {e.preventDefault(); if (current) showIndex(); else close(); return;}
    if (e.key !== 'Tab') return;
    const items = Array.from(card.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,summary')).filter(x => x.offsetParent !== null || x === closeButton);
    if (!items.length) return;
    const first = items[0]!, last = items.at(-1)!;
    if (e.shiftKey && doc.activeElement === first) {e.preventDefault(); last.focus();}
    else if (!e.shiftKey && doc.activeElement === last) {e.preventDefault(); first.focus();}
  });
  const rerender = () => {if (root.hidden) return; if (current) renderDetail(); else renderIndex(); keepFocus();};
  const offService = service.subscribe(rerender), offArt = art?.subscribe(rerender);
  return {
    element: root,
    get open() {return !root.hidden;},
    /** parent：书间传入书间根节点，游戏中传入舞台（全屏时也能盖住）；focus：直接翻到某个物种。 */
    show(parent?: HTMLElement, focus?: string) {
      if (parent && root.parentElement !== parent) parent.append(root); else if (!root.isConnected) doc.body.append(root);
      opener = doc.activeElement as HTMLElement | null; service.refresh(); root.hidden = false;
      if (focus && DEX_BY_ID[focus]) openDetail(focus); else {current = undefined; detail.hidden = true; tools.hidden = false; scroll.hidden = false; renderIndex(); closeButton.focus({preventScroll: true});}
    },
    close,
    dispose() {offService(); offArt?.(); root.remove();},
  };
}
