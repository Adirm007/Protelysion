/** 0.44 敌役图鉴界面：书间顶栏、旅途手记与战况都能打开同一个面板。
 *  未遭遇：只有剪影与「？？？」；遭遇过的那一阶：设定、战斗数值、全部技能；旧旅程击败过：只有设定。 */
import {DEX_GROUPS,DEX_BY_ID,TIER_LABELS,dexState,type BestiaryService,type DexDetail,type DexSkill,type DexSpecies} from '../game/bestiary';
import type {DexArtCache} from './bestiary-art';
import {gameDom} from './game-dom';
import {BK, BINDING_VARS, BK_DISPLAY, BK_SERIF, BK_LATIN, BK_FIGURES, BK_FLEURON, installBinding, paperFill} from './binding-kit';

const STYLE_ID = 'booksea-bestiary-style';
const ROLE_CLASS: Record<string, string> = {普通: 'is-common', 精英: 'is-elite', Boss: 'is-boss'};
/** 博物图鉴的图版页：遭遇过的敌人是一幅带编号的图版，未遭遇的只有铅笔轮廓与「待考」。 */
export const BESTIARY_STYLE = `
.bs-dex{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(ellipse at 50% 35%,rgba(40,22,14,.82),rgba(8,4,2,.94));color:${BK.ink};font:14px/1.65 ${BK_SERIF};letter-spacing:.02em;${BINDING_VARS}}
.bs-stage .bs-dex,.rpg-ui~.bs-dex{position:absolute}
.bs-dex[hidden],.bs-dex [hidden]{display:none!important}
.bs-dex *{box-sizing:border-box}
.bs-dex button,.bs-dex input,.bs-dex select{font:inherit;color:inherit}
.bs-dex button{cursor:pointer}
.bs-dex-card{position:relative;display:flex;flex-direction:column;width:min(1060px,100%);height:min(780px,100%);border-left:14px solid ${BK.cloth};background:${paperFill('left')};box-shadow:0 24px 70px rgba(0,0,0,.7)}
.bs-dex-card::before{content:'';position:absolute;left:-14px;top:0;bottom:0;width:14px;background:var(--bk-tex-cloth) 0 0/160px auto,${BK.cloth};box-shadow:inset -3px 0 4px rgba(0,0,0,.45)}
.bs-dex-card:focus{outline:none}
.bs-dex-head{display:flex;align-items:flex-end;gap:16px;margin:0 30px;padding:20px 50px 10px 0;border-bottom:1px solid ${BK.rule}}
.bs-dex-head h2{margin:0;font:900 24px/1.3 ${BK_DISPLAY};letter-spacing:.3em;color:${BK.ink}}
.bs-dex-head p{margin:0 0 3px;color:${BK.ink3};font-size:13px;letter-spacing:.06em;font-variant-numeric:tabular-nums}
.bs-dex-close{position:absolute;right:18px;top:14px;width:40px;height:40px;border-radius:50%;border:1.5px solid rgba(35,24,15,.35);background:transparent;color:${BK.ink2};font:400 24px/1 ${BK_SERIF}!important}
.bs-dex-close:hover,.bs-dex-close:focus-visible{background:${BK.ribbon};border-color:${BK.ribbon};color:#fff;outline:2px solid ${BK.errata};outline-offset:2px}
.bs-dex-body{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
.bs-dex-tools{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 30px 10px}
.bs-dex-filter{display:flex;gap:4px}
.bs-dex-filter button{min-height:36px;padding:3px 14px;border:0;border-top:4px solid ${BK.ink2};border-radius:0 0 6px 6px;background:rgba(255,250,236,.65);color:${BK.ink2};font:900 14px/1.4 ${BK_DISPLAY};letter-spacing:.16em}
.bs-dex-filter button[aria-pressed=true]{border-top-color:${BK.ribbonDeep};background:${BK.ribbon};color:#fff6ea}
.bs-dex-tools select,.bs-dex-tools input{min-height:36px;padding:4px 8px;border:0;border-bottom:1.5px solid ${BK.ink2};border-radius:0;background:transparent;color:${BK.ink}}
.bs-dex-tools select option{background:${BK.card};color:${BK.ink}}
.bs-dex-tools input{flex:1;min-width:140px}
.bs-dex-tools input::placeholder{color:${BK.ink3}}
.bs-dex-tools select:focus-visible,.bs-dex-tools input:focus-visible,.bs-dex-filter button:focus-visible{outline:2px solid ${BK.ribbon};outline-offset:2px}
.bs-dex-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 30px 24px;scrollbar-width:thin;scrollbar-color:rgba(94,75,58,.45) transparent}
.bs-dex-group{margin:0 0 22px;counter-reset:plate}
.bs-dex-group h3{display:flex;align-items:baseline;gap:12px;margin:0 0 12px;padding:6px 0 7px;border-bottom:1px solid ${BK.ink2};font:900 17px/1.4 ${BK_DISPLAY};letter-spacing:.2em;color:${BK.ink}}
.bs-dex-group h3:before{content:'';align-self:center;width:16px;height:16px;flex:none;background:${BK_FLEURON} center/contain no-repeat}
.bs-dex-group h3 small{font:13px/1.4 ${BK_SERIF};letter-spacing:.06em;color:${BK.ink3}}
.bs-dex-group h3 b{margin-left:auto;font:600 14px/1 ${BK_FIGURES};color:${BK.ink2};letter-spacing:.04em}
.bs-dex-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:14px 12px}
.bs-dex-cell{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:8px 8px 7px;border:0;background:${BK.card};box-shadow:1px 2px 5px rgba(60,40,20,.2),inset 0 0 0 4px ${BK.card},inset 0 0 0 5px rgba(35,24,15,.45);text-align:center;counter-increment:plate;transition:transform .15s,box-shadow .15s}
.bs-dex-cell::after{content:'Pl. ' counter(plate);position:absolute;right:9px;top:7px;font:italic 11px/1 ${BK_LATIN};color:${BK.ink3};letter-spacing:.04em}
.bs-dex-cell:hover,.bs-dex-cell:focus-visible{transform:translateY(-3px);outline:none;box-shadow:2px 8px 14px rgba(60,40,20,.28),inset 0 0 0 4px ${BK.card},inset 0 0 0 5px ${BK.ribbon}}
.bs-dex-art{position:relative;display:grid;place-items:center;aspect-ratio:3/4;overflow:hidden;margin:12px 4px 0;background:radial-gradient(ellipse at 50% 46%,#f3e8cc,#e3d2ac 78%);box-shadow:inset 0 0 0 1px rgba(35,24,15,.18)}
.bs-dex-art img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 4px rgba(40,24,10,.35)) sepia(.08)}
.bs-dex-art .bs-dex-seal{font:900 34px/1 ${BK_DISPLAY};color:${BK.ink2};opacity:.85}
.bs-dex-cell.is-locked .bs-dex-art{background:repeating-linear-gradient(-45deg,transparent 0 6px,rgba(35,24,15,.05) 6px 7px),#ece0c3}
.bs-dex-cell.is-locked .bs-dex-seal{color:rgba(94,75,58,.55)}
.bs-dex-cell.is-locked .bs-dex-art:after{content:'';position:absolute;inset:18% 24% 12%;border-radius:46% 46% 30% 30%;border:1.5px dashed rgba(94,75,58,.45)}
.bs-dex-cell.is-locked .bs-dex-art:before{content:'待考';position:absolute;z-index:2;right:6px;bottom:8px;padding:0 6px;border:1.5px solid rgba(122,31,26,.6);font:900 12px/1.6 ${BK_DISPLAY};letter-spacing:.2em;color:rgba(122,31,26,.75);transform:rotate(-8deg)}
.bs-dex-cell.is-locked .bs-dex-seal{position:relative;z-index:1}
.bs-dex-name{font:700 14px/1.35 ${BK_SERIF};color:${BK.ink};letter-spacing:.06em;word-break:break-all;min-height:2.7em;display:flex;align-items:center;justify-content:center}
.bs-dex-cell.is-locked .bs-dex-name{color:${BK.ink3};font-weight:400;font-family:${BK_SERIF}}
.bs-dex-gem{position:absolute;top:9px;left:10px;z-index:2;width:9px;height:9px;transform:rotate(45deg);background:${BK.ink2}}
.bs-dex-cell.is-elite .bs-dex-gem,.bs-dex-hero .is-elite{background:${BK.blue}}
.bs-dex-cell.is-boss .bs-dex-gem,.bs-dex-hero .is-boss{background:${BK.ribbon}}
.bs-dex-cell.is-locked .bs-dex-gem{display:none}
.bs-dex-pips{display:flex;justify-content:center;gap:4px}
.bs-dex-pips i{width:7px;height:7px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(35,24,15,.45)}
.bs-dex-pips i.on{background:${BK.ink}}
.bs-dex-legacy{font-size:12px;color:${BK.ink3};letter-spacing:.04em}
.bs-dex-empty{padding:40px 0;text-align:center;color:${BK.ink3};letter-spacing:.1em}
.bs-dex-detail{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 30px 28px;scrollbar-width:thin;scrollbar-color:rgba(94,75,58,.45) transparent}
.bs-dex-back{display:inline-flex;align-items:center;gap:6px;min-height:36px;margin:0 0 12px;padding:3px 14px 3px 10px;border:1.5px solid ${BK.ink2};border-radius:3px;background:rgba(255,250,236,.6);color:${BK.ink};font:900 14px/1.4 ${BK_DISPLAY};letter-spacing:.14em}
.bs-dex-back:hover,.bs-dex-back:focus-visible{background:#fffaf0;outline:2px solid ${BK.ribbon};outline-offset:2px}
.bs-dex-hero{display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:24px;align-items:start;margin-bottom:18px}
.bs-dex-hero .bs-dex-art{margin:0;padding:10px;background:${BK.card};box-shadow:1px 3px 8px rgba(60,40,20,.25),inset 0 0 0 5px ${BK.card},inset 0 0 0 6px rgba(35,24,15,.45)}
.bs-dex-hero .bs-dex-seal{font-size:60px}
.bs-dex-eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 4px;color:${BK.ink3};font:13px/1.4 ${BK_SERIF};letter-spacing:.24em}
.bs-dex-eyebrow i{width:9px;height:9px;transform:rotate(45deg);background:${BK.ink2};flex:none}
.bs-dex-hero h3{margin:0;font:700 30px/1.25 ${BK_SERIF};letter-spacing:.14em;color:${BK.ink}}
.bs-dex-motif{margin:6px 0 0;color:${BK.ink2};font-style:italic;letter-spacing:.06em}
.bs-dex-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:14px 0 0}
.bs-dex-tab{display:flex;flex-direction:column;align-items:center;min-width:70px;padding:4px 8px 5px;border:0;border-top:4px solid ${BK.ink2};border-radius:0 0 6px 6px;background:rgba(255,250,236,.65);color:${BK.ink};line-height:1.25;font-family:${BK_DISPLAY};font-weight:900}
.bs-dex-tab small{font:12px/1.4 ${BK_FIGURES};color:${BK.ink3};letter-spacing:0;font-weight:400}
.bs-dex-tab[aria-selected=true]{border-top-color:${BK.ribbonDeep};background:${BK.ribbon};color:#fff6ea}
.bs-dex-tab[aria-selected=true] small{color:#f6d6cc}
.bs-dex-tab:disabled{opacity:.42;cursor:default}
.bs-dex-tab:not(:disabled):hover,.bs-dex-tab:focus-visible{outline:2px solid ${BK.ribbon};outline-offset:1px}
.bs-dex-sec{margin:0 0 16px;padding:0 0 14px;border-bottom:1px dotted rgba(35,24,15,.3)}
.bs-dex-sec h4{display:flex;align-items:center;gap:10px;margin:0 0 10px;font:900 16px/1.5 ${BK_DISPLAY};letter-spacing:.24em;color:${BK.ink}}
.bs-dex-sec h4:before{content:'';width:16px;height:16px;background:${BK_FLEURON} center/contain no-repeat;flex:none}
.bs-dex-sec h4 small{font:13px/1 ${BK_SERIF};color:${BK.ink3};letter-spacing:.04em}
.bs-dex-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:2px 22px;margin:0;font-size:14px}
.bs-dex-facts div{display:flex;gap:10px;padding:4px 0;border-bottom:1px dotted rgba(35,24,15,.25)}
.bs-dex-facts dt{flex:none;color:${BK.ink3};letter-spacing:.1em}
.bs-dex-facts dd{margin:0;color:${BK.ink}}
.bs-dex-quote{position:relative;margin:14px 0 0;padding:4px 0 4px 18px;border-left:3px solid ${BK.ribbon};color:${BK.ink};font:italic 15px/1.8 ${BK_SERIF}}
.bs-dex-quote cite{display:block;margin-top:4px;color:${BK.ink3};font:13px/1.4 ${BK_SERIF};font-style:normal;letter-spacing:.1em}
.bs-dex-note{margin:8px 0 0;color:${BK.ink2};font-size:13.5px}
.bs-dex-rules{margin:10px 0 0;padding-left:18px;color:${BK.ink};font-size:14px}
.bs-dex-rules li{padding:2px 0}
.bs-dex-tiles{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:0;border-top:1px solid ${BK.ink2};border-bottom:1px solid ${BK.ink2}}
.bs-dex-tile{padding:8px 4px 6px;text-align:center}
.bs-dex-tile+.bs-dex-tile{border-left:1px solid ${BK.rule}}
.bs-dex-tile b{display:block;font:600 18px/1.3 ${BK_FIGURES};color:${BK.ink};word-break:break-all;font-variant-numeric:tabular-nums}
.bs-dex-tile span{font-size:12.5px;color:${BK.ink3};letter-spacing:.1em}
.bs-dex-tile.is-hp b{color:${BK.green}}.bs-dex-tile.is-mp b{color:${BK.blue}}.bs-dex-tile.is-sp b{color:#8a6420}
.bs-dex-res{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0}
.bs-dex-res span{min-width:76px;padding:2px 10px;border:1.5px solid rgba(35,24,15,.35);text-align:center;font-size:13px}
.bs-dex-res span b{margin-right:6px;font-family:${BK_DISPLAY};font-weight:900}
.bs-dex-res .is-weak{border-color:#a8641c;color:#8a4f12}.bs-dex-res .is-crit{border-color:${BK.ribbon};color:${BK.ribbonDeep}}
.bs-dex-res .is-resist{border-color:${BK.green};color:${BK.green}}.bs-dex-res .is-null{border-color:${BK.blue};color:${BK.blue}}
.bs-dex-res .is-plain{color:${BK.ink3}}
.bs-dex-skills{display:flex;flex-direction:column;gap:0}
.bs-dex-skill{border-bottom:1px dotted rgba(35,24,15,.3)}
.bs-dex-skill summary{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 4px;cursor:pointer;list-style:none}
.bs-dex-skill summary::-webkit-details-marker{display:none}
.bs-dex-skill summary:focus-visible{outline:2px solid ${BK.ribbon};outline-offset:-2px}
.bs-dex-skill[open] summary{background:rgba(255,250,236,.6)}
.bs-dex-kind{flex:none;min-width:44px;padding:0 7px;border:1.5px solid ${BK.ink2};color:${BK.ink2};font:900 12px/1.6 ${BK_DISPLAY};text-align:center;letter-spacing:.06em}
.bs-dex-kind.k-被动,.bs-dex-kind.k-阶段{border-color:${BK.blue};color:${BK.blue}}
.bs-dex-kind.k-登神,.bs-dex-kind.k-法则,.bs-dex-kind.k-领域{border-color:${BK.ribbon};color:${BK.ribbonDeep}}
.bs-dex-kind.k-专属{border-color:#5a3e6e;color:#5a3e6e}
.bs-dex-skill summary strong{font:700 15px/1.4 ${BK_SERIF};color:${BK.ink};letter-spacing:.04em}
.bs-dex-skill summary em{margin-left:auto;font-style:normal;font-size:12.5px;color:${BK.ink3}}
.bs-dex-skill-body{padding:4px 8px 12px 56px;font-size:14px;color:${BK.ink}}
.bs-dex-skill-body p{margin:0 0 6px}
.bs-dex-skill-body ul{margin:0;padding-left:18px;color:${BK.ink2}}
.bs-dex-skill-body li{padding:1px 0}
.bs-dex-lock{padding:30px 0;text-align:center;color:${BK.ink3}}
@media(max-width:760px){.bs-dex{padding:0}.bs-dex-card{height:100%;border-left-width:8px}.bs-dex-card::before{left:-8px;width:8px}.bs-dex-head{margin:0 16px;padding:14px 48px 8px 0}.bs-dex-head h2{font-size:20px}.bs-dex-tools,.bs-dex-scroll{padding-left:16px;padding-right:16px}.bs-dex-detail{padding:12px 16px 22px}.bs-dex-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 8px}.bs-dex-hero{grid-template-columns:116px 1fr;gap:14px}.bs-dex-hero h3{font-size:22px}.bs-dex-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}.bs-dex-tile:nth-child(5){border-left:0}.bs-dex-facts{grid-template-columns:1fr}.bs-dex-skill-body{padding-left:10px}}
@media(max-width:420px){.bs-dex-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bs-dex-filter button{padding:3px 10px}}
@media(pointer:coarse){.bs-dex-tools input{font-size:16px}}
@media(prefers-reduced-motion:reduce){.bs-dex-cell{transition:none}.bs-dex-cell:hover{transform:none}}
`;

const fmt = (n: number) => Math.round(n).toLocaleString('zh-CN');
const day = (at: number) => {if (!at) return '—'; const d = new Date(at); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;};
type Filter = 'all' | 'known' | 'unknown';

export function mountBestiaryPanel(doc: Document, service: BestiaryService, art?: DexArtCache) {
  const {el, button} = gameDom(doc);
  installBinding(doc);
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
      const st = d.stats, statSec = section('战斗数值', `${TIER_LABELS[(d.tier ?? 1) - 1]} · Lv ${st.level} · ${st.quality}`);
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
