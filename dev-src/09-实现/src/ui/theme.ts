// Host pages in the 装订迷宫 (binding labyrinth) look: the lobby is an open book on a desk in 夜梦's library,
// the download page is the endpaper and flyleaf, dialogs are loose leaves. Layout and wording live here and in the
// page builders; behaviour (ids, data attributes, focus handling) is unchanged.
import {AVATAR_ART} from './art-avatar';
import {PORTRAIT_ART} from './art-portrait';
import {applyHostAvatar} from './host-avatar';
import {BK, BINDING_VARS, BK_FLEURON, BK_RULE, BK_STAMP_WEAR, brassCorners, installBinding, leatherFill, paperFill, plateCorners} from './binding-kit';
import {hydrateUiImages, loadBindingFonts, loadBindingTextures} from './ui-art';
export {PORTRAIT_ART, AVATAR_ART};
// Small woodcut marks (filled, no outline-in-a-circle icon set). Kept under the old names for existing callers.
const mark = (d: string, box = '0 0 24 24') => `<svg viewBox="${box}" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
export const icons = {
  book: mark('M12 6.3C9.5 4.6 6.4 4.3 3 5.3v13.4c3.4-1 6.5-.7 9 1 2.5-1.7 5.6-2 9-1V5.3c-3.4-1-6.5-.7-9 1Zm-.9 11.4c-2.2-1-4.6-1.2-6.6-.7V6.6c2.3-.5 4.6-.2 6.6 1Zm1.8 0V7.6c2-1.2 4.3-1.5 6.6-1V17c-2-.5-4.4-.3-6.6.7Z'),
  arrow: mark('M3 11h13.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H3Z'),
  refresh: mark('M12 4a8 8 0 0 1 7.4 5H22l-3.5 4L15 9h2.2A5.9 5.9 0 0 0 12 6.1 5.9 5.9 0 0 0 6.1 12H4a8 8 0 0 1 8-8Zm-6.5 7 3.5 4H6.8A5.9 5.9 0 0 0 12 17.9a5.9 5.9 0 0 0 5.9-5.9H20a8 8 0 0 1-15.4 3H2Z'),
  gear: mark('M10.6 2h2.8l.5 2.6 1.8.8 2.2-1.5 2 2-1.5 2.2.8 1.8 2.6.5v2.8l-2.6.5-.8 1.8 1.5 2.2-2 2-2.2-1.5-1.8.8-.5 2.6h-2.8l-.5-2.6-1.8-.8-2.2 1.5-2-2 1.5-2.2-.8-1.8L2 13.4v-2.8l2.6-.5.8-1.8-1.5-2.2 2-2 2.2 1.5 1.8-.8ZM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z'),
  close: mark('m6.3 4.9 5.7 5.7 5.7-5.7 1.4 1.4-5.7 5.7 5.7 5.7-1.4 1.4-5.7-5.7-5.7 5.7-1.4-1.4 5.7-5.7-5.7-5.7Z'),
  spark: mark('M12 21C6.5 17.6 3 14.4 3 10.2 3 6.6 5.7 4.2 8.6 4.2c1.6 0 2.7.7 3.4 1.7.7-1 1.8-1.7 3.4-1.7 2.9 0 5.6 2.4 5.6 6 0 4.2-3.5 7.4-9 10.8Z'),
  dex: mark('M4 3h12.5L20 6.5V21H4Zm2 2v14h12V7.3L15.7 5Zm2.5 3h7v1.6h-7Zm0 3.2h7v1.6h-7Zm0 3.2h4.6V16H8.5Z'),
};
export function escapeHtml(value: unknown) {return String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));}
export function installPlayerTheme(root: HTMLElement) {
  root.classList.add('bs-root'); const doc = root.ownerDocument; doc.body.classList.add('bs-player-page');
  if (!root.dataset.hostAvatar) {root.dataset.hostAvatar = '1'; const win = doc.defaultView; const sync = () => root.querySelectorAll<HTMLImageElement>('img[data-host-avatar]:not([data-host-avatar="1"])').forEach(img => {img.dataset.hostAvatar = '1'; applyHostAvatar(img, win);}); new MutationObserver(sync).observe(root, {childList: true, subtree: true}); queueMicrotask(sync);}
  if (!root.dataset.uiArt) {root.dataset.uiArt = '1'; const fill = () => hydrateUiImages(root, doc.defaultView ?? undefined); new MutationObserver(fill).observe(root, {childList: true, subtree: true}); queueMicrotask(fill);}
  installBinding(doc); loadBindingFonts(doc); loadBindingTextures(doc);
  if (doc.getElementById('booksea-player-style')) return;
  const style = doc.createElement('style'); style.id = 'booksea-player-style'; style.textContent = CSS; doc.head.append(style);
}
/** Running head of a page: book title on the left, the section on the right, tools beside it. */
export function shellHeader(section: string, tools = '') {return `<header class="bs-nav"><span class="bs-brand">普罗泰利西翁</span><span class="bs-section-label">${section}</span><div class="bs-nav-tools">${tools}</div></header>`;}
/** Title block (download page bookplate). */
export function hero(title: string, eyebrow: string, compact = false, intro = false) {return `<div class="bs-hero${compact ? ' bs-hero-compact' : ''}"><div class="bs-hero-copy"><p class="bs-eyebrow">${eyebrow}</p><h1${intro ? ' class="bs-intro-title"' : ''}>${title}</h1></div></div>`;}
/** A loose leaf laid over the desk. kind: plate (archive), colophon (settings / resources). */
export function modalFrame(id: string, title: string, body: string, kind: 'leaf' | 'plate' | 'colophon' = 'leaf') {return `<section id="${id}" class="bs-modal is-${kind}" role="dialog" aria-modal="true" aria-label="${title}" hidden><div class="bs-modal-card"><header class="bs-modal-head"><span>${title}</span><button class="bs-icon-button bs-close" data-close-modal aria-label="关闭">×</button></header><div class="bs-modal-body">${body}</div></div></section>`;}
export function bindModal(dialog: HTMLElement) {let prior: HTMLElement | null = null; const close = () => {dialog.hidden = true; prior?.focus();}; dialog.querySelector('[data-close-modal]')?.addEventListener('click', close); dialog.addEventListener('click', event => {if (event.target === dialog) close();}); dialog.addEventListener('keydown', event => {if (event.key === 'Escape') {event.preventDefault(); close();} if (event.key === 'Tab') {const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),[href],select,input,[tabindex="0"]')).filter(x => !x.hidden); if (!controls.length) return; const first = controls[0]!, last = controls.at(-1)!; if (event.shiftKey && dialog.ownerDocument.activeElement === first) {event.preventDefault(); last.focus();} else if (!event.shiftKey && dialog.ownerDocument.activeElement === last) {event.preventDefault(); first.focus();}}}); return {open() {if (dialog.hidden) prior = dialog.ownerDocument.activeElement as HTMLElement; dialog.hidden = false; (dialog.querySelector('[data-close-modal]') as HTMLElement)?.focus();}, close};}

const ribbon = (c: string = BK.ribbon, d: string = BK.ribbonDeep) => `linear-gradient(90deg,${d},${c} 42%,color-mix(in srgb,${c} 80%,#fff) 58%,${c} 72%,${d})`;
const CSS = `
body.bs-player-page{margin:0!important;padding:0!important;background:transparent!important}body.bs-player-page>main{margin:0;padding:0;max-width:none}#loader-status:empty{display:none}#loader-retry[hidden]{display:none}
.bs-root{${BINDING_VARS};position:relative;width:100%;margin:0 auto;color:${BK.ink};font:14px/1.7 var(--bk-serif);letter-spacing:.02em;-webkit-font-smoothing:antialiased}
.bs-root *{box-sizing:border-box}.bs-root [hidden]{display:none!important}.bs-root h1,.bs-root h2,.bs-root h3,.bs-root p{margin:0}
.bs-root button,.bs-root input,.bs-root select{font:inherit;color:inherit}
.bs-root button,.bs-root a{touch-action:manipulation}
.bs-root button{cursor:pointer;appearance:none;background:none;border:0;padding:0;letter-spacing:inherit}
.bs-root button:disabled{cursor:default}
.bs-root :focus-visible{outline:2px solid ${BK.ribbon};outline-offset:3px}
.bs-root svg{width:20px;height:20px;flex:none;vertical-align:middle}
.bs-root select option{background:${BK.card};color:${BK.ink}}
/* ---- the desk: scene picture behind an open book ---- */
.bs-portal{position:relative;isolation:isolate;overflow:hidden;min-height:max(520px,100dvh);background:#140c09}
.bs-scene{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:radial-gradient(ellipse at 72% 38%,#6a3a24,#24130c 58%,#120a07)}
.bs-scene img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:72% 40%;transition:opacity .7s}
.bs-scene .bs-scene-tall{display:none;object-position:50% 18%}
.bs-scene::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(16,9,6,.74),rgba(16,9,6,.42) 46%,rgba(16,9,6,.04) 64%),radial-gradient(ellipse at 74% 42%,transparent 40%,rgba(10,6,4,.45))}
.bs-book{position:relative;z-index:2;padding:12px;border-radius:5px 9px 9px 5px;background:${leatherFill()};box-shadow:0 26px 60px rgba(0,0,0,.62),0 2px 0 rgba(255,214,170,.08) inset,0 0 0 1px rgba(20,8,6,.8)}
.bs-book::after{content:'';position:absolute;inset:0;z-index:4;pointer-events:none;background:${brassCorners(40, -4)}}
.bs-ribbon-mark{position:absolute;z-index:5;left:calc(50% - 13px);top:-12px;width:24px;height:32%;max-height:220px;background:${ribbon()};clip-path:polygon(0 0,100% 0,100% 100%,50% 91%,0 100%);box-shadow:0 0 6px rgba(0,0,0,.5);pointer-events:none}
.bs-spread{position:relative;display:grid;grid-template-columns:1fr 1fr;height:100%;min-height:0}
.bs-spread::before{content:'';position:absolute;z-index:2;left:calc(50% - 1px);top:0;bottom:0;width:2px;background:linear-gradient(180deg,rgba(60,36,18,.5),rgba(60,36,18,.2));pointer-events:none}
.bs-page{position:relative;min-height:0;overflow:auto;overscroll-behavior:contain;padding:26px 30px 22px;scrollbar-width:thin;scrollbar-color:rgba(94,75,58,.45) transparent}
.bs-page-l{border-radius:3px 0 0 3px;background:${paperFill('left')}}
.bs-page-r{border-radius:0 3px 3px 0;background:${paperFill('right')}}
.bs-running,.bs-root .bs-nav{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding-bottom:7px;border-bottom:1px solid ${BK.rule};font-size:12.5px;letter-spacing:.24em;color:${BK.ink3}}
.bs-running i,.bs-brand{font:italic 14px/1.4 var(--bk-latin);letter-spacing:.06em;color:${BK.ink3}}
.bs-section-label{font-family:var(--bk-display);font-weight:900;letter-spacing:.3em;color:${BK.ink2}}
.bs-nav-tools{display:flex;gap:8px;margin-left:auto}
.bs-root h1{font:900 clamp(28px,3.4vw,44px)/1.15 var(--bk-display);letter-spacing:.2em;color:${BK.ink};margin-top:18px}
.bs-root h2{font:900 18px/1.4 var(--bk-display);letter-spacing:.24em;color:${BK.ink}}
.bs-lede{margin-top:8px!important;max-width:34em;font-size:14px;line-height:1.8;color:${BK.ink2}}
.bs-quota{display:flex;align-items:center;gap:10px;margin:16px 0 12px;font-size:13px;letter-spacing:.14em;color:${BK.ink2}}
.bs-quota b{font:600 15px/1 var(--bk-figures);letter-spacing:.06em;color:${BK.ink}}
.bs-dots{display:inline-flex;gap:7px}.bs-dots i{width:11px;height:11px;transform:rotate(45deg);border:1.5px solid ${BK.ribbon}}.bs-dots i.on{background:${BK.ribbon}}
/* ---- roster: one bookplate per companion; a red ribbon drops through the borrowed ones ---- */
.bs-roster{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:18px 14px;padding:6px 2px 4px}
.bs-root .bs-actor{position:relative;display:flex;flex-direction:column;min-width:0;background:${BK.card};box-shadow:0 1px 0 rgba(255,255,255,.6) inset,1px 3px 7px rgba(70,46,24,.26),inset 0 0 0 4px ${BK.card},inset 0 0 0 5px rgba(35,24,15,.5),inset 0 0 0 7px ${BK.card},inset 0 0 0 7.6px rgba(35,24,15,.25);transition:transform .2s,box-shadow .2s}
.bs-root .bs-actor::before{content:'';position:absolute;inset:0;pointer-events:none;background:${plateCorners(BK.ink2, 16, 5)}}
.bs-root .bs-actor:not(.is-disabled):hover{transform:translateY(-3px);box-shadow:0 1px 0 rgba(255,255,255,.6) inset,2px 8px 14px rgba(70,46,24,.3),inset 0 0 0 4px ${BK.card},inset 0 0 0 5px rgba(35,24,15,.5),inset 0 0 0 7px ${BK.card},inset 0 0 0 7.6px rgba(35,24,15,.25)}
.bs-actor-label{position:relative;display:flex!important;flex-direction:column;align-items:center;text-align:center;gap:2px;margin:0!important;padding:16px 12px 8px;cursor:pointer;min-width:0}
.bs-actor-label>input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.bs-actor-label:has(input:focus-visible){outline:2px solid ${BK.ribbon};outline-offset:-2px}
.bs-actor.is-disabled .bs-actor-label{cursor:not-allowed}
.bs-actor-seal{position:relative;display:grid;place-items:center;width:64%;max-width:92px;aspect-ratio:1;margin:4px auto 6px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 38%,#efe0bd,#d8c39b);box-shadow:inset 0 0 0 2px rgba(35,24,15,.55),inset 0 0 0 5px ${BK.card},inset 0 0 0 6px rgba(35,24,15,.3);font:900 30px/1 var(--bk-display);color:${BK.ink2}}
.bs-actor-seal img{border-radius:50%!important;filter:sepia(.18) saturate(.92)}
.bs-actor-seal.has-portrait{background:#d8c39b}
.bs-ex{font:italic 12px/1.3 var(--bk-latin);letter-spacing:.1em;color:${BK.ink3}}
.bs-actor-name{display:block;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:700 16px/1.35 var(--bk-serif);letter-spacing:.08em;color:${BK.ink}}
.bs-actor-info{display:contents}
.bs-actor-level{font:13px/1.5 var(--bk-serif);color:${BK.ink2}}
.bs-hp{display:flex;align-items:center;gap:7px;width:100%;margin-top:4px;font:13px/1.2 var(--bk-figures);color:${BK.ink2};white-space:nowrap}
.bs-hp-track{flex:1;height:5px;background:rgba(35,24,15,.12);box-shadow:inset 0 0 0 1px rgba(35,24,15,.28)}
.bs-hp-track>i{display:block;height:100%;background:${BK.green}}
.bs-ribbon{position:absolute;z-index:3;right:-6px;top:-10px;width:13px;height:calc(100% + 22px);background:${ribbon()};clip-path:polygon(0 0,100% 0,100% 100%,50% 94%,0 100%);opacity:0;transform:translateY(-14px);transition:opacity .25s,transform .35s cubic-bezier(.3,1.3,.5,1);box-shadow:0 0 4px rgba(0,0,0,.35);pointer-events:none}
.bs-actor.is-selected .bs-ribbon{opacity:1;transform:none}
.bs-stamp{position:absolute;z-index:2;left:6px;top:10px;padding:0 6px;border:2px solid currentColor;border-radius:2px;font:900 14px/1.4 var(--bk-display);letter-spacing:.2em;color:${BK.ribbon};transform:rotate(-12deg) scale(1.5);opacity:0;mix-blend-mode:multiply;-webkit-mask:${BK_STAMP_WEAR} 0 0/120px;mask:${BK_STAMP_WEAR} 0 0/120px;transition:opacity .12s,transform .18s cubic-bezier(.2,1.6,.4,1);pointer-events:none}
.bs-actor.is-selected .bs-stamp{opacity:.9;transform:rotate(-12deg)}
.bs-actor.is-disabled .bs-actor-seal,.bs-actor.is-disabled .bs-actor-name,.bs-actor.is-disabled .bs-actor-level{opacity:.5}
.bs-actor-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 9px 9px;padding-top:6px;border-top:1px dashed rgba(35,24,15,.28);font-size:12px;color:${BK.ink2}}
.bs-actor-state{display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.bs-actor-state.ready{color:${BK.green}}
.bs-root .bs-detail-button{flex:none;min-height:30px;padding:2px 8px;border-bottom:1px solid ${BK.ink2};font:900 13px/1.6 var(--bk-display);letter-spacing:.2em;color:${BK.ink}}
.bs-root .bs-detail-button:hover:not(:disabled){color:${BK.ribbon};border-color:${BK.ribbon}}
.bs-root .bs-detail-button:disabled{opacity:.45}
.bs-empty{display:grid;place-items:center;gap:6px;padding:34px 16px;border:1.5px dashed rgba(35,24,15,.3);text-align:center;color:${BK.ink3};letter-spacing:.2em}
.bs-empty svg{width:26px;height:26px;color:${BK.ink3}}
/* ---- the loan card on the right page ---- */
.bs-loan{position:relative;margin-top:18px;padding:18px 20px 20px;background:linear-gradient(transparent 0 33px,rgba(179,38,43,.32) 33px 34px,transparent 34px) 0 0/100% 100% no-repeat,repeating-linear-gradient(transparent 0 30px,rgba(46,74,107,.16) 30px 31px),#f4e7c6;box-shadow:1px 3px 9px rgba(60,40,20,.25),inset 0 0 0 1px rgba(35,24,15,.28)}
.bs-loan::before{content:'';position:absolute;left:50%;top:8px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#2a1a12;box-shadow:inset 0 2px 3px #000,0 1px 0 rgba(255,255,255,.4)}
.bs-loan h2{display:flex;justify-content:space-between;align-items:baseline;padding-top:6px}
.bs-loan h2 small{font:italic 13px var(--bk-latin);letter-spacing:.06em;color:${BK.ink3}}
.bs-loan-rows{display:grid;grid-template-columns:auto 1fr;gap:0 16px;margin-top:12px;font-size:14px}
.bs-loan-rows>dt,.bs-loan-rows>dd{margin:0;padding:8px 0;border-bottom:1px solid ${BK.rule}}
.bs-loan-rows>dt{color:${BK.ink2};letter-spacing:.16em}
.bs-anchor label{display:none}
.bs-root .bs-anchor select{max-width:100%;padding:2px 26px 2px 2px;border:0;border-bottom:1px solid ${BK.ink2};border-radius:0;background:linear-gradient(45deg,transparent 50%,${BK.ink} 50%) right 6px center/8px 8px no-repeat;appearance:none;font:900 15px/1.5 var(--bk-display);letter-spacing:.08em;color:${BK.ink};cursor:pointer}
.bs-wallet{display:flex;align-items:baseline;gap:8px;color:${BK.ink2}}
.bs-wallet svg{display:none}
.bs-wallet>b{font:600 18px/1 var(--bk-figures);letter-spacing:.04em;color:${BK.ink};font-variant-numeric:tabular-nums}
.bs-party-names{display:flex;flex-wrap:wrap;gap:4px 6px}
.bs-party-names span{padding:0 7px;background:rgba(179,38,43,.1);box-shadow:inset 0 -1px 0 rgba(179,38,43,.4);font-size:13.5px}
.bs-party-names em{font-style:normal;color:${BK.ink3}}
/* due-date stamps: the three actions are stamped onto the card */
.bs-party-actions{display:flex;align-items:flex-end;gap:12px;margin-top:20px}.bs-party-actions>*{flex:1 1 0}.bs-party-actions>.bs-go{flex-grow:1.3}
.bs-root .bs-due{position:relative;display:grid;place-items:center;align-content:center;gap:4px;min-height:84px;padding:10px 6px;border:2px solid ${BK.ink2};border-radius:4px;background:rgba(255,250,236,.55);text-align:center;transition:transform .12s,background .15s}
.bs-root .bs-due b{font:900 17px/1.25 var(--bk-display);letter-spacing:.12em;white-space:nowrap;color:${BK.ink}}
.bs-root .bs-due small{font:12px/1.4 var(--bk-serif);letter-spacing:.04em;color:${BK.ink3}}
.bs-root .bs-due:hover:not(:disabled){background:rgba(255,250,236,.92)}
.bs-root .bs-due:active:not(:disabled){transform:translateY(2px)}
.bs-root .bs-due.bs-go{min-height:98px;border-color:${BK.ribbonDeep};background:radial-gradient(circle at 50% 38%,#cf4247,${BK.ribbon} 58%,${BK.ribbonDeep});box-shadow:0 3px 0 #5e1014,0 6px 14px rgba(90,16,20,.3)}
.bs-root .bs-due.bs-go b{font-size:20px;color:#fff6ea;text-shadow:0 1px 0 rgba(60,8,10,.6)}
.bs-root .bs-due.bs-go small{color:#f6d6cc}
.bs-root .bs-due.bs-go:hover:not(:disabled){filter:brightness(1.06);background:radial-gradient(circle at 50% 38%,#d64b50,${BK.ribbon} 58%,${BK.ribbonDeep})}
.bs-root .bs-due:disabled{opacity:.48;filter:saturate(.4)}
.bs-busy-mark{display:inline-block;width:11px;height:11px;border:1.5px solid rgba(35,24,15,.35);border-top-color:${BK.ink};border-radius:50%;animation:bs-spin 1s linear infinite}@keyframes bs-spin{to{transform:rotate(360deg)}}
/* status as an errata slip pasted in */
.bs-root .bs-player-status{position:relative;margin-top:18px!important;padding:10px 14px 10px 16px;background:${BK.errata};box-shadow:1px 2px 5px rgba(0,0,0,.18);transform:rotate(-.5deg);font-size:13.5px;line-height:1.7;color:${BK.ink}}
.bs-root .bs-player-status::before{content:'勘误';position:absolute;left:-2px;top:-11px;padding:0 7px;background:${BK.ink};color:${BK.errata};font:900 11px/1.7 var(--bk-display);letter-spacing:.2em}
.bs-root .bs-player-status:empty{display:none}
.bs-colophon,.bs-root .bs-footer{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:22px;padding-top:8px;border-top:1px solid ${BK.rule};font:italic 13px/1.5 var(--bk-latin);letter-spacing:.06em;color:${BK.ink3}}
.bs-colophon a,.bs-root .bs-footer a{color:${BK.ink2};text-decoration:none;border-bottom:1px solid rgba(94,75,58,.4);font-style:normal;font-family:var(--bk-serif);letter-spacing:.12em}
.bs-colophon a:hover,.bs-root .bs-footer a:hover{color:${BK.ribbon}}
/* fore-edge thumb index: each tab opens one part of the book */
.bs-tabs{position:absolute;z-index:1;right:-44px;top:58px;display:flex;flex-direction:column;gap:8px}
.bs-root .bs-tab{width:46px;min-height:96px;padding:12px 0 12px 8px;border-radius:0 9px 9px 0;writing-mode:vertical-rl;font:900 15px/1 var(--bk-display);letter-spacing:.32em;color:#f6ecd6;text-align:center;background:linear-gradient(90deg,rgba(0,0,0,.3),transparent 34%),var(--tab,${BK.marbleA});box-shadow:2px 3px 6px rgba(0,0,0,.45);transition:transform .15s}
.bs-root .bs-tab:hover:not(:disabled),.bs-root .bs-tab:focus-visible{transform:translateX(5px)}
.bs-root .bs-tab:disabled{opacity:.6}
/* stage (game) inside the portal */
.bs-stage{position:relative;z-index:5}
.bs-playing>.bs-portal>.bs-scene{display:none}
/* ---- download page: endpaper and flyleaf ---- */
.bs-endpaper{display:grid;place-items:center;padding:clamp(14px,4dvh,40px) clamp(12px,3vw,40px)}
.bs-endpaper .bs-book{width:min(1080px,100%);height:min(680px,calc(100dvh - 28px))}
.bs-pastedown{display:grid;place-items:center;padding:28px;background:var(--bk-tex-marble) 0 0/300px auto,${BK.marbleA}!important}
.bs-pastedown::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 88%,rgba(40,20,10,.35))}
.bs-root .bs-hero{position:relative;width:min(88%,400px);padding:30px 30px 26px;background:${BK.card};text-align:center;box-shadow:2px 6px 16px rgba(0,0,0,.4),inset 0 0 0 5px ${BK.card},inset 0 0 0 6px rgba(35,24,15,.55),inset 0 0 0 9px ${BK.card},inset 0 0 0 9.8px rgba(35,24,15,.3)}
.bs-root .bs-hero::before{content:'';position:absolute;inset:0;pointer-events:none;background:${plateCorners(BK.ink2, 22, 6)}}
.bs-hero-copy{display:grid;justify-items:center;gap:10px}
.bs-eyebrow{font:900 15px/1.4 var(--bk-display)!important;letter-spacing:.5em;padding-left:.5em;color:${BK.ribbon}}
.bs-root .bs-hero h1{margin:0;font:900 clamp(17px,1.9vw,21px)/1.75 var(--bk-display);letter-spacing:.08em;color:${BK.ink}}
.bs-root .bs-hero h1.bs-intro-title{font-weight:900}
.bs-exlibris{font:italic 14px/1.4 var(--bk-latin);letter-spacing:.12em;color:${BK.ink3}}
.bs-hero-rule{width:70%;height:14px;background:${BK_RULE} center/contain no-repeat;opacity:.8}
.bs-flyleaf{display:flex;flex-direction:column}
.bs-root .bs-resource-card{position:relative;margin-top:22px}
.bs-card-title{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.bs-percent{font:600 34px/1 var(--bk-figures);letter-spacing:.02em;color:${BK.ink};font-variant-numeric:tabular-nums}
.bs-signatures{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;height:58px;margin:18px 0 6px;padding:0 2px;position:relative}
.bs-signatures::before{content:'';position:absolute;left:0;right:0;top:50%;height:0;border-top:1.5px dashed rgba(94,75,58,.45)}
.bs-signatures i{position:relative;border-radius:2px 2px 1px 1px;background:linear-gradient(90deg,#e8dab9,#f4ead3 40%,#e2d2ae);box-shadow:inset 0 0 0 1px rgba(35,24,15,.18);opacity:.42;transform:translateY(6px);transition:opacity .3s,transform .35s cubic-bezier(.3,1.4,.5,1)}
.bs-signatures i::after{content:'';position:absolute;left:50%;top:22%;bottom:22%;width:0;border-left:1.5px dotted rgba(179,38,43,.0);transition:border-color .3s}
.bs-signatures i.is-sewn{opacity:1;transform:none}
.bs-signatures i.is-sewn::after{border-left-color:${BK.ribbon}}
.bs-root progress{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.bs-download-info{display:flex;justify-content:space-between;gap:14px;font-size:13px;color:${BK.ink2}}
.bs-download-info>span:last-child{font-family:var(--bk-figures);font-variant-numeric:tabular-nums}
.bs-download-options{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px}
.bs-root .bs-option{position:relative;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:12px;min-height:118px;padding:10px 14px 10px 8px;text-align:left;border-radius:3px;background:rgba(255,250,236,.4);box-shadow:inset 0 0 0 1px rgba(35,24,15,.2);transition:background .15s}
.bs-root .bs-option:hover:not(:disabled),.bs-root .bs-option:focus-visible{background:rgba(255,250,236,.85)}
.bs-option-art{position:relative;width:78px;height:100px}
.bs-option-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:drop-shadow(2px 5px 5px rgba(40,24,10,.35));transition:opacity .2s}
.bs-option-art img+img{opacity:0}
.bs-root .bs-option:hover:not(:disabled) .bs-option-art img+img,.bs-root .bs-option:focus-visible .bs-option-art img+img{opacity:1}
.bs-option strong{display:block;font:900 18px/1.3 var(--bk-display);letter-spacing:.2em;color:${BK.ink}}
.bs-option small{display:block;margin-top:2px;font:600 14px/1.4 var(--bk-figures);color:${BK.ribbon}}
.bs-option em{display:block;margin-top:4px;font-style:normal;font-size:12.5px;line-height:1.5;color:${BK.ink2}}
.bs-root .bs-option.bs-primary{background:rgba(255,250,236,.7);box-shadow:inset 0 0 0 1.5px rgba(179,38,43,.55)}
.bs-root .bs-option:disabled{opacity:.55}
.bs-flyleaf .bs-footer{margin-top:auto}
.bs-root .bs-icon-button{display:inline-grid;place-items:center;min-width:36px;min-height:36px;padding:0 8px;font:900 14px/1 var(--bk-display);letter-spacing:.18em;color:${BK.ink2}}
.bs-root .bs-icon-button:hover:not(:disabled){color:${BK.ribbon}}
.bs-root .bs-icon-button.bs-close{width:40px;height:40px;padding:0;border-radius:50%;font:400 24px/1 var(--bk-serif);letter-spacing:0;color:${BK.ink2};box-shadow:inset 0 0 0 1px rgba(35,24,15,.3)}
.bs-root .bs-icon-button.bs-close:hover{color:#fff;background:${BK.ribbon};box-shadow:none}
.bs-root .bs-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:6px 16px;border:1.5px solid ${BK.ink2};border-radius:3px;background:rgba(255,250,236,.55);font:900 14px/1.3 var(--bk-display);letter-spacing:.2em;color:${BK.ink}}
.bs-root .bs-button:hover:not(:disabled){background:#fffaf0;border-color:${BK.ink}}
.bs-root .bs-button.bs-primary{border-color:${BK.ribbonDeep};background:${BK.ribbon};color:#fff6ea}
.bs-root .bs-button.bs-primary:hover:not(:disabled){background:#c3343a}
.bs-root .bs-button:disabled{opacity:.5}
/* ---- loose leaves (dialogs) ---- */
.bs-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at 50% 40%,rgba(30,16,10,.62),rgba(8,4,2,.86))}
.bs-portal>.bs-modal{position:fixed}
.bs-modal-card{position:relative;display:flex;flex-direction:column;width:100%;max-width:720px;max-height:calc(100dvh - 40px);color:${BK.ink};background:${paperFill('left')};border-left:12px solid ${BK.leather};box-shadow:0 28px 70px rgba(0,0,0,.6),inset 1px 0 0 rgba(255,255,255,.5)}
.bs-modal-card::before{content:'';position:absolute;left:-12px;top:0;bottom:0;width:12px;background:var(--bk-tex-leather) 0 0/160px auto,${BK.leather};box-shadow:inset -2px 0 3px rgba(0,0,0,.4)}
.bs-modal-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 26px;padding:18px 0 10px;border-bottom:1px solid ${BK.rule}}
.bs-modal-head>span{font:900 20px/1.3 var(--bk-display);letter-spacing:.3em;color:${BK.ink}}
.bs-modal-body{padding:18px 26px 24px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(94,75,58,.45) transparent}
.bs-modal.is-colophon .bs-modal-card{max-width:560px}
.bs-modal.is-colophon .bs-modal-body::after{content:'';display:block;height:14px;margin-top:18px;background:${BK_RULE} center/220px 14px no-repeat;opacity:.7}
.bs-settings-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px dotted rgba(35,24,15,.35)}
.bs-settings-row>span{font-size:14.5px;letter-spacing:.12em;color:${BK.ink}}
/* archive (character sheet): bookplate header + specimen labels + catalogue cards */
.bs-profile{display:flex;align-items:center;gap:18px;padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid ${BK.rule}}
.bs-profile-emblem{position:relative;display:grid;place-items:center;flex:none;width:78px;height:96px;border-radius:50% / 44%;overflow:hidden;background:radial-gradient(circle at 50% 38%,#efe0bd,#d6c095);box-shadow:inset 0 0 0 2px rgba(35,24,15,.6),inset 0 0 0 5px ${BK.page},inset 0 0 0 6px rgba(35,24,15,.3);font:900 34px/1 var(--bk-display);color:${BK.ink2}}
.bs-profile-emblem img{width:100%;height:100%;object-fit:cover}
.bs-profile h2{font:700 24px/1.35 var(--bk-serif);letter-spacing:.12em}
.bs-profile-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
.bs-pill{display:inline-flex;align-items:center;padding:1px 9px;border:1.5px solid ${BK.ink2};border-radius:2px;font:900 12.5px/1.6 var(--bk-display);letter-spacing:.12em;color:${BK.ink2};background:transparent}
.bs-pill.violet{border-color:${BK.marbleA};color:${BK.marbleA}}
.bs-pill.green{border-color:${BK.green};color:${BK.green}}
.bs-resource-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
.bs-stat-box{position:relative;padding:10px 12px 9px;background:${BK.card};box-shadow:1px 2px 4px rgba(60,40,20,.18),inset 0 0 0 1px rgba(35,24,15,.22)}
.bs-stat-box::before{content:'';position:absolute;right:10px;top:-5px;width:18px;height:10px;background:rgba(214,198,160,.85);box-shadow:0 1px 1px rgba(0,0,0,.12);transform:rotate(4deg)}
.bs-stat-box span{display:block;font-size:12.5px;letter-spacing:.24em;color:${BK.ink3}}
.bs-stat-box strong{display:block;font:600 21px/1.4 var(--bk-figures);color:${BK.ink};font-variant-numeric:tabular-nums}
.bs-stat-box small{font-size:13px;color:${BK.ink3}}
.bs-stat-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:0;margin-bottom:18px;border-top:1px solid ${BK.ink2};border-bottom:1px solid ${BK.ink2}}
.bs-stat-grid div{padding:8px 0 6px;text-align:center;font:600 18px/1.3 var(--bk-figures);color:${BK.ink}}
.bs-stat-grid div+div{border-left:1px solid ${BK.rule}}
.bs-stat-grid small{display:block;margin-top:2px;font:13px/1.4 var(--bk-serif);letter-spacing:.3em;color:${BK.ink3}}
.bs-skill-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px 0 10px}
.bs-skill-heading h3{display:flex;align-items:center;gap:8px;font:900 15px/1.4 var(--bk-display);letter-spacing:.3em;color:${BK.ink}}
.bs-skill-heading h3::before{content:'';width:16px;height:16px;background:${BK_FLEURON} center/contain no-repeat}
.bs-skill-card{position:relative;margin-bottom:10px;padding:14px 16px 12px 30px;background:${BK.card};box-shadow:1px 2px 5px rgba(60,40,20,.16),inset 0 0 0 1px rgba(35,24,15,.2);background-image:linear-gradient(90deg,transparent 21px,rgba(179,38,43,.32) 21px 22px,transparent 22px)}
.bs-skill-card::before{content:'';position:absolute;left:7px;top:16px;width:8px;height:8px;border-radius:50%;background:#3a2a20;box-shadow:inset 0 1px 2px #000}
.bs-skill-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:5px}
.bs-skill-top h3{font:700 16px/1.4 var(--bk-serif);letter-spacing:.08em;color:${BK.ink};overflow-wrap:anywhere}
.bs-skill-badges{display:flex;gap:5px;flex-wrap:wrap;flex:none}
.bs-skill-meta{margin-bottom:6px!important;font-size:12.5px;color:${BK.ink3}}
.bs-skill-effects{margin:0;padding:0;list-style:none;font-size:13.5px;line-height:1.8;color:${BK.ink}}
.bs-skill-effects li{position:relative;padding-left:14px}
.bs-skill-effects li::before{content:'';position:absolute;left:1px;top:.78em;width:5px;height:5px;transform:rotate(45deg);background:${BK.ink2}}
.bs-skill-shift{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(35,24,15,.25);font-size:13px;color:${BK.marbleA}}
.bs-skill-shift b{font-family:var(--bk-serif);letter-spacing:.1em;color:${BK.ink}}
/* ---- small screens ---- */
@media (min-width:901px){
 #setup.bs-book{position:absolute;left:clamp(16px,4vw,72px);top:50%;transform:translateY(-50%);width:min(60vw,1020px);height:min(calc(100dvh - 48px),780px);margin-right:44px}
}
@media (max-width:900px) and (min-width:601px){
 .bs-root:not(.bs-playing)>.bs-portal.bs-desk{display:grid;grid-template-columns:minmax(0,1fr) 22%;align-items:center;padding:12px 56px 12px 12px}
 #setup.bs-book{height:calc(100dvh - 24px);min-height:380px}
 .bs-scene img{object-position:76% 34%}
 .bs-scene::after{background:linear-gradient(90deg,rgba(16,9,6,.8),rgba(16,9,6,.5) 70%,rgba(16,9,6,.1))}
 .bs-page{padding:18px 18px 16px}
 .bs-root h1{font-size:26px;margin-top:10px}
 .bs-roster{grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:12px 10px}
 .bs-party-actions{gap:8px}.bs-root .bs-due{min-height:70px}.bs-root .bs-due.bs-go{min-height:80px}.bs-root .bs-due b{font-size:15px;letter-spacing:.06em}.bs-root .bs-due.bs-go b{font-size:17px}
 .bs-tabs{right:-46px;top:40px}.bs-root .bs-tab{min-height:78px;font-size:14px}
}
@media (max-height:520px) and (min-width:601px){
 .bs-page{padding:12px 16px}.bs-running{font-size:11.5px}.bs-lede{display:none}.bs-root h1{font-size:22px;margin-top:6px}.bs-quota{margin:8px 0 6px}
 .bs-root .bs-due small{display:none}.bs-root .bs-due{min-height:52px}.bs-root .bs-due.bs-go{min-height:58px}.bs-loan{margin-top:10px;padding:12px 14px 14px}.bs-party-actions{margin-top:12px}
 .bs-endpaper .bs-book{height:calc(100dvh - 20px)}.bs-signatures{height:40px;margin:10px 0 4px}.bs-root .bs-option{min-height:84px}.bs-option-art{width:56px;height:72px}
}
@media (max-width:600px){
 .bs-portal{min-height:100dvh;padding:0 0 22px}
 .bs-scene{position:relative;height:clamp(220px,46vw,300px)}
 .bs-scene .bs-scene-wide{display:none}.bs-scene .bs-scene-tall{display:block}
 .bs-scene::after{background:linear-gradient(180deg,transparent 55%,#140c09)}
 #setup.bs-book{margin:-56px 10px 0;padding:8px}
 .bs-spread{grid-template-columns:1fr}.bs-spread::before{display:none}
 .bs-page{overflow:visible;padding:18px 16px 18px}
 .bs-page-l{border-radius:3px 3px 0 0}.bs-page-r{border-radius:0 0 3px 3px;border-top:1px dashed rgba(35,24,15,.3)}
 .bs-ribbon-mark{display:none}
 .bs-tabs{position:static;flex-direction:row;gap:6px;margin:0 4px 8px}
 .bs-root .bs-tab{flex:1;width:auto;min-height:44px;padding:6px 0;writing-mode:horizontal-tb;border-radius:0 0 8px 8px;font-size:14px;letter-spacing:.2em}
 .bs-root .bs-tab:hover:not(:disabled){transform:translateY(3px)}
 .bs-root h1{font-size:28px;margin-top:10px}
 .bs-roster{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 12px}
 .bs-party-actions{gap:8px}.bs-root .bs-due{min-height:74px;padding:8px 4px}.bs-root .bs-due b{font-size:15px;letter-spacing:.06em}.bs-root .bs-due small{font-size:12px}
 .bs-endpaper{display:block;padding:10px}
 .bs-endpaper .bs-book{height:auto}
 .bs-pastedown{min-height:260px;padding:20px 14px}
 .bs-download-options{grid-template-columns:1fr}
 .bs-root .bs-option{min-height:96px}
 .bs-modal{padding:8px}.bs-modal-card{max-height:calc(100dvh - 16px);border-left-width:8px}.bs-modal-card::before{left:-8px;width:8px}.bs-modal-head{margin:0 16px}.bs-modal-body{padding:14px 16px 18px}
 .bs-resource-grid{gap:6px}.bs-stat-box{padding:8px}.bs-stat-box strong{font-size:17px}.bs-stat-grid small{letter-spacing:.1em}
}
@media (prefers-reduced-motion:reduce){.bs-root *{animation:none!important;transition:none!important}}
`;
