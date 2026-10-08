import {SUPPLIER_ART_ID} from '../game/supplier';
import {Typewriter, graphemes} from './typewriter';
import type {UIAudioFeedback} from '../audio/types';
import type {GameView} from '../presentation/battle-cues';
import {gameDom, type SendGameInput} from './game-dom';

/** Portrait, centred choices and bottom dialogue are separate layers, like a VN.
 * Nodes stay stable across frames: keyboard focus and held touch never get lost. */
export function mountSupplierDialogue(parent: HTMLElement, send: SendGameInput, feedback?: UIAudioFeedback) {
  const doc = parent.ownerDocument, {el, button} = gameDom(doc);
  const root = el('section', 'rpg-supplier'), portrait = el('img', 'rpg-supplier-portrait');
  const choices = el('div', 'rpg-supplier-choices'), dialogue = el('div', 'rpg-supplier-dialogue');
  const name = el('h2', 'rpg-supplier-name'), question = el('p', 'rpg-supplier-question');
  const hint = el('span', 'rpg-supplier-hint', '↑↓ 选择 · Enter 确定 · Esc 返回');
  const closeDialogue = () => {writer.cancel(); feedback?.cue('ui.cancel'); send('supplierClose');};
  const close = button('×', closeDialogue, 'rpg-supplier-close');
  close.setAttribute('aria-label', '暂不选择，返回地图');
  name.id = 'booksea-supplier-name'; question.id = 'booksea-supplier-question';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', name.id); root.setAttribute('aria-describedby', question.id);
  portrait.alt = '补给员：银灰长发、黑白裙装，黑色笔线溢出画板并完全遮住脸';
  portrait.draggable = false; portrait.hidden = true;
  for (let i = 0; i < 4; i++) {const corner = el('i', 'rpg-supplier-corner corner-' + i); corner.setAttribute('aria-hidden', 'true'); dialogue.append(corner);}
  dialogue.append(name, question, hint); root.append(portrait, choices, dialogue, close); parent.append(root); root.hidden = true;
  // 0.40 对话：记录在上方滚动，输入框在对话框上沿；她最新一句仍在下方对话框里逐字出现。
  const talkBox = el('div', 'rpg-supplier-talk'), talkLog = el('div', 'rpg-supplier-talk-log'), talkRow = el('div', 'rpg-supplier-talk-row');
  const talkInput = doc.createElement('input'); talkInput.type = 'text'; talkInput.maxLength = 300; talkInput.className = 'rpg-supplier-talk-input';
  const coarse = !!doc.defaultView?.matchMedia?.('(pointer: coarse)').matches;
  talkInput.placeholder = coarse ? '想对她说什么？' : '想对她说什么？（Enter 发送）'; talkInput.setAttribute('aria-label', '对补给员说的话'); talkInput.autocomplete = 'off'; talkInput.enterKeyHint = 'send';
  let talkPending = false, talkKey = '';
  const submitTalk = () => {const text = talkInput.value.trim(); if (!text || talkPending) return; talkInput.value = ''; feedback?.cue('ui.confirm'); send('supplierTalk', {text});};
  const talkSend = button('发送', submitTalk, 'rpg-supplier-talk-send'), talkBack = button('结束对话', () => {feedback?.cue('ui.cancel'); send('supplierTalkBack');}, 'rpg-supplier-talk-back');
  talkInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.isComposing) {e.preventDefault(); submitTalk();}
    else if (e.key === 'Escape') {e.preventDefault(); talkInput.blur(); feedback?.cue('ui.cancel'); send('supplierTalkBack');}
  });
  talkRow.append(talkInput, talkSend, talkBack); talkBox.append(talkLog, talkRow); talkBox.hidden = true; root.append(talkBox);
  // 手机弹出/收起键盘时记录区会变高变矮：原本停在底部就继续贴底，别让最新几句被挤到下面。
  let logPinned = true;
  talkLog.addEventListener('scroll', () => {logPinned = talkLog.scrollHeight - talkLog.clientHeight - talkLog.scrollTop < 24;}, {passive: true});
  const ResizeWatch = doc.defaultView?.ResizeObserver, logWatch = ResizeWatch ? new ResizeWatch(() => {if (logPinned) talkLog.scrollTop = talkLog.scrollHeight;}) : undefined;
  logWatch?.observe(talkLog);
  function renderTalk(talk: NonNullable<NonNullable<GameView['supplier']>['talk']>) {
    talkPending = talk.pending; talkInput.disabled = talk.pending; talkSend.disabled = talk.pending;
    const key = JSON.stringify(talk.log); if (key === talkKey) return; talkKey = key;
    let lastHer = -1; talk.log.forEach((l, i) => {if (l.role === 'supplier') lastHer = i;});
    // 她最新一句平时在下方对话框里逐字出现，记录区里藏起来；极矮屏收起对话框时由样式改为在记录区显示。
    talkLog.replaceChildren(...talk.log.map((l, i) => el('p', 'rpg-supplier-talk-line is-' + l.role + (i === lastHer ? ' is-latest' : ''), (l.role === 'player' ? '你：' : l.role === 'supplier' ? '补给员：' : '') + l.text)));
    talkLog.scrollTop = talkLog.scrollHeight; logPinned = true;
  }
  let key = '', wasOpen = false, previousFocus: HTMLElement | null = null;
  let buttons: HTMLButtonElement[] = [];
  const win = doc.defaultView!;
  let visibleText = '';
  const writer = new Typewriter({set: (fn, ms) => win.setTimeout(fn, ms), clear: id => win.clearTimeout(id)}, (text, typing) => {
    if (!text.startsWith(visibleText)) {question.replaceChildren(); visibleText = '';}
    for (const letter of graphemes(text.slice(visibleText.length))) question.append(el('span', 'rpg-supplier-letter', letter));
    visibleText = text; root.dataset.typing = String(typing); question.classList.toggle('is-typing', typing);
    hint.textContent = typing ? '点击文本 / E / Enter 显示全文 · Esc 返回' : '↑↓ 选择 · Enter 确定 · Esc 返回';
  }, active => feedback?.writing(active));
  dialogue.addEventListener('click', () => {if (writer.typing) writer.finish();});
  const visibility = () => writer.pause(doc.hidden);
  doc.addEventListener('visibilitychange', visibility);
  // Long lists scroll inside .rpg-supplier-choices only; never scroll the host page.
  function reveal(b: HTMLElement) {
    if (b.parentElement !== choices) return;
    const pad = 6, top = b.offsetTop - pad, bottom = b.offsetTop + b.offsetHeight + pad;
    if (top < choices.scrollTop) choices.scrollTop = top;
    else if (bottom > choices.scrollTop + choices.clientHeight) choices.scrollTop = bottom - choices.clientHeight;
  }
  function render(v: GameView | null) {
    const data = v?.mode === 'supplier' && !v.paused ? v.supplier : null;
    root.hidden = !data;
    const talk = data?.talk; talkBox.hidden = !talk; choices.hidden = !!talk; root.classList.toggle('is-talking', !!talk);
    parent.classList.toggle('is-supplier-talking', !!talk); // 对话时右上角的全屏按钮挪到关闭钮同一行，不压对话记录
    if (talk) renderTalk(talk); else talkKey = '';
    if (!data) {
      writer.cancel(); root.dataset.typing = 'false';
      if (wasOpen && root.contains(doc.activeElement)) previousFocus?.focus({preventScroll: true});
      wasOpen = false; return;
    }
    const nextKey = JSON.stringify(data), newLine = nextKey !== key || !wasOpen;
    if (nextKey !== key) {
      key = nextKey; name.textContent = data.name; question.setAttribute('aria-label', data.question);
      choices.replaceChildren(); choices.scrollTop = 0;
      buttons = data.choices.map(c => {
        const b = button(c.label, () => {
          // One press may reveal the line OR choose an outcome, never both.
          if (writer.typing) {writer.finish(); return;}
          feedback?.cue('ui.confirm'); send('supplierChoice', {choice: c.id});
        }, 'rpg-supplier-choice');
        b.addEventListener('pointerenter', e => {if (e.pointerType === 'mouse' && doc.activeElement !== b) {b.focus({preventScroll:true}); feedback?.cue('ui.move');}});
        b.dataset.choice = c.id; choices.append(b); return b;
      });
    }
    if (newLine) {visibleText = ''; question.replaceChildren(); writer.start(data.question, win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false); writer.pause(doc.hidden);}
    if (talk && !talk.pending && doc.activeElement !== talkInput && !talkBox.contains(doc.activeElement)) talkInput.focus({preventScroll: true});
    if (talk) hint.textContent = talk.pending ? '她在想……' : `可用 FP ${talk.fp} · Enter 发送 · Esc 结束对话`;
    if (!wasOpen) {previousFocus = doc.activeElement as HTMLElement | null; if (!talk) buttons[0]?.focus({preventScroll: true});}
    wasOpen = true;
  }
  function keydown(e: KeyboardEvent): boolean {
    if (root.hidden) return false;
    if (['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Space', 'KeyE'].includes(e.code)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat && ['Enter', 'Space', 'KeyE', 'Escape'].includes(e.code)) return true;
      if (e.code === 'Escape') {if (!talkBox.hidden) {feedback?.cue('ui.cancel'); send('supplierTalkBack');} else closeDialogue();}
      else if (['Enter', 'Space', 'KeyE'].includes(e.code)) {
        if (writer.typing) {writer.finish(); return true;}
        const active = doc.activeElement as HTMLButtonElement | null;
        if (active === close || buttons.includes(active!)) active?.click();
        else buttons[0]?.focus({preventScroll: true});
      } else {
        const targets = e.code === 'Tab' ? [...buttons, close] : buttons;
        const step = ['ArrowUp', 'ArrowLeft'].includes(e.code) || e.code === 'Tab' && e.shiftKey ? -1 : 1;
        const index = targets.indexOf(doc.activeElement as HTMLButtonElement);
        const next = targets[(index + step + targets.length) % targets.length];
        if (next && next !== doc.activeElement) {next.focus({preventScroll: true}); reveal(next); feedback?.cue('ui.move');}
      }
      return true;
    }
    return false;
  }
  return {render, keydown, dispose() {writer.dispose(); logWatch?.disconnect(); parent.classList.remove('is-supplier-talking'); doc.removeEventListener('visibilitychange', visibility);}, setArt(id: string, url: string) {
    if (id !== SUPPLIER_ART_ID) return false;
    portrait.src = url; portrait.hidden = false; return true;
  }};
}
