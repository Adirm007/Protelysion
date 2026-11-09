import type {SupplierMemory} from '../supplier-memory/service';
import {PRESETS, type MemorySettings, type ApiSlot, type TestResult} from '../supplier-memory/apis';
import {gameDom} from './game-dom';
import {BK, BINDING_VARS, BK_DISPLAY, BK_SERIF, BK_FIGURES, BK_FLEURON, installBinding, paperFill} from './binding-kit';

const STYLE_ID = 'booksea-memory-style';
/** 补给员的日记：别着纸条的本子。记下的事是钉在页上的纸条，设置是页脚的装订工具。自带样式，书间与游戏里都能用。 */
export const SUPPLIER_MEMORY_STYLE = `
.bs-memory{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(ellipse at 50% 40%,rgba(40,22,14,.8),rgba(8,4,2,.92));color:${BK.ink};font:14px/1.65 ${BK_SERIF};${BINDING_VARS}}
.bs-stage .bs-memory,.rpg-ui~.bs-memory{position:absolute}
.bs-memory[hidden]{display:none!important}
.bs-memory *{box-sizing:border-box}
.bs-memory-card{position:relative;display:flex;flex-direction:column;width:min(760px,100%);max-height:calc(100% - 8px);border-left:14px solid #4a3a2a;background:repeating-linear-gradient(transparent 0 27px,rgba(46,74,107,.12) 27px 28px) 0 64px,${paperFill('left')};box-shadow:0 22px 60px rgba(0,0,0,.7)}
.bs-memory-card:before{content:'';position:absolute;left:-14px;top:0;bottom:0;width:14px;background:var(--bk-tex-leather) 0 0/160px auto,#4a3a2a;filter:hue-rotate(-12deg) saturate(.6);box-shadow:inset -3px 0 4px rgba(0,0,0,.45)}
.bs-memory-card:after{content:'';position:absolute;right:26px;top:-10px;width:18px;height:64px;background:linear-gradient(90deg,rgba(0,0,0,.28),rgba(255,255,255,.14) 46%,rgba(0,0,0,.3)),${BK.ribbon};clip-path:polygon(0 0,100% 0,100% 100%,50% 84%,0 100%);pointer-events:none}
.bs-memory-head{position:relative;margin:0 26px;padding:20px 52px 10px 0;border-bottom:1px solid ${BK.rule}}
.bs-memory-head h2{margin:0;font:900 22px/1.4 ${BK_DISPLAY};letter-spacing:.24em;color:${BK.ink}}
.bs-memory-head p{margin:6px 0 0;color:${BK.ink2};font-size:13px}
.bs-memory button{font:inherit;color:inherit;cursor:pointer}
.bs-memory-close{position:absolute;right:52px;top:16px;width:38px;height:38px;border:1.5px solid rgba(35,24,15,.35);border-radius:50%;background:transparent;color:${BK.ink2};font:400 24px/1 ${BK_SERIF}!important}
.bs-memory-close:hover,.bs-memory-close:focus-visible{background:${BK.ribbon};border-color:${BK.ribbon};color:#fff;outline:2px solid ${BK.errata};outline-offset:2px}
.bs-memory-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 26px 6px;scrollbar-width:thin;scrollbar-color:rgba(94,75,58,.45) transparent}
.bs-memory-sec{margin:0 0 16px;padding:0 0 12px;border-bottom:1px dotted rgba(35,24,15,.3)}
.bs-memory-sec h3{display:flex;align-items:center;gap:10px;margin:0 0 6px;font:900 16px/1.5 ${BK_DISPLAY};letter-spacing:.2em;color:${BK.ink}}
.bs-memory-sec h3:before{content:'';width:16px;height:16px;background:${BK_FLEURON} center/contain no-repeat;flex:none}
.bs-memory-sec h3 .bs-memory-switch{margin-left:auto}
.bs-memory-hint{margin:0 0 10px;color:${BK.ink2};font-size:13px}
.bs-memory-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:4px 0 10px;border-top:1px solid ${BK.ink2};border-bottom:1px solid ${BK.ink2}}
.bs-memory-tile{padding:8px 10px 6px;text-align:center}
.bs-memory-tile+.bs-memory-tile{border-left:1px solid ${BK.rule}}
.bs-memory-tile b{display:block;font:600 20px/1.3 ${BK_FIGURES};color:${BK.ink};font-variant-numeric:tabular-nums}.bs-memory-tile span{font-size:12.5px;color:${BK.ink3};letter-spacing:.1em}
.bs-memory-lines{margin:0;padding:0;list-style:none;font-size:13.5px;color:${BK.ink}}.bs-memory-lines li{padding:3px 0;border-bottom:1px dotted rgba(35,24,15,.22)}
.bs-memory-lines .is-bad{color:${BK.blot}}.bs-memory-lines .is-good{color:${BK.green}}
.bs-memory-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0 0}
.bs-memory-field{display:grid;grid-template-columns:62px 1fr auto;align-items:center;gap:8px;margin:6px 0}
.bs-memory-field>span{color:${BK.ink2};font-size:13px;letter-spacing:.1em}
.bs-memory input[type=text],.bs-memory input[type=password],.bs-memory input[type=url]{width:100%;min-width:0;padding:6px 4px;border:0;border-bottom:1.5px solid ${BK.ink2};border-radius:0;background:rgba(255,250,236,.55);color:${BK.ink};font:13px/1.4 ui-monospace,Consolas,monospace}
.bs-memory input:focus{outline:2px solid ${BK.ribbon};outline-offset:1px}
.bs-memory input:disabled{opacity:.5}
.bs-memory-btn{min-height:36px;padding:5px 14px;border:1.5px solid ${BK.ink2};border-radius:3px;background:rgba(255,250,236,.65);color:${BK.ink};font-family:${BK_DISPLAY}!important;font-weight:900;letter-spacing:.14em;white-space:nowrap}
.bs-memory-btn:hover:not(:disabled),.bs-memory-btn:focus-visible{background:#fffaf0;border-color:${BK.ink};outline:2px solid ${BK.ribbon};outline-offset:2px}
.bs-memory-btn:disabled{opacity:.5;cursor:default}
.bs-memory-btn.is-primary{border-color:${BK.ribbonDeep};color:#fff6ea;background:${BK.ribbon}}
.bs-memory-btn.is-danger{border-color:${BK.blot};color:${BK.blot};background:rgba(255,250,236,.65)}
.bs-memory-btn[aria-pressed=true]{border-color:${BK.ribbon};color:${BK.ribbonDeep};background:rgba(255,250,236,.95);box-shadow:inset 0 -3px 0 ${BK.ribbon}}
.bs-memory-small{min-height:30px;padding:2px 10px;font-size:12.5px;letter-spacing:.06em}
.bs-memory-switch{position:relative;display:inline-flex;align-items:center;gap:8px;font-size:13px;color:${BK.ink2};letter-spacing:.08em;cursor:pointer;user-select:none}
.bs-memory-switch input{position:absolute;opacity:0;width:1px;height:1px}
.bs-memory-switch i{position:relative;width:40px;height:22px;border-radius:11px;background:rgba(35,24,15,.18);box-shadow:inset 0 0 0 1.5px rgba(35,24,15,.4);flex:none}
.bs-memory-switch i:after{content:'';position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 38% 30%,#f6e0a8,${BK.brass} 55%,#6e4e26);transition:transform .15s}
.bs-memory-switch input:checked+i{background:${BK.ribbon};box-shadow:none}.bs-memory-switch input:checked+i:after{transform:translateX(18px)}
.bs-memory-switch input:focus-visible+i{outline:2px solid ${BK.ribbon};outline-offset:2px}
.bs-memory-result{font-size:13px;color:${BK.ink3}}.bs-memory-result.is-ok{color:${BK.green}}.bs-memory-result.is-bad{color:${BK.blot}}
.bs-memory-facts{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:8px}
.bs-memory-facts li{position:relative;display:flex;align-items:flex-start;gap:8px;padding:9px 10px 8px 14px;background:#fbf4e2;box-shadow:1px 2px 4px rgba(60,40,20,.18);font-size:14px}
.bs-memory-facts li:nth-child(odd){transform:rotate(-.4deg)}.bs-memory-facts li:nth-child(even){transform:rotate(.35deg)}
.bs-memory-facts li:before{content:'';position:absolute;left:50%;top:-5px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f6e0a8,${BK.brass} 55%,#5c3d1a);box-shadow:0 1px 2px rgba(0,0,0,.4)}
.bs-memory-facts .bs-memory-text{flex:1;min-width:0;word-break:break-word}
.bs-memory-facts small{display:block;color:${BK.ink3};font-size:12px}
.bs-memory-facts li.is-kept{background:${BK.errata}}
.bs-memory-facts li.is-kept .bs-memory-text{color:${BK.ink}}
.bs-memory-actions{display:flex;flex:none;gap:6px}
.bs-memory-sub{margin:14px 0 4px;color:${BK.ink2};font:900 13px/1.5 ${BK_DISPLAY};letter-spacing:.2em}
.bs-memory-tag{flex:none;padding:0 7px;border:1.5px solid ${BK.ink2};color:${BK.ink2};font:900 11.5px/1.6 ${BK_DISPLAY};letter-spacing:.06em;white-space:nowrap}
.bs-memory-tag.is-guess{border-color:${BK.blue};color:${BK.blue}}.bs-memory-tag.is-self{border-color:#5a3e6e;color:#5a3e6e}
.bs-memory-tag.is-kept{border-color:${BK.green};color:${BK.green}}.bs-memory-tag.is-broken{border-color:${BK.blot};color:${BK.blot}}.bs-memory-tag.is-mark{border-color:${BK.ribbon};color:#fff6ea;background:${BK.ribbon}}
.bs-memory details summary{cursor:pointer;color:${BK.ink};font:900 15px/1.6 ${BK_DISPLAY};letter-spacing:.14em}
.bs-memory-foot{display:flex;align-items:center;gap:12px;margin:0 26px;padding:12px 0 18px;border-top:1px solid ${BK.rule}}
.bs-memory-foot>span{flex:1;font-size:13px;color:${BK.ink2}}
.bs-memory-note{margin:4px 0 12px;color:${BK.ink3};font-size:12.5px}
@media(max-width:620px){.bs-memory{padding:6px}.bs-memory-card{border-left-width:8px}.bs-memory-card:before{left:-8px;width:8px}.bs-memory-head{margin:0 14px;padding:16px 50px 8px 0}.bs-memory-close{right:40px}.bs-memory-body{padding:12px 14px 4px}.bs-memory-foot{margin:0 14px;padding:10px 0 14px}.bs-memory-tiles{grid-template-columns:repeat(2,1fr)}.bs-memory-tile:nth-child(3){border-left:0}.bs-memory-field{grid-template-columns:1fr}}
@media(pointer:coarse){.bs-memory input[type=text],.bs-memory input[type=password],.bs-memory input[type=url]{font-size:16px}}
@media(prefers-reduced-motion:reduce){.bs-memory-switch i:after{transition:none}}
`;

type Kind = 'embedding' | 'rerank' | 'extraction';
const SOURCE: Record<string, [string, string]> = {player: ['亲口说的', ''], inferred: ['她的猜测', ' is-guess'], self: ['她自己说的', ' is-self'], observed: ['看到的', '']};
const time = (at: number) => {const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;};

/** 补给员记忆与接口设置。所有改动先进草稿，“保存”才写入本机；测试连接用草稿里的值。 */
export function mountSupplierMemoryPanel(doc: Document, memory: SupplierMemory) {
  const {el, button} = gameDom(doc);
  installBinding(doc);
  if (!doc.getElementById(STYLE_ID)) {const css = el('style'); css.id = STYLE_ID; css.textContent = SUPPLIER_MEMORY_STYLE; doc.head.append(css);}
  const root = el('section', 'bs-memory'), card = el('div', 'bs-memory-card'), head = el('header', 'bs-memory-head'), body = el('div', 'bs-memory-body'), foot = el('footer', 'bs-memory-foot');
  root.hidden = true; root.dataset.bookseaOverlay = 'memory'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'bs-memory-title');
  const title = el('h2', '', '补给员的记忆'); title.id = 'bs-memory-title';
  head.append(title, el('p', '', '她会记住你说过的话、你们的买卖和每一趟远征。下面的接口都可以不填：不填时用“关键词＋时间＋重要度”检索，照样能用。'));
  let draft: MemorySettings = memory.settings(), dirty = false, opener: HTMLElement | null = null, closeArmed = 0;
  const saved = el('span', '', ''); saved.setAttribute('role', 'status');
  const markDirty = () => {dirty = true; saved.textContent = '有改动，记得保存'; closeArmed = 0;};
  const close = () => {
    if (dirty && Date.now() > closeArmed) {closeArmed = Date.now() + 6000; saved.textContent = '改动还没保存——再点一次关闭就放弃改动'; return;}
    root.hidden = true; dirty = false; draft = memory.settings(); opener?.focus?.({preventScroll: true});
  };
  const closeButton = button('×', close, 'bs-memory-close'); closeButton.setAttribute('aria-label', '关闭记忆设置'); head.append(closeButton);
  card.append(head, body, foot); root.append(card);
  root.addEventListener('click', e => {if (e.target === root) close();});

  const switchOf = (label: string, checked: boolean, onChange: (v: boolean) => void) => {
    const wrap = el('label', 'bs-memory-switch'), input = doc.createElement('input'), knob = el('i');
    input.type = 'checkbox'; input.checked = checked; input.onchange = () => {onChange(input.checked); markDirty();};
    wrap.append(input, knob, el('span', '', label)); return {wrap, input};
  };
  const field = (label: string, value: string, placeholder: string, secret: boolean, onInput: (v: string) => void) => {
    const row = el('label', 'bs-memory-field'), input = doc.createElement('input');
    input.type = secret ? 'password' : 'text'; input.value = value; input.placeholder = placeholder; input.autocomplete = 'off'; input.spellcheck = false;
    if (secret) {input.setAttribute('autocomplete', 'new-password'); input.dataset.secret = '1';}
    input.oninput = () => {onInput(input.value.trim()); markDirty();};
    row.append(el('span', '', label), input);
    if (secret) {const reveal = button('显示', () => {input.type = input.type === 'password' ? 'text' : 'password'; reveal.textContent = input.type === 'password' ? '显示' : '隐藏';}, 'bs-memory-btn bs-memory-small'); row.append(reveal);}
    else row.append(el('span'));
    return {row, input};
  };
  const resultLine = (r?: TestResult) => {const s = el('span', 'bs-memory-result' + (r ? r.ok ? ' is-ok' : ' is-bad' : ''), r ? `${r.ok ? '✓' : '✗'} ${r.note}${r.ms ? ` · ${r.ms} ms` : ''} · ${time(r.at)}` : '未测试'); s.setAttribute('role', 'status'); return s;};
  async function runTest(kind: Kind, out: HTMLElement, trigger: HTMLButtonElement) {
    trigger.disabled = true; out.className = 'bs-memory-result'; out.textContent = '测试中……';
    try {const r = await memory.test(kind, draft); out.replaceWith(resultLine(r));} catch (e) {out.textContent = '✗ ' + String((e as Error)?.message ?? e);} finally {trigger.disabled = false;}
  }

  const statusSec = el('section', 'bs-memory-sec'), viewSec = el('section', 'bs-memory-sec');
  function renderStatus() {
    const st = memory.status(), v = memory.view();
    statusSec.replaceChildren();
    const h = el('h3', '', '记忆'), master = switchOf('长期记忆', draft.enabled, x => {draft.enabled = x;});
    master.wrap.title = '关掉后她不再记新的事，也不会提起旧的；“杀害”照样会清空记忆。'; h.append(master.wrap); statusSec.append(h);
    const tiles = el('div', 'bs-memory-tiles');
    for (const [n, label] of [[st.counts.facts, '关于你的事'], [st.counts.episodes + st.counts.digests, '往事'], [st.counts.encounters, '见面次数'], [st.epoch, '第几任补给员']] as const) {const t = el('div', 'bs-memory-tile'); t.append(el('b', '', String(n)), el('span', '', label)); tiles.append(t);}
    statusSec.append(tiles);
    const lines = el('ul', 'bs-memory-lines'), li = (text: string, cls = '') => lines.append(el('li', cls, text));
    li('检索方式：' + ({'lexical': '关键词＋时间＋重要度（没有配置向量接口）', 'hybrid': '向量＋关键词融合，再按时间与重要度打分', 'lexical+rerank': '关键词召回 → 重排模型精排', 'hybrid+rerank': '向量＋关键词融合 → 重排模型精排'} as const)[st.retrieval]);
    if (v.callName) li(`她叫你「${v.callName}」`);
    if (st.last) li(`上次检索：${time(st.last.at)} · ${st.last.mode} · 用了 ${st.last.core + st.last.retrieved} 条 · 约 ${st.last.tokens} token · ${st.last.ms} ms${st.last.note ? ' · ' + st.last.note : ''}`, st.last.note ? 'is-bad' : '');
    if (st.extract) li(`上次整理：${time(st.extract.at)} · ${st.extract.ok ? '完成' : '没成功'} · ${st.extract.note}`, st.extract.ok ? 'is-good' : 'is-bad');
    if (st.write && !st.write.ok) li(`存档写入失败，会自动重试：${st.write.note}`, 'is-bad');
    if (st.readOnly) li('这份记忆来自更新版本的游戏：请更新书海后再使用（现在只读，不会覆盖）。', 'is-bad');
    if (st.counts.pending) li(`还有 ${st.counts.pending} 次见面等着整理`);
    li(`存档里占用约 ${Math.max(1, Math.round(st.bytes / 1024))} KB（上限会自动压缩旧往事）`);
    statusSec.append(lines);
    const budget = el('div', 'bs-memory-row'); budget.append(el('span', 'bs-memory-result', '注入预算：'));
    for (const [id, label] of [['compact', '紧凑 ≈450'], ['standard', '标准 ≈800'], ['generous', '宽裕 ≈1400']] as const) {const b = button(label + ' token', () => {draft.budget = id; markDirty(); renderStatus();}, 'bs-memory-btn bs-memory-small'); b.setAttribute('aria-pressed', String(draft.budget === id)); budget.append(b);}
    statusSec.append(budget);
    renderView(v);
  }
  // 后台整理、检索都会刷新这一节：记住玩家展开到哪了，别一刷新就收起来。
  let viewOpen = false;
  const OUTCOME_TAG: Record<string, [string, string]> = {kept: ['已兑现', ' is-kept'], broken: ['没兑现', ' is-broken'], dropped: ['作罢了', '']};
  function renderView(v = memory.view()) {
    viewSec.replaceChildren();
    const details = doc.createElement('details'), summary = el('summary', '', `她记得的事（${v.facts.length} 条 · ${v.episodes.length} 段近事）`);
    details.open = viewOpen; details.addEventListener('toggle', () => {viewOpen = details.open;});
    details.append(summary, el('p', 'bs-memory-hint', '这些只是给你看的，不会原样念给你听。记错了就点“忘掉”，她会彻底忘了这一条；点了“记牢”的，她不会随时间淡忘。'));
    const list = el('ul', 'bs-memory-facts');
    const row = (tag: string, cls: string, body: string | HTMLElement) => {const li = el('li'), text = typeof body === 'string' ? el('span', 'bs-memory-text', body) : body; li.append(el('span', 'bs-memory-tag' + cls, tag), text); return li;};
    for (const f of v.facts) {
      const [label, cls] = SOURCE[f.source] ?? ['', ''], text = el('span', 'bs-memory-text', f.text);
      if (f.history.length) text.append(el('small', '', '以前：' + f.history.join('、') + '（已过时）'));
      text.append(el('small', '', `第 ${f.n} 次见面记下${f.keep ? ' · 已记牢' : ''}`));
      const keep = button(f.keep ? '不必记牢' : '记牢', () => {
        keep.disabled = true;
        void memory.keep(f.id, !f.keep).then(r => {if (r === 'full') {keep.disabled = false; keep.textContent = '记牢的太多了';} else renderStatus();});
      }, 'bs-memory-btn bs-memory-small');
      keep.setAttribute('aria-pressed', String(f.keep)); keep.title = f.keep ? '取消后，这条会像别的记忆一样随时间淡去' : '记牢的事她不会淡忘，也不会因为记忆太多被挤掉（最多 20 条）';
      const forget = button('忘掉', () => {if (forget.dataset.confirm !== 'yes') {forget.dataset.confirm = 'yes'; forget.textContent = '确认忘掉'; return;} void memory.forget(f.id).then(() => renderStatus());}, 'bs-memory-btn bs-memory-small');
      const actions = el('span', 'bs-memory-actions'); actions.append(keep, forget);
      const li = row(label, cls, text); li.classList.toggle('is-kept', f.keep); li.append(actions); list.append(li);
    }
    if (!v.facts.length) list.append(el('li', '', v.epoch > 1 ? '新上任的补给员还不认识你。' : '她还不知道关于你的事。'));
    for (const e of v.episodes) list.append(el('li', '', e.line));
    for (const r of v.reflections) list.append(row('感想', ' is-guess', r.text));
    for (const d of v.digests) list.append(row('旧账', '', d));
    details.append(list);
    if (v.resolved.length) {
      const done = el('ul', 'bs-memory-facts');
      for (const r of v.resolved) {const [tag, cls] = OUTCOME_TAG[r.outcome] ?? OUTCOME_TAG.dropped!; done.append(row(tag, cls, r.text));}
      details.append(el('p', 'bs-memory-sub', '了结的约定'), done);
    }
    if (v.milestones.length) {
      const marks = el('ul', 'bs-memory-facts');
      for (const m of v.milestones) marks.append(row('里程碑', ' is-mark', `${m.text}（${m.text.startsWith('第 ') ? '' : `第 ${Math.max(1, m.n)} 次见面 · `}${time(m.at).split(' ')[0]}）`));
      details.append(el('p', 'bs-memory-sub', '你们之间的里程碑'), marks);
    }
    viewSec.append(details);
  }
  function apiSection(kind: 'embedding' | 'rerank') {
    const sec = el('section', 'bs-memory-sec'), slot: ApiSlot = draft[kind];
    const h = el('h3', '', kind === 'embedding' ? '向量检索（Embedding）' : '重排（Rerank）'), on = switchOf('启用', slot.enabled, x => {draft[kind].enabled = x;});
    h.append(on.wrap); sec.append(h);
    sec.append(el('p', 'bs-memory-hint', kind === 'embedding' ? 'OpenAI 兼容的 POST /v1/embeddings。能让她听懂换了说法的问题（“我的猫” ↔ “宠物”）。推荐硅基流动 BAAI/bge-m3。' : 'Jina / Cohere / 硅基流动 / BGE 同形的 POST /v1/rerank：先粗筛二十条，再让重排模型挑真正相关的。推荐 BAAI/bge-reranker-v2-m3。'));
    const url = field('地址', slot.url, 'https://api.siliconflow.cn/v1', false, x => {draft[kind].url = x;});
    const model = field('模型', slot.model, kind === 'embedding' ? 'BAAI/bge-m3' : 'BAAI/bge-reranker-v2-m3', false, x => {draft[kind].model = x;});
    const key = field('密钥', slot.key, '只存在这台设备上', true, x => {draft[kind].key = x;});
    const presets = el('div', 'bs-memory-row'); presets.append(el('span', 'bs-memory-result', '一键填写：'));
    for (const p of Object.values(PRESETS)) {
      const name = kind === 'embedding' ? p.embedding : p.rerank; if (!name) continue;
      presets.append(button(p.label, () => {draft[kind].url = p.url; draft[kind].model = name; url.input.value = p.url; model.input.value = name; markDirty();}, 'bs-memory-btn bs-memory-small'));
    }
    const row = el('div', 'bs-memory-row'), out = resultLine(memory.settings().tests?.[kind]);
    const test = button('测试连接', () => void runTest(kind, row.querySelector('.bs-memory-result')!, test), 'bs-memory-btn');
    row.append(test, out);
    sec.append(presets, url.row, model.row, key.row, row);
    return sec;
  }
  function extractionSection() {
    const sec = el('section', 'bs-memory-sec'), x = draft.extraction;
    sec.append(el('h3', '', '记忆整理模型'), el('p', 'bs-memory-hint', '每次见面结束后，用一次请求把“关于你的事”整理进记忆（新说法会让旧说法“过时”，不会覆盖历史）。可以换一个便宜的模型；选“不用模型”时只记事件、价格和你的原话。'));
    const modes = el('div', 'bs-memory-row'), fields = el('div');
    for (const [id, label] of [['dialogue', '跟随补给员对话的接口'], ['custom', '独立接口'], ['off', '不用模型']] as const) {
      const b = button(label, () => {draft.extraction.mode = id; markDirty(); for (const m of Array.from(modes.querySelectorAll('button'))) m.setAttribute('aria-pressed', String(m === b)); fields.hidden = id !== 'custom';}, 'bs-memory-btn bs-memory-small');
      b.setAttribute('aria-pressed', String(x.mode === id)); modes.append(b);
    }
    fields.hidden = x.mode !== 'custom';
    fields.append(field('地址', x.url, 'https://api.siliconflow.cn/v1（OpenAI 兼容）', false, v => {draft.extraction.url = v;}).row, field('模型', x.model, 'Qwen/Qwen2.5-7B-Instruct', false, v => {draft.extraction.model = v;}).row, field('密钥', x.key, '只存在这台设备上', true, v => {draft.extraction.key = v;}).row);
    const row = el('div', 'bs-memory-row'), out = resultLine(memory.settings().tests?.extraction);
    const test = button('测试连接', () => void runTest('extraction', row.querySelector('.bs-memory-result')!, test), 'bs-memory-btn');
    row.append(test, out);
    sec.append(modes, fields, row);
    return sec;
  }
  function dangerSection() {
    const sec = el('section', 'bs-memory-sec');
    sec.append(el('h3', '', '让她忘记一切'), el('p', 'bs-memory-hint', '和“杀害”一样：这个存档里她的全部记忆（档案、往事、感想、向量缓存）都会清空，读档也找不回来；下一任补给员不认识你。'));
    const wipe = button('清空记忆', () => {
      if (wipe.dataset.confirm !== 'yes') {wipe.dataset.confirm = 'yes'; wipe.textContent = '确认清空（不可恢复）'; return;}
      wipe.disabled = true; void memory.wipe('manual').then(() => {wipe.textContent = '已清空'; renderStatus();});
    }, 'bs-memory-btn is-danger');
    sec.append(wipe);
    return sec;
  }
  function render() {
    draft = memory.settings(); dirty = false; saved.textContent = '';
    body.replaceChildren(statusSec, viewSec, apiSection('embedding'), apiSection('rerank'), extractionSection(), dangerSection(),
      el('p', 'bs-memory-note', '记忆本身存在这个聊天（存档）里，导出聊天会带上它；密钥只保存在这台设备的浏览器（localStorage），不会写进聊天、存档或导出文件，换设备需要重新填写。'));
    renderStatus();
  }
  const save = button('保存', () => {memory.saveSettings(draft); dirty = false; saved.textContent = '已保存到这台设备'; renderStatus();}, 'bs-memory-btn is-primary');
  foot.append(saved, save);
  root.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') {e.preventDefault(); close(); return;}
    if (e.key !== 'Tab') return;
    const items = Array.from(card.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary')).filter(x => x.offsetParent !== null || x === closeButton);
    if (!items.length) return;
    const first = items[0]!, lastItem = items.at(-1)!;
    if (e.shiftKey && doc.activeElement === first) {e.preventDefault(); lastItem.focus();}
    else if (!e.shiftKey && doc.activeElement === lastItem) {e.preventDefault(); first.focus();}
  });
  const unsubscribe = memory.subscribe(() => {if (!root.hidden) renderStatus();});
  return {
    element: root,
    get open() {return !root.hidden;},
    show(parent?: HTMLElement) {
      if (parent && root.parentElement !== parent) parent.append(root); else if (!root.isConnected) doc.body.append(root);
      opener = doc.activeElement as HTMLElement | null; render(); root.hidden = false; closeButton.focus({preventScroll: true});
    },
    close() {dirty = false; close();},
    dispose() {unsubscribe(); root.remove();},
  };
}
