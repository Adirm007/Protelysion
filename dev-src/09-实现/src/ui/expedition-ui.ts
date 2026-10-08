import {mountSupplierDialogue} from './supplier-dialogue';
import type {UIAudioFeedback} from '../audio/types';
import {rewardLabel,rewardDetail} from '../core/settlement';
import {mountJoystick, INTERACT_ICON} from './mobile-controls';
import {mountBattleStage} from './battle-stage';
import {mountGameViewport} from './game-viewport';
import {RPG_STYLE} from './rpg-style';
import {TITLE_ART} from './art-title';
import {applyHostAvatar} from './host-avatar';

const MENU_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.2C9 4.3 5.6 4.2 3 5.2v13.6c2.6-1 6-.9 9 1 3-1.9 6.4-2 9-1V5.2c-2.6-1-6-.9-9 1Z"/><path d="M12 6.2v13.6M6 9.2c1.4-.3 2.8-.2 4 .4M6 12.6c1.4-.3 2.8-.2 4 .4M14 9.6c1.2-.6 2.6-.7 4-.4"/></svg>';
const FULL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const EXIT_FULL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
import {gameDom, resourceNumber as number, type SendGameInput} from './game-dom';
import type {GameView, BattleCue} from '../presentation/battle-cues';

type TitleView = {mode: string; canContinue: boolean};
/** Short in-world prompt shown while standing next to something; only things that need one. */
const NEARBY_TIPS: Record<string, string> = {camp: '椅子可以坐'};
export function mountExpeditionUI(stage: HTMLElement, send: SendGameInput, options: {portraits?: Record<string, string>; onResources?: () => void; feedback?: UIAudioFeedback} = {}) {
  const doc = stage.ownerDocument, win = doc.defaultView!, {el, button} = gameDom(doc), viewport = mountGameViewport(stage, win);
  if (!doc.getElementById('booksea-rpg-style')) {const css = el('style'); css.id = 'booksea-rpg-style'; css.textContent = RPG_STYLE; doc.head.append(css);}
  const ui = el('div', 'rpg-ui'), hud = el('div', 'rpg-hud'), place = el('span', 'rpg-place'), menuButton = button('☰', () => send('pause'), 'rpg-menu-button'), toast = el('div', 'rpg-toast'), nearbyTip = el('div', 'rpg-nearby'), explore = el('div', 'rpg-explore-actions'), pad = el('div', 'rpg-pad'), battle = el('section'), shade = el('div', 'rpg-menu-shade'), panel = el('section', 'rpg-window'), header = el('div', 'rpg-window-header'), title = el('h2'), tabs = el('nav', 'rpg-menu-tabs'), body = el('div', 'rpg-menu-body'), audioRoot = el('div', 'rpg-audio'), footer = el('div', 'rpg-menu-footer');
  menuButton.innerHTML = MENU_ICON; menuButton.setAttribute('aria-label', '打开菜单'); const placeName = el('b', 'rpg-place-name'), placeSub = el('span', 'rpg-place-sub'); place.append(placeName, placeSub); hud.append(place, menuButton);
  const interaction = button('', () => {if(current && 'party' in current && current.mode==='battle')battleUI.activate();else send('interact');}, 'rpg-interact');
  interaction.innerHTML=INTERACT_ICON;interaction.setAttribute('aria-label','交互');interaction.title='E / 空格 / 回车';interaction.oncontextmenu=e=>e.preventDefault();
  const helpText=el('span', 'rpg-help');helpText.innerHTML='<kbd>WASD</kbd>移动<kbd>E</kbd>交互<kbd>Esc</kbd>旅途手记';explore.append(helpText,interaction);
  const joystick=mountJoystick(pad,send);
  const close = button('×', () => send('pause'), 'rpg-back'); close.setAttribute('aria-label', '关闭菜单');
  const sub = el('span', 'rpg-window-sub'), side = el('div', 'rpg-menu-side');
  header.append(title, sub, close); panel.append(header, tabs, body, audioRoot, footer, side); shade.style.setProperty('--rpg-title-art', `url("${TITLE_ART}")`); shade.append(panel); shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', '远征菜单');
  // 「?」刷出弹框：无立绘、无发言人；点掉之前谁都不能动。
  const warn = el('div', 'rpg-warning'), warnText = el('p', 'rpg-warning-text'), warnButton = button('……', () => send('dismissWarning'), 'rpg-warning-button');
  const warnBox = el('div', 'rpg-warning-box');
  warnBox.append(warnText, warnButton); warn.append(warnBox); warn.setAttribute('role', 'alertdialog'); warn.setAttribute('aria-modal', 'true'); warn.addEventListener('click', e => {if (e.target === warn) send('dismissWarning');});
  // 全屏：探索/战斗/对话时在右上角书本图标正下方；打开任何面板时出现在面板关闭键旁。两处永远只显示一处。
  const isFull = () => doc.fullscreenElement === stage || stage.classList.contains('is-fullscreen');
  const toggleFull = () => {void viewport.toggleFullscreen().then(syncFull);};
  const fullFloat = button('', toggleFull, 'rpg-fullscreen'), fullInline = button('', toggleFull, 'rpg-fullscreen-inline');
  let fullShown: boolean | undefined;
  function syncFull() {const on = isFull(); if (on === fullShown) return; fullShown = on; for (const b of [fullFloat, fullInline]) {b.innerHTML = on ? EXIT_FULL_ICON : FULL_ICON; b.setAttribute('aria-label', on ? '退出全屏' : '全屏游玩'); b.title = on ? '退出全屏' : '全屏游玩';}}
  fullFloat.id = 'fullscreen'; syncFull(); header.insertBefore(fullInline, close);
  // 入口返程确认。
  const leave = el('div', 'rpg-warning rpg-exit-ask'), leaveBox = el('div', 'rpg-warning-box'), leaveRow = el('div', 'rpg-exit-actions');
  leaveRow.append(button('返程', () => send('exitAnswer', {yes: true}), 'rpg-warning-button is-primary'), button('继续探索', () => send('exitAnswer', {yes: false}), 'rpg-warning-button'));
  leaveBox.append(el('p', 'rpg-warning-text', '入口'), leaveRow); leave.append(leaveBox); leave.setAttribute('role', 'dialog'); leave.setAttribute('aria-modal', 'true'); leave.hidden = true;
  leave.addEventListener('click', e => {if (e.target === leave) send('exitAnswer', {yes: false});});
  ui.append(battle, hud, explore, pad, toast, nearbyTip, shade, warn, leave, fullFloat); nearbyTip.hidden = true; nearbyTip.setAttribute('aria-live', 'polite'); stage.append(ui); warn.hidden = true;
  battle.hidden = shade.hidden = hud.hidden = explore.hidden = pad.hidden = toast.hidden = true;
  let current: GameView | TitleView | undefined, tab = 'party', menuKey = '', unitId = '', previousMode = '', notice = '', noticeUntil = 0;
  const supplierUI = mountSupplierDialogue(ui, send, options.feedback);
  const battleUI = mountBattleStage(battle, send, options.portraits ?? {}, id => {unitId = id; tab = 'battle'; menuKey = ''; if (current && 'paused' in current && !current.paused) send('pause');}, options.feedback);
  const confirm = (text: string, fn: () => void) => {const b = button(text, () => {if (b.dataset.confirm === 'yes') fn(); else {b.dataset.confirm = 'yes'; b.textContent = '确认' + text;}}); return b;};
  function section(heading: string, description = '') {const s = el('section'); s.append(el('h3', '', heading)); if (description) s.append(el('p', '', description)); body.append(s); return s;}
  function meter(label: string, kind: string, value: number, max?: number) {
    const m = el('div', 'rpg-meter ' + kind), pct = max ? Math.max(0, Math.min(100, value / Math.max(1, max) * 100)) : 100, amount = el('b', '', number(value)), bar = el('i'), fill = el('em');
    if (max) amount.append(el('small', '', ' / ' + number(max))); if (kind === 'hp' && max && pct <= 30) m.classList.add('is-low');
    fill.style.width = pct + '%'; bar.append(fill); m.append(el('span', '', label), amount, bar); return m;
  }
  function ledger(heading: string) {const s = el('section', 'rpg-ledger'); s.append(el('h3', '', heading)); body.append(s); return s;}
  function ledgerRow(parent: HTMLElement, label: string, value: string, detail = '') {const row = el('div', 'rpg-ledger-row'); row.append(el('span', '', label), el('b', '', value)); if (detail) row.append(el('small', '', detail)); parent.append(row); return row;}
  function tiles(items: [string, string][]) {const t = el('div', 'rpg-tiles'); for (const [label, value] of items) {const tile = el('div', 'rpg-tile'); tile.append(el('span', '', label), el('b', '', value)); t.append(tile);} body.append(t); return t;}
  function renderMenu(v: GameView) {
    const key = JSON.stringify([tab, unitId, v.mode, v.paused, v.writeback, v.depth, v.event, v.party.map(p => [p.id, p.hp, p.mp, p.sp, p.status]), v.battle.units.map(u => [u.id, u.hp, u.mp, u.sp, u.statuses]), v.settings, v.relicDetails, v.loot, v.settlement, v.cross]);
    if (key === menuKey) return; menuKey = key;
    const oldScroll = body.scrollTop; body.replaceChildren(); footer.replaceChildren(); tabs.replaceChildren();
    audioRoot.hidden = true; close.hidden = !v.paused; tabs.hidden = !v.paused; sub.textContent = ''; side.replaceChildren();
    panel.classList.toggle('is-menu', v.paused); panel.classList.toggle('is-event', !v.paused && v.mode === 'event'); panel.classList.toggle('is-ended', !v.paused && v.mode === 'ended');
    if (v.paused) {
      title.textContent = '旅途手记'; sub.textContent = `第 ${v.depth} 层 · ${v.themeName} · ${v.region.name}`;
      for (const [label, value] of [['盲盒', number(v.boxes)], ['素材', number(v.materials ?? 0)], ['待结算 FP', number(v.pendingFp ?? v.fp)]]) {const row = el('div'); row.append(el('span', '', label!), el('b', '', value!)); side.append(row);}
      for (const [id, name] of [['party', '队伍'], ['bag', '行囊'], ['relic', '遗物'], ['battle', '战况'], ['settings', '设置']]) {
        if (id === 'battle' && v.mode !== 'battle') continue;
        const b = button(name!, () => {tab = id!; menuKey = ''; renderMenu(v);}); b.setAttribute('aria-pressed', String(id === tab)); tabs.append(b);
      }
      if (tab === 'party') {
        for (const p of v.party) {
          const card = el('section', 'rpg-member' + (p.status === 'active' ? '' : ' is-away')), art = el('div', 'rpg-member-art'), info = el('div', 'rpg-member-info'), top = el('div', 'rpg-member-top'), bars = el('div', 'rpg-member-bars'), actions = el('div', 'rpg-member-actions');
          const portrait = options.portraits?.[p.id];
          if (portrait) {const img = el('img'); img.src = portrait; img.alt = ''; img.draggable = false; img.referrerPolicy = 'no-referrer'; img.onerror = () => {img.remove(); art.append(el('span', '', [...p.name][0] ?? '旅'));}; art.append(img);} else art.append(el('span', '', [...p.name][0] ?? '旅'));
          top.append(el('h3', '', p.name), el('span', 'rpg-member-meta', `Lv ${p.level ?? '—'}`)); if (p.status !== 'active') top.append(el('span', 'rpg-member-tag', '已离队'));
          bars.append(meter('HP', 'hp', p.hp, p.maxHp), meter('MP', 'mp', p.mp, p.maxMp), meter('SP', 'sp', p.sp, p.maxSp));
          info.append(top, bars); card.append(art, info, actions); body.append(card);
          if (p.status !== 'active' || v.mode !== 'explore') continue;
          for (const a of p.outsideActions) {
            const d = el('details'); d.append(el('summary', '', a.name), el('p', '', a.description)); const controls = el('div', 'rpg-menu-actions');
            if (a.rest) controls.append(confirm('使用', () => send('outsideSkill', {actor: p.id, id: a.id, targets: [p.id]})));
            else for (const target of a.target === 'self' ? [p] : v.party.filter(p => p.status === 'active')) controls.append(button(a.target === 'self' ? '使用' : '对' + target.name + '使用', () => send('outsideSkill', {actor: p.id, id: a.id, targets: [target.id]})));
            d.append(controls); actions.append(d);
          }
        }
      } else if (tab === 'bag') {
        tiles([['盲盒', number(v.boxes)], ['素材', number(v.materials ?? 0)], ['待结算 FP', number(v.pendingFp ?? v.fp)]]);
        if (v.bag?.length) section('药剂（战斗中可用）', v.bag.map(b => `${b.name} ×${b.count} · ${b.description}`).join('\n'));
        if (v.bell) {const bell = section('传唤铃', `剩余 ${v.bell} 次：摇铃后补给员出现在身旁。`); if (v.mode === 'explore') bell.append(confirm('摇铃', () => send('ringBell')));}
        if (v.cross?.held) {const cross = section('银十字', '战斗中：队伍不足四人时，「?」前来助战（每趟一次' + (v.cross.used ? '，本趟已用' : '') + '）\n探索中：' + (v.cross.ward ? '不会遭遇「?」' : '可能遭遇「?」')); if (v.mode === 'explore') cross.append(button(v.cross.ward ? '放下银十字' : '举起银十字', () => send('crossWard')));}
        else if (v.cross && v.cross.threads >= v.cross.need) {const thread = section(`暧昧的线 ×${v.cross.threads}`); if (v.mode === 'explore') thread.append(confirm('合成「银十字」', () => send('craftCross')));}
        for (const r of v.loot) section(`${rewardLabel(r)} ×${r.count}`, rewardDetail(r));
        if (!v.loot.length) body.append(el('p', 'rpg-menu-empty', '还没有新的战利品'));
      } else if (tab === 'relic') {
        if (v.relicSlots?.length) tiles(v.relicSlots.map(p => [p.name + ' · 遗物槽', `${p.used} / ${p.capacity}`] as [string, string]));
        if (!v.relicDetails.length) body.append(el('p', 'rpg-menu-empty', '尚未获得遗物'));
        for (const r of v.relicDetails) {const s = section(`${r.name ?? '遗物'}（${r.ownerName}）`, r.description); if (r.rarity) s.querySelector('h3')!.append(el('span', 'rpg-tag', r.rarity)); if (v.mode === 'explore') {for (const t of r.transferTargets ?? []) s.append(confirm('交给 ' + t.name, () => send('transferRelic', {id: r.id, owner: r.owner, to: t.id}))); if (r.droppable) s.append(confirm('丢弃', () => send('removeRelic', {id: r.id, owner: r.owner})));}}
      } else if (tab === 'battle') {
        const units = [...v.battle.units].sort((a, b) => Number(b.id === unitId) - Number(a.id === unitId));
        for (const u of units) {
          const s = section(u.name + (u.alive ? '' : ' · 倒地') + (u.charmed ? ' · 失控中（由敌方操控）' : ''), `HP ${number(u.hp)} / ${number(u.maxHp)}　MP ${number(u.mp)} / ${number(u.maxMp)}　SP ${number(u.sp)} / ${number(u.maxSp)}\n护盾 ${number(u.shield)}　物防 ${number(u.armor.physical)}　能量防御 ${number(u.armor.energy)}　精神防御 ${number(u.armor.mental)}`);
          if (u.passives.length) s.append(el('p', '', '常驻：' + u.passives.join('、')));
          if (u.counters?.length) s.append(el('p', '', '公开计数：' + u.counters.join('、')));
          for (const effect of u.statuses) s.append(el('p', '', effect.name + ' · ' + effect.description));
          for (const ability of u.monsterAbilities) {const d = el('details'); d.append(el('summary', '', ability.name), el('p', '', ability.description)); s.append(d);}
        }
        if (v.battle.fields.length) section('场地效果', v.battle.fields.map(f => '持续效果 · 剩余 ' + Math.max(0, Math.ceil(f.remaining))).join('\n'));
      } else if (tab === 'settings') {
        const quality = section('画面'), qualityRow = el('div', 'rpg-menu-actions');
        for (const [id, name] of [['desktop', '标准画质'], ['mobile', '轻量画质']]) {const b = button(name!, () => send('settings', {graphicsQuality: id})); b.setAttribute('aria-pressed', String((v.settings?.graphicsQuality === 'mobile' ? 'mobile' : 'desktop') === id)); qualityRow.append(b);} quality.append(qualityRow);
        const effect = section('战斗演出'), row = el('div', 'rpg-menu-actions');
        for (const speed of [1, 2, 3]) {const b = button('速度 ×' + speed, () => send('settings', {animationSpeed: speed})); b.setAttribute('aria-pressed', String(v.settings?.animationSpeed === speed)); row.append(b);}
        row.append(button(v.settings?.shake ? '震屏：开' : '震屏：关', () => send('settings', {shake: !v.settings?.shake})), button(v.settings?.flash ? '闪光：开' : '闪光：关', () => send('settings', {flash: !v.settings?.flash}))); effect.append(row);
        if (options.onResources) body.append(button('资源管理', () => {if(doc.fullscreenElement===stage||stage.classList.contains('is-fullscreen'))void viewport.toggleFullscreen().then(options.onResources);else options.onResources?.();})); body.append(audioRoot); audioRoot.hidden = false;
      }
      if (v.source !== 'host') {const restart = confirm('重新启程', () => send('new')); restart.id = 'lobby'; footer.append(restart);}
      if (v.narrativeReady) {const narrative = confirm('正文模式', () => send('narrative')); narrative.title = '缓存当前进度，回到聊天里用正文继续冒险；之后可随时切回迷宫模式'; footer.append(narrative);}
      footer.append(button('继续远征', () => send('pause'), 'is-primary'));
    } else if (v.mode === 'event' && v.event) {
      title.textContent = v.event.title; body.append(el('p', '', v.event.body));
      const owners = el('div', 'rpg-menu-actions rpg-owner-row'); owners.append(el('span', '', '由谁出面'));
      for (const p of v.party.filter(p => p.status === 'active')) {const b = button(p.name, () => send('eventOwner', {id: p.id})); b.setAttribute('aria-pressed', String(p.id === v.event?.owner)); owners.append(b);} body.append(owners);
      for (const [index, c] of v.event.choices.entries()) {const b = button(c.label, () => send('event', {choice: index}), 'rpg-choice', c.disabled); b.title = c.reason;const description=el('small','rpg-event-description',c.description);description.style.cssText='display:block;white-space:pre-line;text-align:left;line-height:1.6;font-weight:normal;margin-top:8px';b.append(description);body.append(b);}
    } else if (v.mode === 'ended') {
      title.textContent = v.outcome === 'success' ? '远征归来' : '这一趟，到此为止'; sub.textContent = `抵达第 ${v.depth} 层 · 战斗胜利 ${v.fights} 场`;
      const host = el('div', 'rpg-ended-host'), bust = el('img'), line = el('p', '', v.outcome === 'success' ? '欢迎回来。这一页，我替你收好了。' : v.settlement?.keptOnDefeat ? '没关系……途中拾到的东西，我都替你留下了。' : '没关系……合上的书，总还能再翻开。');
      applyHostAvatar(bust, doc.defaultView); bust.alt = '夜梦'; bust.draggable = false; line.prepend(el('small', '', '夜梦')); host.append(bust, line); body.append(host);
      const exp = v.settlement?.experience ?? [], rewards = v.settlement?.rewards ?? [];
      if (exp.length) {const s = ledger('经验'); for (const p of exp) ledgerRow(s, p.ref.kind === 'player' ? '主角' : p.ref.name, '+' + number(p.amount));}
      if (rewards.length) {const s = ledger('收获'); for (const r of rewards) ledgerRow(s, rewardLabel(r), '×' + r.count);}
      const pending = v.source === 'host' && !v.settlement?.committed;
      if (pending) body.append(el('p', '', v.writeback === 'error' ? '暂未保存，点击重试。' : '正在保存收获……'));
      if (v.writeback === 'error') footer.append(button('重试保存', () => send('handoff')));
      footer.append(button(v.source === 'host' ? '回到书间' : '再启一趟', () => send('new'), 'is-primary', pending));
    }
    body.scrollTop = oldScroll;
  }
  function render(v: GameView | TitleView, busy = false) {
    current = v;
    if (!('party' in v)) {
      supplierUI.render(null);
      fullFloat.hidden = false; fullInline.hidden = true; leave.hidden = true; syncFull();
      joystick.setEnabled(false); battle.hidden = hud.hidden = explore.hidden = pad.hidden = toast.hidden = true; shade.hidden = false;
      if (previousMode !== 'title') {menuKey = ''; panel.classList.remove('is-menu', 'is-event', 'is-ended'); panel.classList.add('rpg-title'); shade.classList.add('is-title'); side.replaceChildren(); title.textContent = '普罗泰利西翁'; sub.textContent = 'PROTELYSION'; close.hidden = tabs.hidden = audioRoot.hidden = true; body.replaceChildren(el('p', '', '万千书页，等你启程。')); footer.replaceChildren(); if (v.canContinue) footer.append(button('继续旅程', () => send('continue'))); footer.append(button('开始旅程', () => send('new')), el('span', 'rpg-title-mark', 'ADIRM007 · 书海迷宫'));}
      previousMode = 'title'; return;
    }
    panel.classList.remove('rpg-title'); shade.classList.remove('is-title');
    supplierUI.render(v);
    const inBattle = v.mode === 'battle';
    ui.style.setProperty('--rpg-speed', String(v.settings?.animationSpeed ?? 1));
    if (previousMode !== v.mode) {menuKey = ''; if (inBattle) battleUI.reset(); joystick.stop();}
    stage.classList.toggle('is-battle', inBattle); battle.hidden = !inBattle; hud.hidden = v.mode === 'supplier' && !v.paused; place.hidden = inBattle; placeName.textContent = v.themeName; placeSub.textContent = `第 ${v.depth} 层 · ${v.region.name}`;
    const warning = 'warning' in v ? String((v as {warning?: string}).warning ?? '') : '';
    if (warn.hidden === !!warning) {warn.hidden = !warning; if (warning) {warnText.textContent = warning; warnButton.focus({preventScroll: true});}}
    pad.hidden = v.mode !== 'explore' || v.paused || !!warning || !!v.exitAsk; joystick.setEnabled(!pad.hidden); menuButton.hidden = v.mode === 'ended';
    menuButton.setAttribute('aria-label', v.paused ? '关闭菜单' : '打开菜单');
    shade.hidden = !v.paused && v.mode !== 'event' && v.mode !== 'ended';
    fullInline.hidden = shade.hidden; fullFloat.hidden = !shade.hidden; syncFull();
    leave.hidden = !(v.exitAsk && v.mode === 'explore' && !v.paused);
    if (inBattle) battleUI.render(v, busy);
    const battleInteraction=inBattle&&!v.paused&&!busy&&battleUI.choosing();
    explore.hidden=(v.mode!=='explore'||v.paused)&&!battleInteraction;explore.classList.toggle('is-battle-control',battleInteraction);helpText.hidden=battleInteraction;
    if (!shade.hidden) renderMenu(v);
    if (notice !== v.notice) {notice = v.notice; noticeUntil = win.performance.now() + 4200; toast.textContent = notice;}
    toast.hidden = v.mode === 'supplier' || inBattle || !shade.hidden || !notice || win.performance.now() > noticeUntil;
    const tip = v.mode === 'explore' && !v.paused && !warning && !v.exitAsk && shade.hidden ? NEARBY_TIPS[v.nearby?.kind ?? ''] ?? '' : '';
    if (nearbyTip.textContent !== tip) nearbyTip.textContent = tip;
    nearbyTip.hidden = !tip;
    if (v.paused) joystick.stop();
    previousMode = v.mode;
  }
  function keydown(e: KeyboardEvent) {
    if (stage.hidden || !stage.isConnected || !current) return;
    const target = e.target as HTMLElement | null;
    if (target?.matches('input,textarea,select')) return;
    // This listener is scoped to this game's document and never captures another host frame.
    if (target && target !== doc.body && !stage.contains(target)) return;
    if (supplierUI.keydown(e)) return;
    if ('party' in current && current.mode==='battle' && !current.paused && ['Enter','Space','KeyE'].includes(e.code)) {
      e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
      if(e.shiftKey&&e.code==='Space'&&battleUI.toggleTarget())return;
      if(battleUI.activate())return;
      const active=doc.activeElement as HTMLButtonElement|null;
      if(active?.matches('.rpg-commands button:not(:disabled)'))active.click();
      else battle.querySelector<HTMLButtonElement>('.rpg-commands:not([hidden]) button:not(:disabled)')?.click();
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if ('party' in current && current.mode === 'battle' && !current.paused && battleUI.back()) return;
      if ('party' in current && current.mode !== 'ended') send('pause'); return;
    }
    if (e.code === 'KeyE' && 'party' in current && (current.mode === 'explore' || current.paused)) {e.preventDefault(); e.stopImmediatePropagation(); send(current.paused ? 'pause' : 'interact'); return;}
    if ('party' in current && current.mode === 'battle' && !current.paused && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.code)) {
      if (battleUI.navigate(e.code)) {e.preventDefault(); e.stopImmediatePropagation(); return;}
      const scope = target?.closest('.rpg-action-window') ?? battle.querySelector('.rpg-commands')!;
      const choices = Array.from(scope.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(b => b.getClientRects().length);
      if (!choices.length) return; const index = choices.indexOf(doc.activeElement as HTMLButtonElement), next = index + (['ArrowUp', 'ArrowLeft'].includes(e.code) ? -1 : 1);
      const nextButton = choices[(next + choices.length) % choices.length];
      if (nextButton && nextButton !== doc.activeElement) {nextButton.focus(); options.feedback?.cue('ui.move');}
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }
  const fullscreenChanged = () => {syncFull(); menuKey = ''; if(current && 'party' in current && current.paused)renderMenu(current);};
  doc.addEventListener('fullscreenchange', fullscreenChanged);
  doc.addEventListener('keydown', keydown, true);
  return {render, audioRoot, setArt(id: string, url: string) {if (!supplierUI.setArt(id, url)) battleUI.setArt(id, url);}, playCue(cue: BattleCue, v: GameView) {render(v, true); battleUI.cue(cue, v);}, dispose() {supplierUI.dispose();joystick.dispose();battleUI.dispose(); doc.removeEventListener('fullscreenchange', fullscreenChanged); doc.removeEventListener('keydown', keydown, true); viewport.dispose(); ui.remove();}};
}
