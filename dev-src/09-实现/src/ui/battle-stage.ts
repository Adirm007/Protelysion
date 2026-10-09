import {BATTLE_FEEDBACK_STYLE} from './battle-feedback-style';
import {mountTargetArrow} from './target-arrow';
import type {UIAudioFeedback} from '../audio/types';
import {actionCost, actionPreviewText, actionUnavailableText, nextActionIndex, groupActions, type GameView, type BattleUnitView, type BattleCue, type ActionView} from '../presentation/battle-cues';
import {gameDom, resourceNumber as number, ratio, type SendGameInput} from './game-dom';

type Widget = {node: HTMLButtonElement; name: HTMLElement; image?: HTMLImageElement; badges?: HTMLElement; bars?: Record<string, {value: HTMLElement; fill: HTMLElement}>; atb?: HTMLElement; hp?: HTMLElement; fill?: HTMLElement};
export function mountBattleStage(root: HTMLElement, send: SendGameInput, portraits: Record<string, string>, inspect: (id: string) => void, feedback?: UIAudioFeedback) {
  const {el, button} = gameDom(root.ownerDocument), log = el('div', 'rpg-battle-log'), enemies = el('div', 'rpg-enemies'), dock = el('div', 'rpg-party-dock'), party = el('div', 'rpg-party'), commands = el('nav', 'rpg-commands'), actions = el('section', 'rpg-action-window'), help = el('section', 'rpg-skill-help'), summons = el('div', 'rpg-summons');
  const feedbackStyle = el('style'); feedbackStyle.textContent = BATTLE_FEEDBACK_STYLE; root.append(feedbackStyle);
  root.classList.add('rpg-battle'); log.setAttribute('role', 'status'); log.setAttribute('aria-live', 'polite'); commands.setAttribute('aria-label', '战斗指令'); actions.setAttribute('aria-label', '技能与目标');
  help.setAttribute('aria-label', '当前技能介绍'); actions.hidden = help.hidden = true;
  dock.append(party, commands); root.append(log, enemies, summons, dock, help, actions);
  const widgets = new Map<string, Widget>(), art = new Map<string, string>();
  let arrowCleanups: (() => void)[] = [];
  let current: GameView | undefined, rosterKey = '', menuKey = '', actor = '', category = '', detail = '', cue: BattleCue | undefined, performing = false, browseScroll = 0, focusedTarget = '', targetKey = '', touchTarget = '', touchAction = '';
  function image(src: string, name: string, css: string) {
    const img = el('img', css); img.alt = name; img.draggable = false; img.referrerPolicy = 'no-referrer';
    img.onload = () => {img.hidden = false;};img.onerror = () => {img.hidden = true;img.setAttribute('data-art-error','decode');}; if (src) img.src = src; else img.hidden = true; return img;
  }
  const targetReady = () => !!current?.battle.selected && !!current?.battle.ready && !current?.paused && !performing;
  const selectedAction = () => allActions().find(a => a.id === current?.battle.selected);
  const multipleTargets = () => selectedAction()?.targeting.selection === 'manual' && (selectedAction()?.targeting.count ?? 1) > 1;
  function focusTargetUnit(id: string) {
    if (!targetReady() || !current!.battle.targets.includes(id)) return;
    if (focusedTarget !== id) feedback?.cue('ui.move');
    focusedTarget = id; root.dataset.targetCursor = id;
    for (const unit of current!.battle.units) updateUnit(unit);
  }
  function commitTarget() {
    if (!targetReady() || !current!.battle.targets.includes(focusedTarget)) return;
    feedback?.cue('ui.confirm');
    if (multipleTargets()) {
      const picked = current!.battle.selectedTargets, max = selectedAction()?.targeting.count ?? 1;
      if (!picked.includes(focusedTarget)) {
        if (picked.length >= max) send('target', {id: picked[picked.length - 1]});
        send('target', {id: focusedTarget});
      }
      send('confirmTargets');
    } else send('target', {id: focusedTarget});
  }
  function bindTargetInput(node: HTMLButtonElement, u: BattleUnitView) {
    let pointer = 'mouse';
    node.onpointerdown = e => {pointer = e.pointerType;};
    node.onpointermove = e => {if (e.pointerType === 'mouse' && (e.movementX || e.movementY) && targetReady()) focusTargetUnit(u.id);};
    node.onclick = e => {
      if (performing) return;
      if (!targetReady()) {inspect(u.id); return;}
      e.preventDefault(); e.stopPropagation();
      if (!current!.battle.targets.includes(u.id)) return;
      const again = touchTarget === u.id && focusedTarget === u.id;
      focusTargetUnit(u.id);
      if (e.detail >= 2 || e.detail === 0 || (pointer !== 'mouse' && again)) {commitTarget(); touchTarget = '';}
      else {touchTarget = u.id; if (multipleTargets()) {feedback?.cue('ui.confirm'); send('target', {id: u.id});}}
    };
    node.oncontextmenu = e => e.preventDefault();
  }
  function makeUnit(u: BattleUnitView): Widget {
    const ally = u.side === 'ally', node = button('', () => {}, ally ? 'rpg-party-card' : 'rpg-enemy'), name = el('span', ally ? 'rpg-party-name' : 'rpg-enemy-name', u.name);
    node.dataset.unit = u.id; node.setAttribute('aria-label', u.name); node.title = u.name; bindTargetInput(node,u);
    if (!ally) {
      const img = image(art.get(u.artId) ?? '', u.name, 'rpg-enemy-art'), head = el('div', 'rpg-enemy-head'), health = el('div', 'rpg-enemy-hp'), track = el('span', 'rpg-mini-hp'), fill = el('i'), hp = el('span');
      track.append(fill); health.append(track, hp); head.append(name, health); node.append(head, img);
      if (!u.artId) node.append(el('div', 'rpg-enemy-sigil', '✧'));
      arrowCleanups.push(mountTargetArrow(node,img)); enemies.append(node); return {node, name, image: img, hp, fill};
    }
    const portrait = image(portraits[u.id] ?? '', u.name + '的头像', 'rpg-party-portrait'), letter = el('span', 'rpg-monogram', [...u.name][0] ?? '旅');
    const info = el('div', 'rpg-party-info'), badges = el('div', 'rpg-badges'), atb = el('div', 'rpg-atb'), atbFill = el('i'), bars: NonNullable<Widget['bars']> = {};
    atb.append(atbFill); info.append(name); node.append(letter, portrait, atb, badges, info);
    for (const key of ['hp', 'mp', 'sp']) {
      const row = el('div', 'rpg-resource ' + key), label = el('span', '', key.toUpperCase()), value = el('b'), track = el('i'), fill = el('em');
      track.append(fill); row.append(label, value, track); info.append(row); bars[key] = {value, fill};
    }
    arrowCleanups.push(mountTargetArrow(node,portrait,true)); party.append(node); return {node, name, image: portrait, badges, bars, atb: atbFill};
  }
  function updateUnit(u: BattleUnitView) {
    const w = widgets.get(u.id); if (!w) return;
    w.node.classList.toggle('is-down', !u.alive); w.node.classList.toggle('is-active', u.id === current?.battle.actorId);
    w.node.classList.toggle('is-target', targetReady() && focusedTarget === u.id); w.node.classList.toggle('is-selected', current?.battle.selectedTargets.includes(u.id) ?? false);
    w.node.setAttribute('aria-label', `${u.name}，HP ${number(u.hp)} / ${number(u.maxHp)}${u.alive ? '' : '，倒地'}`);
    w.name.textContent = u.name; if (w.node.dataset.phase !== (u.phase ?? '')) w.node.dataset.phase = u.phase ?? '';
    if (w.hp && w.fill) {w.hp.textContent = number(u.hp) + ' / ' + number(u.maxHp); w.fill.style.width = ratio(u.hp, u.maxHp);}
    if (w.image && u.side === 'enemy') {const url = art.get(u.artId); if (url && w.image.src !== url) {w.image.src = url; w.image.hidden = false;}}
    if (w.atb) w.atb.style.width = ratio(u.atb, 100);
    if (w.bars) for (const [key, max] of [['hp', u.maxHp], ['mp', u.maxMp], ['sp', u.maxSp]] as const) {
      w.bars[key]!.value.textContent = `${number(u[key])} / ${number(max)}`; w.bars[key]!.fill.style.width = ratio(u[key], max);
    }
    if (w.badges) {
      const labels = [...(!u.alive ? ['☠'] : []), ...(u.charmed ? ['⇄失控'] : []), ...(u.counters ?? []), ...(u.shield > 0 ? ['盾 ' + number(u.shield)] : []), ...u.statuses.slice(0, 3).map(s => s.name + (s.stacks > 1 ? '×' + s.stacks : ''))];
      if (w.badges.dataset.key !== labels.join('|')) {w.badges.replaceChildren(...labels.map(t => {const b = el('span', 'rpg-badge', [...t].slice(0, 5).join('')); b.title = t; return b;})); w.badges.dataset.key = labels.join('|');}
    }
  }
  const allActions = () => current?.battle.allActions ?? current?.battle.actions ?? [];
  commands.addEventListener('pointermove', e => {
    const node = (e.target as HTMLElement)?.closest<HTMLButtonElement>('button:not(:disabled)');
    if (e.pointerType === 'mouse' && (e.movementX || e.movementY) && node && root.ownerDocument.activeElement !== node) {node.focus({preventScroll:true}); feedback?.cue('ui.move');}
  });
  function selectCategory(id: string) {
    if (id !== category) feedback?.cue(id ? 'ui.confirm' : 'ui.cancel');
    category = id; detail = ''; touchAction = ''; browseScroll = 0; menuKey = '';
    if (current) render(current, performing);
  }
  function describe(a: ActionView | undefined) {
    help.replaceChildren();
    if (!a) {help.append(el('p', '', '请选择一项能力')); return;}
    const heading = el('div', 'rpg-skill-heading');
    heading.append(el('h3', '', a.name), el('span', 'rpg-skill-cost', actionCost(a)));
    const text = el('div', 'rpg-skill-description', actionPreviewText(a));
    text.setAttribute('role', 'status'); text.setAttribute('aria-live', 'polite');
    help.append(heading, text);
    if (a.reason) help.append(el('p', 'rpg-skill-unavailable', actionUnavailableText(a.reason, current?.battle.units)));
  }
  function activateDetail() {
    const a = allActions().find(a => a.id === detail);
    if (!a || performing || current?.paused || current?.battle.selected) return;
    feedback?.cue(a.disabled ? 'ui.error' : 'ui.confirm');
    if (!a.disabled) send('skill', {id: a.id});
  }
  function chooseCommand(id: string) {
    const a = allActions().find(a => a.id === id);
    if (!a || !current?.battle.ready || current.paused || performing) return;
    feedback?.cue(a.disabled ? 'ui.error' : 'ui.confirm');
    if (!a.disabled) send('skill', {id});
  }
  function renderMenus() {
    const v = current!, b = v.battle, available = allActions();
    const show = b.ready && !v.paused && !performing;
    const browsing = show && !!category && !b.selected, targeting = show && !!b.selected;
    commands.hidden = !show || browsing || targeting; dock.hidden = browsing;
    root.classList.toggle('has-commands', !commands.hidden);
    root.classList.toggle('is-browsing', browsing); root.classList.toggle('is-targeting', targeting);
    actions.hidden = !browsing; help.hidden = !browsing && !targeting; log.hidden = browsing || targeting;
    summons.hidden = browsing;
    actions.classList.toggle('is-targeting', targeting);
    const key = JSON.stringify([show, actor, category, b.selected, b.selectedTargets, b.targets, available.map(a => [a.id, a.disabled, a.reason, a.itemCount, a.mp, a.sp, a.hp, a.used, a.charges, a.favorite])]);
    if (key === menuKey) return; menuKey = key; commands.replaceChildren(); actions.replaceChildren(); if (!show) return;
    commands.append(el('div', 'rpg-command-owner', b.actorName));
    const attack = available.find(a => a.id === 'booksea:attack' || a.category === 'command' && a.name === '攻击');
    if (attack) commands.append(button('战斗', () => chooseCommand(attack.id), 'rpg-command', attack.disabled));
    commands.append(button('特技', () => selectCategory('skill'), 'rpg-command'), button('物品', () => selectCategory('item'), 'rpg-command'));
    const guard = available.find(a => a.id === 'booksea:wait' || a.name === '防御');
    if (guard) commands.append(button('防御', () => chooseCommand(guard.id), 'rpg-command', guard.disabled));
    const escape=button('逃跑', () => send('flee'), 'rpg-command');escape.disabled=!!b.escapeLocked;escape.title=b.escapeLocked?'宝箱怪战斗禁止普通逃跑，可用间章等专门离场技能':'';commands.append(escape);
    if (targeting) {
      describe(available.find(a => a.id === b.selected));
      help.querySelector('.rpg-skill-heading')?.append(button('返回', () => {feedback?.cue('ui.cancel'); send('cancel');}, 'rpg-back'));
      return;
    }
    if (!browsing) return;
    const labels: Record<string, string> = {skill: '特技', spell: '法术', item: '物品', relic: '遗物', command: '战斗', favorite: '收藏'};
    const header = el('div', 'rpg-action-header'), tabs = el('nav', 'rpg-action-tabs'); tabs.setAttribute('aria-label', '能力分类');
    for (const id of ['skill', 'spell', 'item', 'relic', 'favorite', 'command']) {
      if (!['skill', 'item'].includes(id) && !groupActions(available, id).length) continue;
      const tab = button(labels[id]!, () => selectCategory(id)); tab.setAttribute('aria-pressed', String(category === id)); tabs.append(tab);
    }
    header.append(tabs, button('返回', () => selectCategory(''), 'rpg-back'));
    const list = el('div', 'rpg-action-list'), footer = el('div', 'rpg-action-footer'), position = el('span', 'rpg-action-position');
    list.setAttribute('aria-label', (labels[category] ?? '技能') + '列表');
    const filtered = groupActions(available, category), rows = new Map<string, HTMLButtonElement>();
    function preview(a: ActionView, audible = true) {
      if (audible && detail !== a.id) feedback?.cue('ui.move');
      detail = a.id; describe(a);
      position.textContent = `${b.actorName} · ${filtered.indexOf(a) + 1} / ${filtered.length}`;
      for (const [id, row] of rows) {row.classList.toggle('is-current', id === a.id); row.setAttribute('aria-pressed', String(id === a.id));}
    }
    if (!filtered.length) {list.append(el('p', 'rpg-menu-empty', category === 'item' ? '没有可用物品' : '暂无此类能力')); describe(undefined);}
    for (const a of filtered) {
      // Unusable abilities remain browsable, including by touch; only confirmation is disabled.
      let pointer = 'mouse';
      const row = button('', () => {}, 'rpg-action');
      row.onpointerdown = e => {pointer = e.pointerType;};
      row.onclick = e => {const again = detail === a.id && touchAction === a.id; preview(a); if (e.detail === 0 || pointer === 'mouse' || again) activateDetail(); else touchAction = a.id;};
      row.oncontextmenu = e => e.preventDefault(); row.dataset.action = a.id;
      row.setAttribute('aria-disabled', String(a.disabled)); row.setAttribute('aria-pressed', 'false');
      const symbol = a.category === 'item' ? '◇' : a.category === 'spell' ? '✦' : a.category === 'relic' ? '✧' : '◆';
      const icon = el('span', 'rpg-action-icon', symbol); icon.setAttribute('aria-hidden', 'true');
      row.append(icon, el('span', 'rpg-action-name', a.name), el('small', 'rpg-action-cost', actionCost(a)));
      row.onpointermove = e => {if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) preview(a);}; row.onfocus = () => preview(a);
      row.onkeydown = e => {if (['Enter', 'Space', 'KeyE'].includes(e.code)) {e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) activateDetail();}};
      list.append(row); rows.set(a.id, row);
    }
    list.addEventListener('scroll', () => {browseScroll = list.scrollTop;}, {passive: true});
    footer.append(position); actions.append(header, list, footer); list.scrollTop = browseScroll;
    const chosen = filtered.find(a => a.id === detail) ?? filtered[0]; if (chosen) preview(chosen, false);
  }
  function navigate(code: string) {
    if (targetReady()) {const ids=current!.battle.targets,next=nextActionIndex(ids.indexOf(focusedTarget),ids.length,1,code);if(next===null)return false;focusTargetUnit(ids[next]!);return true;}
    if (!current || performing || actions.hidden || current.battle.selected || !category) return false;
    const list = actions.querySelector<HTMLElement>('.rpg-action-list'); if (!list) return false;
    const rows = Array.from(list.querySelectorAll<HTMLButtonElement>('.rpg-action')); if (!rows.length) return false;
    const columns = Math.max(1, root.ownerDocument.defaultView!.getComputedStyle(list).gridTemplateColumns.split(' ').length);
    const index = rows.findIndex(row => row.dataset.action === detail), next = nextActionIndex(index, rows.length, columns, code);
    if (next === null) return false;
    rows[next]!.focus({preventScroll: true}); rows[next]!.scrollIntoView({block: 'nearest', inline: 'nearest'}); return true;
  }
  function render(v: GameView, busy: boolean) {
    current = v; performing = busy;
    const keyForTargets = v.battle.actorId + ':' + v.battle.selected + ':' + v.battle.targets.join('|');
    if (keyForTargets !== targetKey) {targetKey = keyForTargets; touchTarget = ''; if (!v.battle.targets.includes(focusedTarget)) focusedTarget = v.battle.targets[0] ?? '';}
    root.dataset.targetCursor = targetReady() ? focusedTarget : '';
    if (actor !== v.battle.actorId) {actor = v.battle.actorId; category = ''; detail = ''; browseScroll = 0; menuKey = '';}
    const main = v.battle.units.filter(u => u.side === 'enemy' || !u.owner), key = main.map(u => u.id + ':' + u.artId).join('|');
    if (rosterKey !== key) {
      rosterKey = key; arrowCleanups.forEach(fn=>fn()); arrowCleanups=[]; widgets.clear(); enemies.replaceChildren(); party.replaceChildren();
      for (const u of main) widgets.set(u.id, makeUnit(u));
      const count = main.filter(u => u.side === 'enemy').length;
      enemies.style.display = count > 4 ? 'grid' : 'flex'; enemies.style.gridTemplateColumns = count > 4 ? `repeat(${Math.min(4, count)},minmax(0,1fr))` : '';
      for (const w of widgets.values()) if (w.node.classList.contains('rpg-enemy')) w.node.style.maxWidth = count > 4 ? '100%' : '';
    }
    for (const u of main) updateUnit(u);
    const companions = v.battle.units.filter(u => u.side === 'ally' && u.owner);
    const summonKey = JSON.stringify(companions.map(u => [u.id, u.hp, u.alive, v.battle.targets.includes(u.id)]));
    if (summons.dataset.key !== summonKey) {summons.dataset.key = summonKey; summons.replaceChildren(...companions.map(u => button(`${u.name}  ${number(u.hp)}`, () => {if(targetReady()){focusTargetUnit(u.id);commitTarget();}else inspect(u.id);})));}
    log.textContent = performing && cue ? cue.lines.join('\n') : v.battle.ready ? `${v.battle.actorName} 的回合` : cue?.lines.join('\n') || v.battle.log.slice(-2).join('\n') || '战斗开始';
    renderMenus();
  }
  return {
    render, navigate,
    choosing: () => targetReady() || (!!category && !!current?.battle.ready && !current?.paused && !performing),
    activate() {if(targetReady()){commitTarget();return true;}if(current && category && !performing && !current.paused){activateDetail();return true;}return false;},
    toggleTarget() {if(targetReady()&&multipleTargets()){feedback?.cue('ui.confirm');send('target',{id:focusedTarget});return true;}return false;},
    dispose() {arrowCleanups.forEach(fn=>fn());arrowCleanups=[];},
    setArt(id: string, png: string) {art.set(id, png); if (current) for (const u of current.battle.units) updateUnit(u);},
    cue(next: BattleCue, v: GameView) {
      cue = next; render(v, true);
      root.dataset.actionSide = next.side ?? v.battle.units.find(u=>u.id===next.actorId)?.side ?? 'ally';
      root.dataset.actionName = next.name;
      root.style.setProperty('--rpg-impact-delay', `${(next.impactAt ?? 240)/Math.max(1,v.settings?.animationSpeed ?? 1)}ms`);
      if (v.settings?.flash && next.changes.some(c => c.amount < 0)) {root.classList.remove('is-flashing'); void root.offsetWidth; root.classList.add('is-flashing');}
      const attacker = widgets.get(next.actorId)?.node; if (attacker) {attacker.classList.remove('rpg-attacking'); void attacker.offsetWidth; attacker.classList.add('rpg-attacking');}
      for (const change of next.changes) {
        const w = widgets.get(change.id); if (!w) continue;
        const popup = el('span', 'rpg-damage' + (change.amount > 0 ? ' heal' : change.critical ? ' critical' : ''), (change.amount > 0 ? '+' : change.critical ? '暴击 ' : '') + number(Math.abs(change.amount))); w.node.append(popup);
        popup.addEventListener('animationend', () => popup.remove(), {once: true});
        if (v.settings?.shake && change.amount < 0) {w.node.classList.remove('rpg-hit'); void w.node.offsetWidth; w.node.classList.add('rpg-hit');}
      }
      for (const [ids, label, css] of [[next.misses ?? [], '未命中', 'miss'], [next.blocks ?? [], '格挡', 'block']] as const) for (const id of ids) {
        const w=widgets.get(id); if(!w)continue;
        const popup=el('span','rpg-damage response '+css,label);w.node.append(popup);popup.addEventListener('animationend',()=>popup.remove(),{once:true});
        if(css==='miss'&&v.settings?.shake){w.node.classList.remove('rpg-evading');void w.node.offsetWidth;w.node.classList.add('rpg-evading');}
      }
    },
    back() {if (current?.battle.selected) {feedback?.cue('ui.cancel'); send('cancel');} else if (category) selectCategory(''); else return false; return true;},
    reset() {focusedTarget='';targetKey='';touchTarget='';touchAction='';cue = undefined; category = ''; rosterKey = ''; menuKey = ''; actor = ''; root.classList.remove('is-flashing');}
  };
}
