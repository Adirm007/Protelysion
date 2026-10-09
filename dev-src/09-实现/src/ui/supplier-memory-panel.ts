import type {SupplierMemory} from '../supplier-memory/service';
import {PRESETS, type MemorySettings, type ApiSlot, type TestResult} from '../supplier-memory/apis';
import {gameDom} from './game-dom';

const STYLE_ID = 'booksea-memory-style';
/** 与补给员对话框同一套笔触：深色底、双层描边、衬线标题、金色点缀。自带样式，书间大厅和全屏游戏里都能用。 */
export const SUPPLIER_MEMORY_STYLE = `
.bs-memory{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(ellipse at 50% 40%,#0c101ed6,#030409f0);color:#eee9e0;font:14px/1.6 "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif;letter-spacing:.02em}
.bs-stage .bs-memory,.rpg-ui~.bs-memory{position:absolute}
.bs-memory[hidden]{display:none!important}
.bs-memory *{box-sizing:border-box}
.bs-memory-card{position:relative;display:flex;flex-direction:column;width:min(760px,100%);max-height:calc(100% - 8px);border:1px solid #e0dacecc;background:#101015f2;box-shadow:inset 0 0 0 4px #1b1921,inset 0 0 0 5px #d0c8c188,0 0 0 3px #b0a7a544,0 18px 60px #000c}
.bs-memory-card:before,.bs-memory-card:after{content:'';position:absolute;width:7px;height:7px;border:1px solid #e2d8c9aa;box-shadow:0 0 0 2px #111018;background:#49414d}
.bs-memory-card:before{left:8px;top:8px}.bs-memory-card:after{right:8px;bottom:8px}
.bs-memory-head{position:relative;padding:22px 64px 12px 26px;border-bottom:1px solid #d8b97833}
.bs-memory-head h2{margin:0;font:500 22px/1.4 "Noto Serif SC","Songti SC","SimSun",serif;letter-spacing:.16em;color:#f3e2b4;text-shadow:0 2px 2px #000}
.bs-memory-head p{margin:6px 0 0;color:#b9b2a6;font-size:12.5px}
.bs-memory button{font:inherit;color:inherit;cursor:pointer}
.bs-memory-close{position:absolute;right:16px;top:16px;width:38px;height:38px;border:1px solid #d2cbd66e;background:#101015a3;color:#ddd3ce;font:24px/1 system-ui!important;opacity:.85}
.bs-memory-close:hover,.bs-memory-close:focus-visible{opacity:1;outline:2px solid #d9cba7;outline-offset:2px}
.bs-memory-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 26px 6px;scrollbar-width:thin;scrollbar-color:#9a927f66 transparent}
.bs-memory-sec{margin:0 0 14px;padding:14px 16px;border:1px solid #ded8ca33;background:#14131a99}
.bs-memory-sec h3{display:flex;align-items:center;gap:10px;margin:0 0 6px;font:500 15px/1.5 "Noto Serif SC","Songti SC",serif;letter-spacing:.12em;color:#f1e3c1}
.bs-memory-sec h3:before{content:'';width:7px;height:7px;transform:rotate(45deg);background:#d8b978;flex:none}
.bs-memory-sec h3 .bs-memory-switch{margin-left:auto}
.bs-memory-hint{margin:0 0 10px;color:#a9a294;font-size:12px}
.bs-memory-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:4px 0 10px}
.bs-memory-tile{padding:8px 10px;border:1px solid #d8b97830;background:linear-gradient(180deg,#181d2ecc,#090b13cc);text-align:center}
.bs-memory-tile b{display:block;font:20px/1.3 "Noto Serif SC",Georgia,serif;color:#f3e7c9}.bs-memory-tile span{font-size:11px;color:#c9b98f;letter-spacing:.1em}
.bs-memory-lines{margin:0;padding:0;list-style:none;font-size:12.5px;color:#cfc7b8}.bs-memory-lines li{padding:3px 0;border-bottom:1px dashed #ffffff10}
.bs-memory-lines .is-bad{color:#e3a69a}.bs-memory-lines .is-good{color:#b9d9b0}
.bs-memory-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0 0}
.bs-memory-field{display:grid;grid-template-columns:62px 1fr auto;align-items:center;gap:8px;margin:6px 0}
.bs-memory-field>span{color:#d8c294;font-size:12.5px;letter-spacing:.1em}
.bs-memory input[type=text],.bs-memory input[type=password],.bs-memory input[type=url]{width:100%;min-width:0;padding:8px 10px;border:1px solid #ded8caaa;border-radius:0;background:#0d0d12e8;color:#f3eee4;font:13px/1.4 ui-monospace,Consolas,monospace}
.bs-memory input:focus{outline:2px solid #cdbf9b;outline-offset:1px}
.bs-memory input:disabled{opacity:.5}
.bs-memory-btn{min-height:36px;padding:6px 14px;border:1px solid #ded8caaa;border-radius:0;background:#14131ad9;color:#eee9e0;box-shadow:inset 0 0 0 3px #17161d,inset 0 0 0 4px #99929b55;letter-spacing:.12em;white-space:nowrap}
.bs-memory-btn:hover:not(:disabled),.bs-memory-btn:focus-visible{background:#39333bea;color:#fff8e3;border-color:#fff0cd;outline:2px solid #cdbf9b;outline-offset:2px}
.bs-memory-btn:disabled{opacity:.5;cursor:default}
.bs-memory-btn.is-primary{border-color:#f6e2ae;color:#1d1508;background:linear-gradient(180deg,#f4e0a8,#d8b56c 55%,#b38a45);box-shadow:inset 0 0 0 2px #fff6d659;text-shadow:0 1px 0 #fff0c880}
.bs-memory-btn.is-danger{border-color:#d99a8c;color:#f5d5cc;background:#3a1c1ccc}
.bs-memory-btn[aria-pressed=true]{border-color:#f3dfa8;background:linear-gradient(90deg,#5c4826d9,#121624e6);color:#fff4d4}
.bs-memory-small{min-height:30px;padding:3px 10px;font-size:12px;letter-spacing:.06em}
.bs-memory-switch{position:relative;display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:#d8c294;letter-spacing:.08em;cursor:pointer;user-select:none}
.bs-memory-switch input{position:absolute;opacity:0;width:1px;height:1px}
.bs-memory-switch i{position:relative;width:38px;height:20px;border:1px solid #ded8caaa;background:#0d0d12;flex:none}
.bs-memory-switch i:after{content:'';position:absolute;left:2px;top:2px;width:14px;height:14px;background:#7d7686;transition:transform .15s,background .15s}
.bs-memory-switch input:checked+i{border-color:#f3dfa8;background:#3b3020}.bs-memory-switch input:checked+i:after{transform:translateX(18px);background:#f1d185}
.bs-memory-switch input:focus-visible+i{outline:2px solid #cdbf9b;outline-offset:2px}
.bs-memory-result{font-size:12.5px;color:#b4aeba}.bs-memory-result.is-ok{color:#b9d9b0}.bs-memory-result.is-bad{color:#e3a69a}
.bs-memory-facts{margin:8px 0 0;padding:0;list-style:none}
.bs-memory-facts li{display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px dashed #ffffff12;font-size:13px}
.bs-memory-facts li>span{flex:1;min-width:0;word-break:break-word}
.bs-memory-facts small{display:block;color:#9d968a;font-size:11.5px}
.bs-memory-tag{flex:none;padding:1px 7px;border:1px solid #d8b97866;color:#e6d3a4;font-size:11px;letter-spacing:.06em}
.bs-memory-tag.is-guess{border-color:#a0b4f066;color:#c3d0f3}.bs-memory-tag.is-self{border-color:#c3a8de66;color:#d9c4e7}
.bs-memory details summary{cursor:pointer;color:#f1e3c1;font:500 15px/1.6 "Noto Serif SC","Songti SC",serif;letter-spacing:.12em}
.bs-memory-foot{display:flex;align-items:center;gap:12px;padding:12px 26px 18px;border-top:1px solid #d8b97833}
.bs-memory-foot>span{flex:1;font-size:12.5px;color:#d9c89e}
.bs-memory-note{margin:4px 0 12px;color:#9d968a;font-size:11.5px}
@media(max-width:620px){.bs-memory{padding:6px}.bs-memory-head{padding:18px 56px 10px 18px}.bs-memory-body{padding:12px 14px 4px}.bs-memory-foot{padding:10px 14px 14px}.bs-memory-tiles{grid-template-columns:repeat(2,1fr)}.bs-memory-field{grid-template-columns:1fr auto}.bs-memory-field>span{grid-column:1/-1}}
@media(pointer:coarse){.bs-memory input[type=text],.bs-memory input[type=password],.bs-memory input[type=url]{font-size:16px}}
@media(prefers-reduced-motion:reduce){.bs-memory-switch i:after{transition:none}}
`;

type Kind = 'embedding' | 'rerank' | 'extraction';
const SOURCE: Record<string, [string, string]> = {player: ['亲口说的', ''], inferred: ['她的猜测', ' is-guess'], self: ['她自己说的', ' is-self'], observed: ['看到的', '']};
const time = (at: number) => {const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;};

/** 补给员记忆与接口设置。所有改动先进草稿，“保存”才写入本机；测试连接用草稿里的值。 */
export function mountSupplierMemoryPanel(doc: Document, memory: SupplierMemory) {
  const {el, button} = gameDom(doc);
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
  function renderView(v = memory.view()) {
    viewSec.replaceChildren();
    const details = doc.createElement('details'), summary = el('summary', '', `她记得的事（${v.facts.length} 条 · ${v.episodes.length} 段近事）`);
    details.append(summary, el('p', 'bs-memory-hint', '这些只是给你看的，不会原样念给你听。记错了就点“忘掉”，她会彻底忘了这一条。'));
    const list = el('ul', 'bs-memory-facts');
    for (const f of v.facts) {
      const row = el('li'), [label, cls] = SOURCE[f.source] ?? ['', ''], text = el('span', '', f.text);
      if (f.history.length) text.append(el('small', '', '以前：' + f.history.join('、') + '（已过时）'));
      text.append(el('small', '', `第 ${f.n} 次见面记下`));
      const forget = button('忘掉', () => {if (forget.dataset.confirm !== 'yes') {forget.dataset.confirm = 'yes'; forget.textContent = '确认忘掉'; return;} void memory.forget(f.id).then(() => renderStatus());}, 'bs-memory-btn bs-memory-small');
      row.append(el('span', 'bs-memory-tag' + cls, label), text, forget); list.append(row);
    }
    if (!v.facts.length) list.append(el('li', '', v.epoch > 1 ? '新上任的补给员还不认识你。' : '她还不知道关于你的事。'));
    for (const e of v.episodes) list.append(el('li', '', e.line));
    for (const r of v.reflections) {const row = el('li'); row.append(el('span', 'bs-memory-tag is-guess', '感想'), el('span', '', r.text)); list.append(row);}
    for (const d of v.digests) {const row = el('li'); row.append(el('span', 'bs-memory-tag', '旧账'), el('span', '', d)); list.append(row);}
    details.append(list); viewSec.append(details);
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
