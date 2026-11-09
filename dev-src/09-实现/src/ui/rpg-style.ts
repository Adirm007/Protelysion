import {SUPPLIER_STYLE} from './supplier-style';
import {BK, BINDING_VARS, BK_DISPLAY, BK_SERIF, BK_FIGURES, BK_MANICULE, BK_FLEURON, BK_RULE, BK_STAMP_WEAR, BK_BLOT, brassCorners, leatherFill, paperFill, tornEdge} from './binding-kit';

// 装订迷宫 in-game skin. The exploration HUD is a page margin (running head, marginal notes, a ribbon that opens
// the journal); the journal is a notebook with thumb-index tabs; events are chapter openings; the end of a run is
// the colophon (or a torn page). The battle keeps its 0.46.0 layout and skin exactly (user, 2026-11-08), and the
// test-pinned rules are kept verbatim.
const ribbon = 'linear-gradient(90deg,rgba(0,0,0,.28),rgba(255,255,255,.14) 46%,rgba(0,0,0,.08) 60%,rgba(0,0,0,.3))';
// The battle keeps its 0.46.0 skin exactly (user, 2026-11-08: 战斗UI排版不用动，原样旧版即可). These are the retired
// octo-kit values, private to the battle block below; no other screen uses them.
const lsvg = (body: string, box = '0 0 24 24') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${box}'>${body}</svg>`)}")`;
const lCorner = (transform: string) => `<g transform='${transform}'><g fill='none' stroke='#d8b978' stroke-linecap='round'><path d='M1.5 22.5V8Q1.5 1.5 8 1.5h14.5' stroke-width='1.1'/><path d='M4.5 22.5v-12q0-6 6-6h12' stroke-width='.7' opacity='.55'/><path d='M1.5 13.5h3M13.5 1.5v3' stroke-width='.9'/></g><path d='M8.6 5.6l3 3-3 3-3-3z' fill='#f0d99c'/><circle cx='15.5' cy='8.6' r='.9' fill='#d8b978'/><circle cx='8.6' cy='15.5' r='.9' fill='#d8b978'/></g>`;
const L_CORNERS = {
  tl: lsvg(lCorner('')),
  tr: lsvg(lCorner('matrix(-1 0 0 1 24 0)')),
  bl: lsvg(lCorner('matrix(1 0 0 -1 0 24)')),
  br: lsvg(lCorner('matrix(-1 0 0 -1 24 24)')),
};
const L_CURSOR = lsvg(`<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff1c6'/><stop offset='.55' stop-color='#e2bf73'/><stop offset='1' stop-color='#9c7836'/></linearGradient></defs><path d='M2 3.2 17 10 2 16.8 5.6 10z' fill='url(#g)' stroke='#3b2c14' stroke-width='.9' stroke-linejoin='round'/>`, '0 0 20 20');
const L_SERIF = `'Noto Serif SC','Source Han Serif SC','Source Han Serif CN','思源宋体','Songti SC','STSong','SimSun',serif`;
const L_SANS = `'Noto Sans SC','PingFang SC','Microsoft YaHei','Source Han Sans SC',system-ui,sans-serif`;
function lFrame(fill: string, size = 22) {
  const c = L_CORNERS;
  return `${c.tl} left 3px top 3px/${size}px ${size}px no-repeat,${c.tr} right 3px top 3px/${size}px ${size}px no-repeat,${c.bl} left 3px bottom 3px/${size}px ${size}px no-repeat,${c.br} right 3px bottom 3px/${size}px ${size}px no-repeat,${fill}`;
}
const L_FILL = 'linear-gradient(180deg,rgba(22,27,43,.95),rgba(10,12,21,.96) 55%,rgba(7,9,16,.97))';
export const RPG_STYLE = String.raw`
.bs-playing,.bs-shell.bs-playing{max-width:none!important;padding:0!important;border:0!important;border-radius:0!important;background:#111!important;overflow:visible!important}
.bs-playing>.bs-portal{min-height:0!important;box-shadow:none!important;max-width:none!important;padding:0!important;border:0!important;border-radius:0!important}
.bs-playing>.bs-portal>.bs-nav,.bs-playing>.bs-portal>.bs-header,.bs-playing>.bs-portal>.bs-footer,.bs-playing>.bs-portal>#status{display:none!important}
.rpg-stage,.bs-stage.rpg-stage{position:relative;isolation:isolate;container-type:size;width:100%;height:var(--rpg-viewport-height,100dvh);min-height:0;max-height:none;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;overflow:hidden;background:#131317;color:#f7f0df}
.rpg-stage:fullscreen,.rpg-stage.is-fullscreen{position:fixed!important;inset:0!important;width:var(--rpg-viewport-width,100vw)!important;height:var(--rpg-viewport-height,100dvh)!important;min-height:0!important;max-width:none!important;max-height:none!important;z-index:2147483000;border:0!important;border-radius:0!important;padding:0!important;margin:0!important}
.rpg-stage>canvas{position:absolute!important;inset:0;display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;aspect-ratio:auto!important;border:0!important;border-radius:0!important;outline:0;touch-action:none;transition:filter .3s,transform .3s}
.rpg-stage.is-battle>canvas{filter:blur(3px) brightness(.58) saturate(.72)}
.rpg-ui{position:absolute;inset:0;z-index:2;font:16px/1.55 ${BK_SERIF};pointer-events:none;text-align:left;color:${BK.ink};${BINDING_VARS};--rpg-ribbon:${BK.ribbon};--rpg-ribbon-deep:${BK.ribbonDeep};--rpg-serif:${BK_DISPLAY};--rpg-body:${BK_SERIF};--rpg-fig:${BK_FIGURES}}
.rpg-ui[data-family=fairytale]{--rpg-ribbon:#2f5277;--rpg-ribbon-deep:#1c3450}
.rpg-ui[data-family=marionette]{--rpg-ribbon:#8c1424;--rpg-ribbon-deep:#46080f}
.rpg-ui *{box-sizing:border-box;min-width:0}
.rpg-ui [hidden]{display:none!important}
.rpg-ui button,.rpg-ui select,.rpg-ui input,.rpg-ui summary{pointer-events:auto;font:inherit}
.rpg-ui button{min-height:40px;margin:0;border:1.5px solid ${BK.ink2};border-radius:3px;padding:7px 15px;background:rgba(255,250,236,.66);color:${BK.ink};cursor:pointer;line-height:1.25;letter-spacing:.12em;font-family:var(--rpg-serif);font-weight:900;transition:background .15s,border-color .15s,color .15s,transform .12s}
.rpg-ui button:hover:not(:disabled){background:#fffaf0;border-color:${BK.ink}}
.rpg-ui button:active:not(:disabled){transform:translateY(1px)}
.rpg-ui button:focus-visible,.rpg-ui summary:focus-visible{outline:2px solid var(--rpg-ribbon);outline-offset:3px}
.rpg-ui button:disabled{opacity:.45;cursor:not-allowed}
.rpg-ui button[aria-pressed=true]{border-color:var(--rpg-ribbon);color:var(--rpg-ribbon-deep);background:rgba(255,250,236,.92);box-shadow:inset 0 -3px 0 var(--rpg-ribbon)}
.rpg-ui h2,.rpg-ui h3,.rpg-ui p{margin:0}.rpg-ui h2{font-size:24px}.rpg-ui h3{font-size:18px}.rpg-ui small{font-size:12.5px;color:${BK.ink3}}
.rpg-ui h2,.rpg-ui h3{font-family:var(--rpg-serif);font-weight:900}
/* ---- exploration: the page margin ---- */
.rpg-ui .rpg-hud{position:absolute;inset:0 16px auto;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;z-index:8}
.rpg-place{position:relative;display:grid;gap:0;min-width:170px;margin-top:14px;padding:8px 22px 11px 16px;background:${paperFill()};box-shadow:0 6px 14px rgba(0,0,0,.45),inset 0 0 0 1px rgba(35,24,15,.16);color:${BK.ink}}
.rpg-place::after{content:'';position:absolute;left:16px;right:22px;bottom:6px;height:1px;background:${BK.ink2};opacity:.45}
.rpg-place-name{font:900 21px/1.3 var(--rpg-serif);letter-spacing:.18em;color:${BK.ink}}
.rpg-place-sub{font:13px/1.5 var(--rpg-body);letter-spacing:.12em;color:${BK.ink2}}
.rpg-ui .rpg-menu-button{margin-left:auto;width:46px;height:64px;min-height:64px;padding:10px 0 18px;border:0;border-radius:0;background:${ribbon},var(--rpg-ribbon);clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 12px),0 100%);color:#fff6ea;font:900 14px/1 var(--rpg-serif);letter-spacing:.24em;writing-mode:vertical-rl;box-shadow:none;transition:transform .2s cubic-bezier(.3,1.4,.5,1)}
.rpg-ui .rpg-menu-button:hover:not(:disabled){transform:translateY(5px);background:${ribbon},var(--rpg-ribbon);border:0}
.rpg-ui .rpg-menu-button:focus-visible{outline:2px solid ${BK.errata};outline-offset:-4px}
.rpg-menu-button svg{display:none}
.rpg-ui .rpg-fullscreen{position:absolute;top:70px;right:16px;z-index:45;width:44px;height:44px;min-height:44px;padding:10px;border-radius:50%;border:1.5px solid ${BK.brassDeep};background:radial-gradient(circle at 40% 32%,#f0d79a,${BK.brass} 52%,#7a5427);color:${BK.ink};box-shadow:0 3px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.5);pointer-events:auto}
.rpg-ui .rpg-fullscreen:hover:not(:disabled){background:radial-gradient(circle at 40% 32%,#fbe4ab,#c79a55 52%,#7a5427);border-color:${BK.brassDeep}}
.rpg-ui .rpg-window .rpg-fullscreen-inline{margin-left:auto;align-self:center;flex:none;width:36px;height:36px;min-height:36px;padding:8px;border-radius:50%;border:1.5px solid ${BK.brassDeep};background:radial-gradient(circle at 40% 32%,#f0d79a,${BK.brass} 55%,#7a5427);color:${BK.ink}}
.rpg-ui .rpg-window .rpg-fullscreen-inline:not([hidden])+.rpg-back{margin-left:8px}
.rpg-fullscreen svg,.rpg-fullscreen-inline svg{display:block;width:100%;height:100%;pointer-events:none}
.rpg-toast{position:absolute;left:50%;top:86px;transform:translateX(-50%);max-width:min(80%,640px);min-width:min(360px,80%);padding:10px 26px 10px 34px;background:${paperFill()};box-shadow:0 8px 18px rgba(0,0,0,.45);font:15px/1.6 var(--rpg-body);letter-spacing:.08em;text-align:center;color:${BK.ink};animation:rpg-appear .25s}
.rpg-toast::before{content:'';position:absolute;left:12px;top:50%;width:14px;height:14px;margin-top:-7px;background:${BK_FLEURON} center/contain no-repeat}
.rpg-nearby{position:absolute;left:50%;top:62%;transform:translateX(-50%);display:flex;align-items:center;gap:9px;padding:6px 18px 6px 12px;background:rgba(246,236,214,.95);box-shadow:0 4px 12px rgba(0,0,0,.4);font:italic 15px/1.5 var(--rpg-body);letter-spacing:.16em;white-space:nowrap;color:${BK.ink};pointer-events:none;animation:rpg-appear .2s}
.rpg-nearby::before{content:'';width:28px;height:17px;background:${BK_MANICULE} center/contain no-repeat}
.rpg-explore-actions{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));right:max(18px,env(safe-area-inset-right));display:flex;align-items:center;gap:12px}
.rpg-help{display:flex;align-items:center;gap:6px;padding:7px 13px;background:rgba(246,236,214,.92);box-shadow:0 3px 9px rgba(0,0,0,.35);font:13px/1 var(--rpg-body);letter-spacing:.1em;color:${BK.ink2}}
.rpg-help kbd{display:inline-grid;place-items:center;min-width:24px;height:23px;padding:0 6px;margin-left:9px;font:700 12px/1 var(--rpg-fig);letter-spacing:.04em;color:#efe3c8;background:linear-gradient(180deg,#5a4a3c,#2a211a);border-radius:2px;box-shadow:0 2px 0 #120c08,inset 0 1px 0 rgba(255,255,255,.22)}
.rpg-help kbd:first-child{margin-left:0}
/* Native-feeling touch controls; no text selection, callout, or per-frame canvas. */
.rpg-joystick{display:none;position:absolute;width:116px;height:116px;left:max(14px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;z-index:9}
.rpg-stick-ring{width:100%!important;height:100%!important;fill:rgba(246,236,214,.2);stroke:${BK.brassHi};stroke-width:2;pointer-events:none}.rpg-stick-ring path{fill:none;stroke-width:3;stroke:${BK.brassHi}}
.rpg-stick-thumb{position:absolute;width:42px;height:42px;left:37px;top:37px;border-radius:50%;background:radial-gradient(circle at 38% 30%,#f6e0a8,${BK.brass} 50%,#5c3d1a);box-shadow:0 3px 10px rgba(0,0,0,.5),inset 0 0 0 2px rgba(60,36,14,.6);pointer-events:none;will-change:transform}
.rpg-joystick.is-active .rpg-stick-ring{stroke:#fff1c8}
.rpg-ui button,.rpg-target-arrow{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
.rpg-ui .rpg-interact{width:60px;min-width:60px;height:60px;padding:14px;border-radius:50%;touch-action:none;display:grid;place-items:center;border:1.5px solid ${BK.brassDeep};background:radial-gradient(circle at 40% 32%,#f3dca0,${BK.brass} 52%,#6e4e26);box-shadow:0 4px 12px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.5);color:${BK.ink}}.rpg-interact svg{width:100%!important;height:100%!important;pointer-events:none}
.rpg-ui .rpg-interact:hover:not(:disabled){background:radial-gradient(circle at 40% 32%,#fbe4ab,#c79a55 52%,#6e4e26);border-color:${BK.brassDeep}}
/* ---- dialogs: the journal, chapter pages, the colophon ---- */
.rpg-menu-shade{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,rgba(30,16,10,.52),rgba(8,4,2,.86));display:grid;place-items:center;padding:clamp(10px,2.6cqh,24px);pointer-events:auto;z-index:12}
.rpg-window{position:relative;width:min(820px,100%);max-height:100%;display:flex;flex-direction:column;gap:14px;padding:28px 34px 24px;background:${paperFill('left')};box-shadow:0 26px 70px rgba(0,0,0,.65),inset 0 0 0 1px rgba(35,24,15,.18);overflow:hidden;color:${BK.ink}}
.rpg-window-header{position:relative;display:flex;align-items:flex-end;gap:16px;padding-bottom:10px;flex-shrink:0;border-bottom:1px solid ${BK.rule}}
.rpg-window-header h2{font:900 26px/1.3 var(--rpg-serif);letter-spacing:.26em;color:${BK.ink}}
.rpg-window-sub{flex:1;padding-bottom:3px;font:13.5px/1.4 var(--rpg-body);letter-spacing:.14em;color:${BK.ink3};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rpg-ui .rpg-window .rpg-back{margin-left:auto;align-self:center;width:40px;height:40px;min-height:40px;padding:0;border-radius:50%;border:1.5px solid rgba(35,24,15,.35);background:transparent;font:400 24px/1 var(--rpg-body);letter-spacing:0;color:${BK.ink2}}
.rpg-ui .rpg-window .rpg-back:hover:not(:disabled){background:var(--rpg-ribbon);border-color:var(--rpg-ribbon);color:#fff}
.rpg-menu-tabs{display:flex;flex-wrap:wrap;gap:6px}
.rpg-menu-body{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(94,75,58,.45) transparent;display:grid;align-content:start;gap:12px;font-size:14.5px;padding-right:4px}
.rpg-menu-body>p{font:15px/1.85 var(--rpg-body);color:${BK.ink};letter-spacing:.04em;white-space:pre-line}
.rpg-menu-body details{border-top:1px dotted rgba(35,24,15,.3);padding:8px 0 2px;pointer-events:auto}
.rpg-menu-body summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;font:900 15px/1.5 var(--rpg-serif);letter-spacing:.08em;color:${BK.ink}}
.rpg-menu-body summary::-webkit-details-marker{display:none}
.rpg-menu-body summary::before{content:'';width:18px;height:11px;flex:none;background:${BK_MANICULE} center/contain no-repeat;opacity:.5;transition:opacity .15s}
.rpg-menu-body details[open]>summary::before{opacity:1}
.rpg-menu-body details>p{padding:6px 0 4px 26px}
.rpg-menu-body p{color:${BK.ink2};line-height:1.75;white-space:pre-line;overflow-wrap:anywhere}
.rpg-menu-body section{position:relative;display:grid;gap:7px;padding:12px 16px 13px;background:rgba(255,250,236,.6);box-shadow:inset 0 0 0 1px rgba(35,24,15,.15)}
.rpg-menu-body section>h3{display:flex;align-items:center;gap:10px;font:700 16.5px/1.4 var(--rpg-body);letter-spacing:.1em;color:${BK.ink}}
.rpg-menu-body button{font-size:14px;min-height:36px;padding:6px 14px}
.rpg-menu-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.rpg-menu-actions{display:flex;gap:6px;flex-wrap:wrap}
.rpg-menu-empty{padding:34px 0;text-align:center;font-family:var(--rpg-body);letter-spacing:.2em;color:${BK.ink3}!important}
.rpg-choice{width:100%;text-align:left;white-space:normal;min-height:48px!important}
.rpg-menu-footer{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;flex-shrink:0}
.rpg-menu-footer button{min-width:128px;letter-spacing:.2em}
.rpg-ui .rpg-menu-footer .is-primary{border-color:var(--rpg-ribbon-deep);background:var(--rpg-ribbon);color:#fff6ea}
.rpg-ui .rpg-menu-footer .is-primary:hover:not(:disabled){background:var(--rpg-ribbon);border-color:var(--rpg-ribbon-deep);filter:brightness(1.08);color:#fff6ea}
.rpg-ui .rpg-menu-footer .is-danger{color:${BK.blot};border-color:${BK.blot}}
.rpg-ui button[data-confirm=yes]{border-color:${BK.blot}!important;color:#fff6ea!important;background:${BK.blot}!important;animation:rpg-confirm .8s ease-in-out infinite alternate}
.rpg-menu-side{display:none}
.rpg-audio{position:relative;pointer-events:auto}.rpg-audio>details[data-booksea-audio]{position:relative!important;inset:auto!important;max-width:none!important;width:100%;border:0!important;box-shadow:none!important;background:transparent!important}.rpg-audio>details>summary{display:none}.rpg-audio>details>div{width:100%!important;max-width:none!important;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px!important;padding:0!important}.rpg-audio small{display:none}
.rpg-audio [data-booksea-audio]{color:${BK.ink}!important;font-family:${BK_SERIF}!important}
/* Journal: a travel notebook. Thumb-index tabs on the left, a pocket card for the tallies, the page on the right. */
.rpg-window.is-menu{width:min(1180px,100%);height:min(700px,100%);display:grid;grid-template-columns:clamp(180px,20%,240px) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"header header" "tabs body" "side footer";gap:16px 28px;padding:30px 36px 24px 46px}
.rpg-window.is-menu::before,.rpg-window.is-event::before{content:'';position:absolute;left:0;top:0;bottom:0;width:22px;background:${leatherFill(160)};box-shadow:inset -3px 0 4px rgba(0,0,0,.45),1px 0 0 rgba(255,255,255,.3)}
.rpg-window.is-menu::after{content:'';position:relative;z-index:0;grid-column:1;grid-row:2 / 4;margin:-8px -14px -10px -24px;background:linear-gradient(90deg,transparent 86%,rgba(40,20,10,.35)),var(--rpg-endpaper,var(--bk-tex-marble)) 0 0/260px auto,${BK.marbleA};box-shadow:inset -1px 0 0 rgba(35,24,15,.4)}
.rpg-ui[data-family=fairytale]{--rpg-endpaper:var(--bk-tex-marble-fairy)}.rpg-ui[data-family=marionette]{--rpg-endpaper:var(--bk-tex-marble-theater)}
.rpg-ui[data-family=fairytale] .rpg-window.is-menu::before,.rpg-ui[data-family=fairytale] .rpg-window.is-event::before{background:var(--bk-tex-cloth) 0 0/160px auto,${BK.cloth}}
.rpg-ui[data-family=marionette] .rpg-window.is-menu::before,.rpg-ui[data-family=marionette] .rpg-window.is-event::before{background:var(--bk-tex-velvet) 0 0/160px auto,${BK.velvet}}
.rpg-window.is-menu>*{position:relative;z-index:1}
.is-menu>.rpg-window-header{grid-area:header}.is-menu>.rpg-menu-body{grid-area:body}.is-menu>.rpg-menu-footer{grid-area:footer;align-self:end}.is-menu>.rpg-audio{grid-area:body}
.is-menu>.rpg-menu-tabs{grid-area:tabs;flex-direction:column;flex-wrap:nowrap;gap:7px;align-self:start;padding:2px 0 0}
.rpg-ui .is-menu>.rpg-menu-tabs button{position:relative;min-height:46px;padding:9px 12px 9px 18px;text-align:left;font:900 18px/1.3 var(--rpg-serif);letter-spacing:.34em;color:${BK.ink2};background:#f6ecd6;border:0;border-left:7px solid var(--tab,${BK.ink2});border-radius:0 7px 7px 0;box-shadow:inset 0 0 0 1px rgba(35,24,15,.14);transition:transform .16s,background .15s,color .15s}
.rpg-ui .is-menu>.rpg-menu-tabs button:hover:not(:disabled){background:#fffaf0;color:${BK.ink}}
.rpg-ui .is-menu>.rpg-menu-tabs button[aria-pressed=true]{color:#fff6ea;background:var(--tab,${BK.ink2});box-shadow:3px 3px 0 rgba(35,24,15,.16);transform:translateX(12px)}
.rpg-ui .rpg-menu-tabs [data-tab=party]{--tab:#2e4a6b}.rpg-ui .rpg-menu-tabs [data-tab=bag]{--tab:#7a5130}.rpg-ui .rpg-menu-tabs [data-tab=relic]{--tab:#4c5a2c}.rpg-ui .rpg-menu-tabs [data-tab=battle]{--tab:#7a1f1a}.rpg-ui .rpg-menu-tabs [data-tab=settings]{--tab:#4a3a5a}.rpg-ui .rpg-menu-tabs .rpg-tab-launch{--tab:#5e4b3a}
.is-menu>.rpg-menu-side{grid-area:side;position:relative;display:grid;gap:1px;align-self:end;margin:14px 6px 0 0;padding:14px 14px 58px;font:13.5px/1.6 var(--rpg-body);letter-spacing:.06em;color:${BK.ink2};background:repeating-linear-gradient(transparent 0 25px,rgba(46,74,107,.18) 25px 26px) 0 10px/100% calc(100% - 60px) no-repeat,#fbf4e2;box-shadow:0 2px 5px rgba(0,0,0,.2),inset 0 0 0 1px rgba(35,24,15,.14);transform:rotate(-1.2deg)}
.is-menu>.rpg-menu-side::after{content:'行囊';position:absolute;left:-7px;right:-7px;bottom:-5px;height:44px;padding-top:19px;text-align:center;font:900 13px/1 var(--rpg-serif);letter-spacing:.5em;color:rgba(60,36,14,.6);background:linear-gradient(176deg,rgba(255,255,255,.18),transparent 40%),#c79a5e;clip-path:polygon(0 16px,50% 0,100% 16px,100% 100%,0 100%);box-shadow:inset 0 0 0 1px rgba(60,36,14,.3)}
.rpg-menu-side>div{display:flex;justify-content:space-between;gap:10px;padding:1px 0}
.rpg-menu-side b{font:600 16px/1.5 var(--rpg-fig);color:${BK.ink};font-variant-numeric:tabular-nums}
.rpg-menu-side>div:last-child b{color:var(--rpg-ribbon-deep)}
/* Party members: one bookplate each */
.rpg-member{position:relative;display:grid;grid-template-columns:clamp(72px,9cqw,100px) minmax(0,1fr);gap:8px 18px;align-items:start;padding:14px 18px 14px 14px;background:${BK.card};box-shadow:1px 2px 6px rgba(60,40,20,.18),inset 0 0 0 1px rgba(35,24,15,.2)}
.rpg-member.is-away{opacity:.6;filter:grayscale(.6)}
.rpg-member-art{position:relative;grid-row:span 2;aspect-ratio:4/5;overflow:hidden;display:grid;place-items:center;border-radius:50% / 44%;background:radial-gradient(circle at 50% 38%,#efe0bd,#d6c095);box-shadow:inset 0 0 0 2px rgba(35,24,15,.55),inset 0 0 0 5px ${BK.card},inset 0 0 0 6px rgba(35,24,15,.28)}
.rpg-member-art img{position:absolute;inset:6px;width:calc(100% - 12px);height:calc(100% - 12px);border-radius:50% / 44%;object-fit:cover;object-position:center 22%;filter:sepia(.12)}
.rpg-member-art span{font:900 36px/1 var(--rpg-serif);color:${BK.ink2}}
.rpg-member-top{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.rpg-member-top h3{font:700 20px/1.3 var(--rpg-body);letter-spacing:.12em;color:${BK.ink}}
.rpg-member-meta{font:14px/1.4 var(--rpg-fig);letter-spacing:.06em;color:${BK.ink3}}
.rpg-member-tag{margin-left:auto;padding:0 9px;font:900 12.5px/1.7 var(--rpg-serif);letter-spacing:.14em;color:${BK.blot};border:1.5px solid ${BK.blot};transform:rotate(-4deg)}
.rpg-member-bars{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 20px}
.rpg-meter{display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:0 8px;font:12px/1.3 var(--rpg-fig);letter-spacing:.1em;color:${BK.ink3}}
.rpg-meter b{justify-self:end;font:600 15.5px/1.3 var(--rpg-fig);color:${BK.ink};font-variant-numeric:tabular-nums}
.rpg-meter b small{font-size:12px;color:${BK.ink3};font-weight:400}
.rpg-meter i{grid-column:1/-1;height:5px;margin-top:3px;background:rgba(35,24,15,.1);box-shadow:inset 0 0 0 1px rgba(35,24,15,.25);overflow:hidden}
.rpg-meter i em{display:block;height:100%;background:${BK.green}}
.rpg-meter.mp i em{background:${BK.blue}}.rpg-meter.sp i em{background:#a47a2a}
.rpg-meter.is-low b{color:${BK.blot}}.rpg-meter.is-low i em{background:${BK.blot}}
.rpg-member-actions{grid-column:2;display:flex;flex-wrap:wrap;gap:6px}
.rpg-member-actions>details{border:1px solid rgba(35,24,15,.2);padding:3px 12px 3px 9px;background:rgba(255,250,236,.6)}
.rpg-member-actions>details[open]{flex-basis:100%;padding:6px 12px 10px}
.rpg-member-actions summary{font-size:14px}
.rpg-member-actions>.rpg-menu-actions,.rpg-member-actions>button{flex-basis:auto}
.rpg-member-actions:empty{display:none}
/* Bag: kraft pocket envelopes; relics: pressed specimens; battle notes: red-ink annotations */
.rpg-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.rpg-tile{position:relative;display:grid;gap:0;padding:24px 12px 12px;text-align:center;background:linear-gradient(172deg,rgba(255,255,255,.2),transparent 36%),#cfa266;clip-path:polygon(0 14px,50% 0,100% 14px,100% 100%,0 100%)}
.rpg-tile span{font:13px/1.4 var(--rpg-body);letter-spacing:.2em;color:#4a2f14}
.rpg-tile b{font:600 30px/1.2 var(--rpg-fig);color:${BK.ink};font-variant-numeric:tabular-nums}
.rpg-tag{display:inline-block;padding:0 8px;font:900 12px/1.7 var(--rpg-serif);letter-spacing:.12em;color:${BK.ink2};border:1.5px solid ${BK.ink2}}
.rpg-menu-body[data-tab=bag]>section{background:linear-gradient(transparent 0 30px,rgba(60,36,14,.22) 30px 31px,transparent 31px),#e9cf9f;box-shadow:inset 0 0 0 1px rgba(60,36,14,.25)}
.rpg-menu-body[data-tab=relic]>section{padding-left:92px;min-height:104px;background:var(--rpg-specimen,none) 18px 50%/52px auto no-repeat,rgba(255,250,236,.7)}
.rpg-menu-body[data-tab=relic]>section::before{content:'';position:absolute;left:12px;top:10px;bottom:10px;width:64px;box-shadow:inset 0 0 0 1px rgba(35,24,15,.18);pointer-events:none}
.rpg-menu-body[data-tab=battle]>section{background:none;box-shadow:none;border-left:3px solid var(--rpg-ribbon);padding:6px 4px 8px 16px}
.rpg-menu-body[data-tab=battle]>section>h3{color:var(--rpg-ribbon-deep)}
.rpg-menu-body[data-tab=settings]>section>h3::before{content:'';width:16px;height:16px;background:${BK_FLEURON} center/contain no-repeat}
/* Event: a chapter opening with a decorated initial */
.rpg-window.is-event{width:min(780px,100%);padding:34px 44px 28px 56px}
.is-event .rpg-window-header{flex-direction:column;align-items:center;gap:6px;border-bottom:0;padding-bottom:22px;background:${BK_RULE} center bottom/220px 14px no-repeat}
.is-event .rpg-window-header h2{font-size:28px;letter-spacing:.3em;text-align:center}
.is-event .rpg-window-sub{display:none}
.is-event .rpg-menu-body>p{font-size:16px;line-height:1.95;color:${BK.ink};padding:2px 2px 6px}
.is-event .rpg-menu-body>p:first-child::first-letter{float:left;margin:5px 12px 0 0;padding:7px 9px;font:900 44px/1 var(--rpg-serif);color:#fff6ea;background:var(--rpg-ribbon);box-shadow:inset 0 0 0 2px rgba(255,246,234,.45),2px 2px 0 rgba(35,24,15,.2)}
.rpg-owner-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:9px 0;border-top:1px dotted rgba(35,24,15,.3);border-bottom:1px dotted rgba(35,24,15,.3)}
.rpg-owner-row>span{margin-right:6px;font:13px/1 var(--rpg-body);letter-spacing:.24em;color:${BK.ink3}}
.rpg-ui .rpg-owner-row button{min-height:34px;padding:4px 14px;font-size:14px;letter-spacing:.12em}
.rpg-ui .rpg-choice{position:relative;padding:12px 18px 12px 50px;font:900 17px/1.45 var(--rpg-serif);letter-spacing:.1em;background:rgba(255,250,236,.6);border:0;border-radius:0;border-bottom:1px solid ${BK.rule};box-shadow:none;text-align:left}
.rpg-ui .rpg-choice::before{content:'';position:absolute;left:12px;top:16px;width:28px;height:17px;background:${BK_MANICULE} center/contain no-repeat;opacity:.16;transition:opacity .15s,transform .15s}
.rpg-ui .rpg-choice:hover:not(:disabled)::before,.rpg-ui .rpg-choice:focus-visible::before{opacity:1;transform:translateX(3px)}
.rpg-ui .rpg-choice:hover:not(:disabled){background:#fffaf0;border-color:${BK.rule}}
.rpg-ui .rpg-choice:disabled{opacity:.62;padding-right:96px}
.rpg-ui .is-event .rpg-fullscreen-inline,.rpg-ui .is-ended .rpg-fullscreen-inline{position:absolute;right:0;top:0}
.rpg-ui .rpg-choice:disabled::after{content:'暂不可选';position:absolute;right:12px;top:12px;padding:0 8px;background:${BK.errata};font:900 12px/1.8 var(--rpg-serif);letter-spacing:.14em;color:${BK.ink}}
.rpg-event-description{color:${BK.ink2};font-family:var(--rpg-body)!important;letter-spacing:.02em}
/* End of a run: the colophon, stamped; a defeat is a torn page with an ink blot */
.rpg-window.is-ended{width:min(860px,100%);padding:34px 44px 26px}
.is-ended .rpg-window-header{flex-direction:column;align-items:center;gap:4px;border-bottom:0;padding-bottom:22px;background:${BK_RULE} center bottom/220px 14px no-repeat}
.is-ended .rpg-window-header h2{font-size:30px;letter-spacing:.3em;text-align:center}
.is-ended .rpg-window-sub{flex:none;text-align:center}
.rpg-window.is-ended[data-outcome=success]::after{content:'珍藏';position:absolute;left:40px;bottom:20px;width:92px;height:92px;display:grid;place-items:center;border:4px double var(--rpg-ribbon);border-radius:50%;font:900 24px/1 var(--rpg-serif);letter-spacing:.2em;padding-left:.2em;color:var(--rpg-ribbon);opacity:.86;mix-blend-mode:multiply;-webkit-mask:${BK_STAMP_WEAR} 0 0/140px;mask:${BK_STAMP_WEAR} 0 0/140px;animation:rpg-stamp .45s cubic-bezier(.2,1.6,.4,1) .25s both}
.rpg-window.is-ended:not([data-outcome=success]){clip-path:${tornEdge(5, 44, 2.2)};padding-bottom:40px}
.rpg-window.is-ended:not([data-outcome=success])::after{content:'';position:absolute;left:50%;top:-24px;width:300px;height:240px;margin-left:-150px;background:${BK_BLOT} center/contain no-repeat;opacity:.13;pointer-events:none;animation:rpg-blot 1.4s ease-out both}
.rpg-ended-host{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:18px;padding:4px 0 6px}
.rpg-ended-host img{width:84px;height:100px;padding:3px;border:2px solid ${BK.ink2};border-radius:50% / 44%;object-fit:cover;background:${BK.card}}
.rpg-ended-host p{font:italic 16px/1.8 var(--rpg-body)!important;letter-spacing:.08em;color:${BK.ink}!important}
.rpg-ended-host p small{display:block;font:900 12px/1.6 var(--rpg-serif);font-style:normal;letter-spacing:.3em;color:${BK.ink3}}
.rpg-ledger{display:grid;gap:0;padding:2px 0;background:none;border:0}
.rpg-ledger>h3{padding:10px 0 4px;font:900 14px/1.4 var(--rpg-serif)!important;letter-spacing:.42em;color:${BK.ink2}!important;text-align:center}
.rpg-ledger-row{display:flex;justify-content:space-between;align-items:baseline;gap:0 16px;padding:5px 2px;font:15px/1.5 var(--rpg-body);letter-spacing:.06em;color:${BK.ink};background:radial-gradient(circle,rgba(35,24,15,.5) .8px,transparent 1.3px) 0 calc(.75em + 6px)/6px 4px repeat-x}
.rpg-ledger-row>span,.rpg-ledger-row>b{padding:0 6px;background:${BK.page}}
.rpg-ledger-row b{font:600 16px/1.5 var(--rpg-fig);color:${BK.ink};font-variant-numeric:tabular-nums}
.rpg-ledger-row small{flex-basis:100%;font:12.5px/1.6 var(--rpg-body)!important;color:${BK.ink3}!important}
.rpg-ledger-row{flex-wrap:wrap}
/* Title (standalone trial): the closed book — oxblood leather, a pasted cover plate, a stamped title */
.rpg-menu-shade.is-title{place-items:center;padding:clamp(12px,3cqh,30px);background:radial-gradient(ellipse at 50% 40%,#3a2016,#140c09 72%);backdrop-filter:none}
.rpg-window.rpg-title{width:min(560px,92%);max-height:100%;padding:26px 34px 22px;gap:0;background:${leatherFill()};border-radius:4px 10px 10px 4px;box-shadow:0 30px 70px rgba(0,0,0,.7),inset 7px 0 10px rgba(0,0,0,.4);overflow:visible;text-align:center;align-items:center;color:#f3dfa8}
.rpg-window.rpg-title::before{content:'';position:absolute;inset:0;pointer-events:none;background:${brassCorners(40, -4)}}
.rpg-window.rpg-title::after{content:'';order:-1;display:block;width:74%;aspect-ratio:16/10;margin:4px auto 18px;background:var(--rpg-title-art,radial-gradient(ellipse,#5a3424,#24130c)) 70% 40%/cover no-repeat;box-shadow:0 0 0 3px #e7d3a0,0 0 0 4px rgba(0,0,0,.45),0 4px 12px rgba(0,0,0,.55)}
.rpg-title .rpg-window-header{flex-direction:column;align-items:center;gap:6px;padding-bottom:14px;border-bottom:0}
.rpg-title .rpg-window-header h2{font:900 clamp(34px,7cqh,52px)/1.2 var(--rpg-serif);letter-spacing:.24em;padding-left:.24em;color:transparent;background:linear-gradient(180deg,#fff0c4,#d9b46a 55%,#9c7638);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 1px 0 rgba(0,0,0,.65))}
.rpg-title .rpg-window-sub{flex:none;padding:0 0 0 .6em;font:italic clamp(13px,2cqh,16px)/1.6 var(--bk-latin);letter-spacing:.6em;color:#cfae6c}
.rpg-title .rpg-menu-body{overflow:visible;padding:6px 0 18px}
.rpg-title .rpg-menu-body>p{font:clamp(14px,2.3cqh,17px)/1.8 var(--rpg-body);letter-spacing:.3em;color:#ead8b0;text-align:center}
.rpg-title .rpg-menu-footer{flex-direction:column;align-items:center;gap:8px}
.rpg-ui .rpg-title .rpg-menu-footer button{position:relative;min-width:240px;min-height:46px;padding:10px 36px;font:900 clamp(17px,3cqh,20px)/1.3 var(--rpg-serif);letter-spacing:.4em;color:#f3dfa8;background:transparent;border:1.5px solid rgba(220,184,120,.55);border-radius:2px;box-shadow:none}
.rpg-ui .rpg-title .rpg-menu-footer button:hover:not(:disabled),.rpg-ui .rpg-title .rpg-menu-footer button:focus-visible{background:rgba(220,184,120,.14);border-color:#f3dfa8;color:#fff3cf;outline:0}
.rpg-title-mark{margin-top:16px;font:italic 13px/1 var(--bk-latin);letter-spacing:.3em;color:#bf9f62}
/* "?" warning: an errata slip pasted over the page; no portrait, no speaker. */
.rpg-warning{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 50%,rgba(60,8,8,.25),rgba(0,0,0,.72));z-index:40;pointer-events:auto;animation:rpg-fade .3s}
.rpg-warning-box{position:relative;min-width:min(380px,86%);max-width:min(560px,92%);padding:30px 40px 22px;text-align:center;background:${BK.errata};box-shadow:0 18px 50px rgba(0,0,0,.6),inset 0 0 0 1px rgba(35,24,15,.2);transform:rotate(-1.2deg);animation:rpg-paste .35s cubic-bezier(.2,1.4,.4,1) both}
.rpg-warning-box::before{content:'勘误';position:absolute;left:16px;top:-13px;padding:0 10px;background:${BK.ink};color:${BK.errata};font:900 13px/1.9 var(--rpg-serif);letter-spacing:.3em}
.rpg-warning-text{font:900 22px/1.6 var(--rpg-serif);letter-spacing:.3em;color:${BK.blot};animation:rpg-warn 1.6s ease-in-out infinite alternate}
.rpg-ui .rpg-warning-button{margin-top:16px;min-width:120px;letter-spacing:.3em;border-color:${BK.ink}}
.rpg-exit-ask{background:radial-gradient(ellipse at 50% 50%,rgba(20,10,6,.25),rgba(0,0,0,.62))}
.rpg-exit-ask .rpg-warning-box{background:${paperFill()};transform:none;padding-top:40px}
.rpg-exit-ask .rpg-warning-box::before{content:'';left:50%;top:-8px;width:24px;height:46px;margin-left:-12px;padding:0;background:${ribbon},var(--rpg-ribbon);clip-path:polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)}
.rpg-exit-ask .rpg-warning-text{color:${BK.ink};animation:none}
.rpg-exit-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
.rpg-ui .rpg-exit-ask .rpg-warning-button{border-color:${BK.ink2}}
.rpg-ui .rpg-exit-ask .rpg-warning-button.is-primary{border-color:var(--rpg-ribbon-deep);background:var(--rpg-ribbon);color:#fff6ea}
/* ---- battle geometry (0.36, unchanged) ---- */
.rpg-explore-actions.is-battle-control{display:none;bottom:46%;right:max(16px,env(safe-area-inset-right));z-index:9}
.rpg-battle{position:absolute;inset:0;overflow:hidden;background:radial-gradient(ellipse at 50% 38%,transparent 30%,#09080e9c 100%)}
.rpg-battle::before{content:'';position:absolute;inset:50% 5% 15%;background:radial-gradient(ellipse,#cfb58b10,transparent 65%);pointer-events:none}
.rpg-battle-log{position:absolute;left:3%;right:70px;top:3%;min-height:46px;max-height:22%;padding:10px 17px;background:linear-gradient(90deg,#14131cdf,#14131caa 72%,transparent);border-left:2px solid var(--rpg-gold);font-size:clamp(14px,2.25cqh,22px);text-shadow:1px 2px 3px #000;z-index:6;overflow:auto;pointer-events:auto;white-space:pre-line}
.rpg-enemies{position:absolute;inset:17% 5% 29%;display:flex;align-items:stretch;justify-content:center;gap:clamp(12px,3cqw,60px);padding:15px 0 3px;z-index:2}
.rpg-ui .rpg-enemy{position:relative;flex:0 1 370px;max-width:44%;min-height:0;padding:0 0 6px;background:none!important;border:0!important;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;overflow:visible;filter:drop-shadow(0 6px 8px #0008)}
.rpg-ui .rpg-enemy:only-child{max-width:85%}
.rpg-enemy .rpg-enemy-art{width:100%;height:calc(100% - 44px);min-height:0;object-fit:contain;object-position:center bottom;image-rendering:pixelated;pointer-events:none;transform-origin:center bottom}
.rpg-enemy-head{flex:0 0 40px;display:flex;align-items:center;flex-direction:column;gap:3px;order:-1;margin-bottom:4px;max-width:100%;text-shadow:0 2px 4px #000;font-size:14px}
.rpg-enemy-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;letter-spacing:1px}
.rpg-enemy-hp{font-size:11px;font-variant-numeric:tabular-nums;color:#eee3d2;display:flex;align-items:center;gap:6px}
.rpg-mini-hp{display:block;height:4px;width:clamp(50px,9cqw,120px);background:#18141a;border:1px solid #ecdfbc77}.rpg-mini-hp>i{display:block;height:100%;background:#d98670;transition:width .3s}
.rpg-enemy.is-down{filter:grayscale(1) drop-shadow(0 6px 8px #0008);opacity:.24}


.rpg-enemy-sigil{height:70%;display:grid;place-items:center;color:#dcc396;font-size:84px;filter:drop-shadow(0 0 20px #d8c0a466)}
.rpg-party-dock{position:absolute;left:3%;right:3%;bottom:max(14px,env(safe-area-inset-bottom));height:clamp(145px,26%,245px);display:flex;justify-content:center;gap:10px;z-index:5}
.rpg-party{display:flex;justify-content:center;gap:8px;flex:0 1 950px;min-width:0;height:100%;align-self:flex-end}
.rpg-battle.has-commands .rpg-party{flex:1 1 0;max-width:none}
.rpg-ui .rpg-party-card{position:relative;flex:1 1 0;min-height:0;max-width:270px;height:100%;padding:0;overflow:hidden;text-align:left;border:1px solid #e3d3b74a;background:linear-gradient(155deg,#35303b,#15131d);border-radius:2px;isolation:isolate}
.rpg-party-portrait{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 23%;z-index:-2;pointer-events:none}
.rpg-party-card::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 6%,#10101b24 33%,#0d0d16df 62%,#090a11fc 100%);z-index:-1;pointer-events:none}
.rpg-monogram{position:absolute;inset:0 0 28%;display:grid;place-items:center;font:68px Georgia,'Songti SC',serif;color:#d6c3a16e;text-shadow:0 0 30px #e0c09133;z-index:-2;background:radial-gradient(ellipse,#60546c55,transparent 70%)}
.rpg-party-card.is-active{border-color:#f0d48e;box-shadow:0 0 0 1px #e6bc6944,inset 0 0 20px #ffe4a418}
.rpg-party-card.is-down .rpg-party-portrait{filter:grayscale(1);opacity:.35}.rpg-party-card.is-down .rpg-party-name{color:#d67778}
.rpg-party-card.is-target{border-color:#d6e7f4;box-shadow:0 0 8px #d6e7f455}.rpg-party-card.is-selected{border-color:#f3d997;box-shadow:0 0 0 2px #f3d99766}
.rpg-party-info{position:absolute;bottom:9px;left:10px;right:10px;display:grid;gap:4px}
.rpg-party-name{display:block;font-size:clamp(14px,2.8cqh,24px);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:1px 2px 3px #000;line-height:1.3;letter-spacing:.5px}
.rpg-resource{position:relative;height:18px;display:flex;align-items:center;justify-content:space-between;font-size:12px;font-variant-numeric:tabular-nums;text-shadow:1px 1px 2px #000;overflow:hidden}
.rpg-resource>span{z-index:1}.rpg-resource>b{font-size:12px;z-index:1;font-weight:500}.rpg-resource>i{position:absolute;bottom:0;left:25px;right:0;height:4px;background:#303042}
.rpg-resource>i>em{display:block;height:100%;transition:width .32s;background:#db806a}.rpg-resource.mp>i>em{background:#7f9cde}.rpg-resource.sp>i>em{background:#86bb9b}
.rpg-atb{position:absolute;left:0;right:0;top:0;height:3px;background:#201f2a}.rpg-atb>i{display:block;height:100%;background:#bca0e8;transition:width .08s linear}
.rpg-badges{position:absolute;right:7px;top:9px;display:flex;gap:3px;flex-wrap:wrap;max-width:90%;justify-content:flex-end}.rpg-badge{font-size:12px;background:#161321cf;border:1px solid #baa57a88;padding:1px 4px;border-radius:2px;text-shadow:1px 1px #000}
.rpg-ui .rpg-commands{flex:0 0 clamp(145px,18%,225px);height:100%;padding:9px;background:linear-gradient(140deg,#211b26eb,#110f1aef);border:1px solid #e6d1a280;box-shadow:inset 0 0 0 3px #19141d,inset 0 0 0 4px #d1bb8d44;display:flex;flex-direction:column;gap:2px;pointer-events:auto;overflow:auto}
.rpg-command-owner{font-size:12px;color:#d4bd8f;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 2px 6px}
.rpg-ui .rpg-command{flex:1 0 30px;min-height:30px;font-size:clamp(16px,2.9cqh,25px);border-color:transparent;background:#18131a80;position:relative;padding:3px 18px;text-align:center}
.rpg-command:hover::before,.rpg-command:focus-visible::before{content:'';position:absolute;left:6px;top:50%;transform:translateY(-50%);width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid #f3d48c;pointer-events:none}
/* A full-width RPG skill page: help above, two-column list below. */
.rpg-skill-help,.rpg-action-window{position:absolute;left:8px;right:8px;display:flex;flex-direction:column;min-height:0;pointer-events:auto;z-index:7;border:1px solid #e6d5b28f;border-radius:0;background:linear-gradient(120deg,#211d29ee,#13111beb);box-shadow:inset 0 0 0 3px #211b27,inset 0 0 0 4px #c5b69444;overflow:hidden}
.rpg-skill-help{top:8px;height:29%;padding:18px 23px;gap:8px}
.rpg-skill-heading{display:flex;align-items:baseline;justify-content:space-between;gap:18px;padding-right:54px;flex-shrink:0}
.rpg-ui .rpg-skill-heading h3{font-size:clamp(18px,2.8cqh,28px);font-weight:500;color:#ead8ad;overflow-wrap:anywhere}
.rpg-skill-cost{font-size:clamp(12px,1.9cqh,19px);white-space:nowrap;color:#a9d0c5}
.rpg-skill-description{min-height:0;flex:1;overflow:auto;white-space:pre-line;overflow-wrap:anywhere;font-size:clamp(15px,2.35cqh,23px);line-height:1.65;scrollbar-color:#a38b64 #211b28;overscroll-behavior:contain}
.rpg-ui .rpg-skill-unavailable{font-size:clamp(13px,1.8cqh,18px);color:#edbfa1;flex-shrink:0}
.rpg-action-window{bottom:8px;height:36%;padding:10px 15px;gap:8px}
.rpg-action-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;color:#dccba7;font-size:16px}
.rpg-ui .rpg-back{padding:5px 13px;min-height:32px;font-size:14px;flex-shrink:0}
.rpg-action-tabs{display:flex;flex-wrap:wrap;gap:5px}.rpg-ui .rpg-action-tabs button{min-height:30px;padding:4px 12px;font-size:14px}
.rpg-action-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(clamp(36px,5.8cqh,58px),max-content);align-content:start;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;gap:3px 16px;scrollbar-color:#b8a27b #211b28;overscroll-behavior:contain}
.rpg-ui .rpg-action{display:grid;grid-template-columns:clamp(22px,3.3cqh,34px) minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;min-height:0;padding:6px 12px;font-size:clamp(16px,2.65cqh,27px);text-align:left;background:#211c2a4d;border:1px solid transparent;border-bottom-color:#e0d0b61c;border-radius:0}
.rpg-ui .rpg-action:hover,.rpg-ui .rpg-action.is-current{border-color:#f0dcaf!important;background:linear-gradient(90deg,#c7b18426,#a98cc313)!important;box-shadow:inset 0 0 0 2px #17121c,inset 0 0 0 3px #e7d5b33d}
.rpg-action-icon{display:grid;place-items:center;width:100%;aspect-ratio:1;color:#b9d0eb;background:#3c49564d;border:1px solid #b9c8d655;font-size:.85em}
.rpg-action-name{overflow-wrap:anywhere;line-height:1.35}.rpg-action-cost{font-size:clamp(11px,1.8cqh,18px)!important;white-space:nowrap;color:#a2d1bc!important}
.rpg-ui .rpg-action[aria-disabled=true]{color:#a8a0a1}.rpg-action[aria-disabled=true] .rpg-action-icon,.rpg-action[aria-disabled=true] .rpg-action-cost{opacity:.5}
.rpg-action-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-shrink:0}.rpg-action-position{font-size:12px;color:#c3b8a6}

.rpg-action-window.is-targeting{bottom:calc(28% + 18px);height:auto;max-height:20%;padding:10px 16px}
.rpg-target-controls{display:flex;flex-wrap:wrap;gap:6px;min-height:0;overflow:auto}.rpg-ui .rpg-target-controls button{font-size:15px;min-height:36px;padding:6px 14px}
.rpg-summons{position:absolute;left:3%;bottom:29%;display:flex;gap:5px;max-width:65%;overflow:auto;z-index:6;pointer-events:auto}.rpg-ui .rpg-summons button{font-size:12px;min-height:28px;padding:4px 8px;background:#1c1925c9}
.rpg-damage{position:absolute;left:50%;top:30%;transform:translateX(-50%);font-size:clamp(24px,4.5cqh,44px);font-weight:800;color:#fff6e5;text-shadow:-2px -2px #25202a,2px 2px #25202a,0 4px 8px #000;z-index:20;pointer-events:none;white-space:nowrap;animation:rpg-damage calc(.9s / var(--rpg-speed,1)) both}
.rpg-damage.heal{color:#96e6b5}.rpg-battle.is-flashing::after{content:'';position:absolute;inset:0;background:#b536382e;z-index:4;pointer-events:none;animation:rpg-flash calc(.32s / var(--rpg-speed,1)) both}
.rpg-hit{animation:rpg-shake calc(.35s / var(--rpg-speed,1))}.rpg-attacking .rpg-enemy-art{animation:rpg-attack calc(.4s / var(--rpg-speed,1))}
@keyframes rpg-appear{from{opacity:0;transform:translateX(-50%) translateY(-4px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes rpg-cursor{from{transform:translateY(-3px)}to{transform:translateY(3px)}}
@keyframes rpg-damage{0%{opacity:0;translate:0 12px;scale:.85}20%{opacity:1;translate:0 -12px;scale:1.04}75%{opacity:1}100%{opacity:0;translate:0 -40px;scale:1}}
@keyframes rpg-flash{0%,100%{opacity:0}30%{opacity:1}}
@keyframes rpg-shake{15%,65%{translate:-5px 0}40%,85%{translate:5px 0}100%{translate:0 0}}
@keyframes rpg-attack{40%{translate:0 13px;scale:1.04}100%{translate:0 0;scale:1}}
@media(pointer:coarse){.rpg-joystick{display:block}.rpg-help{display:none}.rpg-explore-actions.is-battle-control{display:flex}}
@container(max-width:720px){.rpg-party-dock{left:2%;right:2%;gap:6px}.rpg-party{gap:5px}.rpg-party-info{left:6px;right:6px;bottom:7px}.rpg-resource,.rpg-resource>b{font-size:10px}.rpg-ui .rpg-commands{flex-basis:135px;padding:7px}.rpg-ui .rpg-command{font-size:17px}.rpg-battle-log{left:2%;font-size:15px}.rpg-enemies{inset:18% 4% 29%;gap:16px}.rpg-party-name{font-size:15px}}
@container(max-width:480px){.rpg-party-dock{height:35%;bottom:10px}.rpg-party{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-width:330px;width:100%}.rpg-ui .rpg-party-card{max-width:none;min-height:0;width:100%}.rpg-party-info{gap:1px;bottom:5px}.rpg-party-name{font-size:13px}.rpg-resource{height:14px}.rpg-resource>b{font-size:9px}.rpg-resource>i{height:3px}.rpg-ui .rpg-commands{flex-basis:118px;max-width:118px}.rpg-ui .rpg-command{font-size:17px;min-height:34px}.rpg-enemies{bottom:37%;top:20%;gap:9px}.rpg-enemy-head{font-size:12px;flex-basis:35px}.rpg-enemy-hp{font-size:9px}.rpg-mini-hp{width:45px}.rpg-enemy .rpg-enemy-art{height:calc(100% - 38px)}.rpg-battle-log{top:5%;max-height:15%;right:57px;padding:8px;font-size:13px}.rpg-summons{bottom:36%}.rpg-audio>details>div{grid-template-columns:1fr}.rpg-monogram{font-size:42px}.rpg-badges{font-size:9px;top:6px;right:4px}.rpg-badge{font-size:9px}}
@container(max-height:490px){.rpg-ui .rpg-commands{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:3px;padding:6px}.rpg-command-owner{display:none}.rpg-party-dock{height:34%;min-height:120px;bottom:8px}.rpg-enemies{inset:15% 8% 37%}.rpg-enemy-head{font-size:11px;flex-basis:28px}.rpg-enemy .rpg-enemy-art{height:calc(100% - 30px)}.rpg-enemy-hp{font-size:9px}.rpg-party-name{font-size:15px}.rpg-party-info{gap:1px}.rpg-resource{height:14px}.rpg-resource,.rpg-resource>b{font-size:10px}.rpg-ui .rpg-command{font-size:15px;min-height:22px;padding:1px 10px}.rpg-command-owner{font-size:10px;padding:0}.rpg-battle-log{padding:6px 12px;font-size:13px;max-height:22%}.rpg-summons{bottom:36%}}
@container(max-width:480px){.rpg-skill-help{left:5px;right:5px;top:5px;height:30%;padding:12px;gap:6px}.rpg-skill-heading{display:block;padding-right:48px}.rpg-ui .rpg-skill-heading h3{font-size:17px}.rpg-skill-cost{font-size:11px}.rpg-skill-description{font-size:14px;line-height:1.65}.rpg-action-window{left:5px;right:5px;bottom:5px;height:40%;padding:8px;gap:6px}.rpg-action-list{gap:3px 5px;grid-auto-rows:minmax(46px,max-content)}.rpg-ui .rpg-action{font-size:14px;padding:6px;gap:5px;grid-template-columns:19px minmax(0,1fr)}.rpg-action-icon{grid-row:1/3}.rpg-action-cost{grid-column:2;font-size:10px!important}.rpg-ui .rpg-action-tabs button{font-size:12px;padding:4px 8px;min-height:28px}.rpg-ui .rpg-back{min-height:30px;padding:4px 10px;font-size:12px}.rpg-action-position{font-size:10px}.rpg-action-window.is-targeting{bottom:calc(36% + 18px);height:auto;max-height:20%}}
@container(max-height:490px){.rpg-skill-help{top:5px;left:5px;right:5px;height:29%;padding:9px 14px;gap:4px}.rpg-ui .rpg-skill-heading h3{font-size:16px}.rpg-skill-cost{font-size:12px}.rpg-skill-description{font-size:13px;line-height:1.5}.rpg-ui .rpg-skill-unavailable{font-size:12px}.rpg-action-window{left:5px;right:5px;bottom:5px;height:43%;padding:6px 10px;gap:4px}.rpg-action-list{grid-auto-rows:minmax(31px,max-content);gap:2px 12px}.rpg-ui .rpg-action{font-size:15px;padding:4px 8px;gap:8px;grid-template-columns:21px minmax(0,1fr) auto}.rpg-action-cost{font-size:11px!important;grid-column:auto}.rpg-ui .rpg-action-tabs button{min-height:24px;font-size:11px;padding:3px 9px}.rpg-ui .rpg-back{min-height:30px;padding:3px 14px;font-size:12px}.rpg-action-position{font-size:10px}.rpg-action-window.is-targeting{bottom:calc(35% + 12px);height:auto;max-height:23%}}
/* ---- battle: the 0.46.0 skin, unchanged; the book skin stops at the battle's edge ---- */
.rpg-battle{font:16px/1.45 ${L_SANS};color:#efe6d0;--rpg-gold:#d8b978;--rpg-gold-hi:#f3dfa8;--rpg-gold-dim:rgba(216,185,120,.34);--rpg-panel:rgba(12,15,25,.94);--rpg-line:rgba(216,185,120,.46);--rpg-ink:#080a12;--rpg-mute:#a89f8c;--rpg-serif:${L_SERIF}}
.rpg-battle button{min-height:40px;margin:0;border:1px solid var(--rpg-line);border-radius:1px;padding:8px 14px;background:linear-gradient(180deg,rgba(26,31,48,.92),rgba(11,13,22,.94));color:#f1e7cf;cursor:pointer;line-height:1.25;letter-spacing:0;font-family:var(--rpg-serif);font-weight:400;box-shadow:inset 0 0 0 2px rgba(6,8,13,.75),inset 0 0 0 3px rgba(216,185,120,.1);text-shadow:0 1px 2px #000;transition:background .16s,border-color .16s,color .16s,box-shadow .16s}
.rpg-battle button:hover:not(:disabled){background:linear-gradient(180deg,rgba(74,60,34,.9),rgba(26,22,18,.94));border-color:var(--rpg-gold-hi);color:#fff6dc}
.rpg-battle button:active:not(:disabled){transform:none}
.rpg-battle button:focus-visible{outline:1px solid var(--rpg-gold-hi);outline-offset:3px;box-shadow:inset 0 0 0 2px rgba(6,8,13,.75),inset 0 0 0 3px rgba(243,223,168,.35),0 0 14px rgba(243,210,140,.28)}
.rpg-battle button:disabled{opacity:.42;cursor:not-allowed}
.rpg-battle button[aria-pressed=true]{border-color:var(--rpg-gold-hi);color:#fff3d2;background:linear-gradient(180deg,rgba(120,94,48,.62),rgba(46,36,22,.85));box-shadow:inset 0 0 0 2px rgba(6,8,13,.75),inset 0 0 0 3px rgba(216,185,120,.1)}
.rpg-battle h3{font-size:18px;font-family:var(--rpg-serif);font-weight:600}.rpg-battle small{font-size:12px;color:#c3baa6}
.rpg-battle .rpg-menu-empty{padding:34px 0;text-align:center;font-family:var(--rpg-serif);letter-spacing:.2em;color:#8f8674!important}
/* ---- battle skin (visual only) ---- */
.rpg-stage.is-battle>canvas{filter:blur(3px) brightness(.5) saturate(.62) sepia(.12)}
.rpg-battle{background:radial-gradient(ellipse at 50% 38%,transparent 30%,rgba(5,7,14,.7) 100%),linear-gradient(180deg,rgba(6,8,16,.35),transparent 30%,transparent 62%,rgba(6,8,16,.55))}
.rpg-battle::before{background:radial-gradient(ellipse,rgba(216,185,120,.08),transparent 65%)}
.rpg-battle-log{background:linear-gradient(90deg,rgba(8,10,18,.94),rgba(8,10,18,.78) 68%,transparent);border-left-color:var(--rpg-gold);box-shadow:inset 0 1px 0 rgba(216,185,120,.3),inset 0 -1px 0 rgba(216,185,120,.14);font-family:var(--rpg-serif);letter-spacing:.06em;color:#f1e6cc;scrollbar-width:thin;scrollbar-color:#8a7148 transparent}
.rpg-ui .rpg-enemy{box-shadow:none;text-shadow:none}
.rpg-ui .rpg-enemy:focus-visible{outline:0}
.rpg-enemy-head{font-family:var(--rpg-serif);text-shadow:0 2px 3px #000,0 0 8px #000}
.rpg-enemy-name{letter-spacing:.14em;color:#f6e9c9}
.rpg-enemy-hp{font-family:Georgia,serif;color:#dccfb2}
.rpg-mini-hp{background:#07080e;border-color:rgba(216,185,120,.55);box-shadow:0 1px 3px #000}.rpg-mini-hp>i{background:linear-gradient(90deg,#9a2f28,#e0795c)}
.rpg-enemy-sigil{color:var(--rpg-gold);font-family:var(--rpg-serif)}
.rpg-ui .rpg-party-card{border-color:rgba(216,185,120,.5);background:linear-gradient(160deg,#20263b,#0a0c16);border-radius:1px;box-shadow:inset 0 0 0 2px rgba(5,7,12,.85),inset 0 0 0 3px rgba(216,185,120,.16),0 6px 16px #0008}
.rpg-party-card::before{background:linear-gradient(180deg,transparent 8%,rgba(8,10,20,.2) 34%,rgba(7,9,17,.88) 62%,rgba(5,6,12,.98) 100%)}
.rpg-monogram{font-family:var(--rpg-serif);color:rgba(216,185,120,.45);text-shadow:0 0 30px rgba(216,185,120,.25);background:radial-gradient(ellipse,rgba(60,70,110,.4),transparent 70%)}
.rpg-party-card.is-active{border-color:var(--rpg-gold-hi);box-shadow:inset 0 0 0 2px rgba(5,7,12,.85),inset 0 0 0 3px rgba(243,223,168,.4),0 0 0 1px rgba(243,210,140,.35),0 0 18px rgba(243,210,140,.3)}
.rpg-party-card.is-target{border-color:#cfe2f2;box-shadow:0 0 10px rgba(200,225,245,.4)}.rpg-party-card.is-selected{border-color:var(--rpg-gold-hi);box-shadow:0 0 0 2px rgba(243,223,168,.45)}
.rpg-party-name{font-family:var(--rpg-serif);letter-spacing:.12em;color:#f7ead0;text-shadow:0 2px 3px #000}
.rpg-resource{font-family:Georgia,serif;color:#cfc4aa}.rpg-resource>b{color:#f3e8cf}
.rpg-resource>i{background:#06070d;box-shadow:0 0 0 1px rgba(216,185,120,.22)}
.rpg-resource>i>em{background:linear-gradient(90deg,#4f9d74,#a9e2a9)}.rpg-resource.mp>i>em{background:linear-gradient(90deg,#4f73c6,#a4c3f5)}.rpg-resource.sp>i>em{background:linear-gradient(90deg,#b98534,#f1d185)}
.rpg-atb{background:#06070d}.rpg-atb>i{background:linear-gradient(90deg,#8f73c8,#f0d796)}
.rpg-badge{font-family:var(--rpg-serif);background:rgba(8,10,18,.88);border-color:rgba(216,185,120,.5);color:#eedfb8;border-radius:0}
.rpg-ui .rpg-commands{background:${lFrame(L_FILL, 18)};border-color:rgba(216,185,120,.6);box-shadow:inset 0 0 0 3px rgba(5,7,12,.8),inset 0 0 0 4px rgba(216,185,120,.14),0 8px 22px #000a}
.rpg-command-owner{font-family:var(--rpg-serif);letter-spacing:.14em;color:#cdb688}
.rpg-ui .rpg-command{font-family:var(--rpg-serif);letter-spacing:.3em;background:transparent;box-shadow:none;color:#e6dcc4}
.rpg-ui .rpg-command:hover:not(:disabled),.rpg-ui .rpg-command:focus-visible{background:linear-gradient(90deg,transparent,rgba(216,185,120,.2) 25%,rgba(216,185,120,.2) 75%,transparent);border-color:transparent;color:#fff2cc;outline:0;box-shadow:none;text-shadow:0 0 10px rgba(243,210,140,.45)}
.rpg-command:hover::before,.rpg-command:focus-visible::before{border:0;width:14px;height:14px;background:${L_CURSOR} center/contain no-repeat;animation:rpg-cursor-x .7s ease-in-out infinite alternate}
.rpg-skill-help,.rpg-action-window{background:${lFrame(L_FILL, 20)};border-color:rgba(216,185,120,.58);box-shadow:inset 0 0 0 3px rgba(5,7,12,.78),inset 0 0 0 4px rgba(216,185,120,.14),0 10px 28px #000b}
.rpg-ui .rpg-skill-heading h3{font-family:var(--rpg-serif);letter-spacing:.14em;color:#f6e3b3}
.rpg-skill-cost{font-family:Georgia,var(--rpg-serif);color:#a9d7c4}
.rpg-skill-description{color:#e2d9c4;scrollbar-width:thin;scrollbar-color:#8a7148 transparent}
.rpg-ui .rpg-skill-unavailable{color:#f0b39c}
.rpg-action-header{font-family:var(--rpg-serif);color:#d9c79e}
.rpg-ui .rpg-action-tabs button[aria-pressed=true]{color:#20170a;text-shadow:none;background:linear-gradient(180deg,#f3dea6,#caa35b);border-color:#f6e4b3}
.rpg-action-list{scrollbar-width:thin;scrollbar-color:#8a7148 transparent}
.rpg-ui .rpg-action{font-family:var(--rpg-serif);letter-spacing:.06em;background:rgba(20,24,38,.35);border-bottom-color:rgba(216,185,120,.12);box-shadow:none;color:#ece2ca}
.rpg-ui .rpg-action:hover,.rpg-ui .rpg-action.is-current{border-color:rgba(243,223,168,.75)!important;background:linear-gradient(90deg,rgba(216,185,120,.24),rgba(216,185,120,.06) 70%,transparent)!important;box-shadow:inset 0 0 0 2px rgba(6,8,13,.7),inset 0 0 0 3px rgba(243,223,168,.16)}
.rpg-action-icon{color:var(--rpg-gold-hi);background:radial-gradient(circle,#262d45,#0a0c14);border-color:rgba(216,185,120,.55);box-shadow:inset 0 0 0 2px rgba(5,7,12,.7)}
.rpg-action-cost{color:#a9d7c4!important;font-family:Georgia,var(--rpg-serif)}
.rpg-ui .rpg-action[aria-disabled=true]{color:#8f8778}
.rpg-action-position{font-family:Georgia,serif;letter-spacing:.1em;color:#a99f89}
.rpg-ui .rpg-summons button{background:rgba(8,10,18,.88)}
.rpg-damage{font-family:Georgia,'Times New Roman',var(--rpg-serif);font-style:italic;color:#fffaf0;text-shadow:-2px -2px 0 #1b1410,2px -2px 0 #1b1410,-2px 2px 0 #1b1410,2px 2px 0 #1b1410,0 0 12px rgba(255,220,150,.55),0 4px 8px #000}
.rpg-damage.heal{color:#b7f0c6}
.rpg-battle.is-flashing::after{background:rgba(190,60,50,.2)}
.rpg-target-arrow{color:#f3dfa8}
@keyframes rpg-cursor-x{from{translate:-3px 0}to{translate:2px 0}}
@keyframes rpg-confirm{from{box-shadow:0 0 0 rgba(122,31,26,0)}to{box-shadow:0 0 12px rgba(122,31,26,.5)}}
@keyframes rpg-fade{from{opacity:0}to{opacity:1}}
@keyframes rpg-warn{from{opacity:.72}to{opacity:1}}
@keyframes rpg-paste{from{opacity:0;transform:rotate(-1.2deg) scale(1.06)}to{opacity:1;transform:rotate(-1.2deg) scale(1)}}
@keyframes rpg-stamp{from{opacity:0;transform:rotate(-14deg) scale(1.7)}to{opacity:.86;transform:rotate(-14deg) scale(1)}}
@keyframes rpg-blot{from{opacity:0;transform:scale(.6)}to{opacity:.13;transform:scale(1)}}
.rpg-window.is-ended[data-outcome=success]::after{transform:rotate(-14deg)}
@container(max-width:760px){.rpg-window.is-menu::after{display:none}.rpg-window{padding:22px 20px 18px}.rpg-window.is-menu{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;grid-template-areas:"header" "tabs" "body" "footer";gap:10px;padding:20px 18px 16px 34px}.is-menu>.rpg-menu-side{display:none}.is-menu>.rpg-menu-tabs{flex-direction:row;flex-wrap:wrap;overflow:visible;padding:0 0 6px;border-bottom:1px solid ${BK.rule}}.rpg-ui .is-menu>.rpg-menu-tabs button{flex:1 0 auto;min-height:40px;padding:5px 10px;border-left:0;border-top:5px solid var(--tab,${BK.ink2});border-radius:0 0 7px 7px;font-size:15px;letter-spacing:.16em;text-align:center}.rpg-ui .is-menu>.rpg-menu-tabs button[aria-pressed=true]{transform:translateY(4px)}.rpg-member-bars{grid-template-columns:minmax(0,1fr)}.rpg-window-sub{display:none}.rpg-title .rpg-window-sub{display:block}.rpg-place-name{font-size:18px}.rpg-tiles{gap:8px}.rpg-tile{padding:20px 6px 10px}.rpg-tile b{font-size:22px}.rpg-menu-footer button{min-width:0;flex:1}.rpg-window.is-event{padding:22px 20px 18px 34px}.rpg-window.is-ended{padding:24px 20px 20px}.rpg-window.is-ended[data-outcome=success]::after{width:62px;height:62px;font-size:15px;left:auto;bottom:auto;right:14px;top:74px}}
@container(max-width:480px){.rpg-member{grid-template-columns:58px minmax(0,1fr);padding:10px;gap:6px 12px}.rpg-member-top h3{font-size:17px}.rpg-member-art span{font-size:28px}.rpg-window-header h2{font-size:20px}.rpg-place{min-width:0;margin-top:10px;padding:6px 16px 9px 12px}.rpg-place-name{font-size:16px}.rpg-place-sub{font-size:12px}.rpg-toast{padding:8px 18px 8px 28px;font-size:14px;letter-spacing:.06em}.rpg-title .rpg-window-header h2{font-size:32px}.rpg-ui .rpg-title .rpg-menu-footer button{min-width:200px}.is-event .rpg-menu-body>p:first-child::first-letter{font-size:34px}.rpg-menu-body[data-tab=relic]>section{padding-left:16px;background:rgba(255,250,236,.7)}.rpg-menu-body[data-tab=relic]>section::before{display:none}}
@container(max-height:520px) and (min-width:761px){.rpg-window.is-menu{grid-template-areas:"header header" "tabs body" "tabs footer"}}
@container(max-height:520px){.rpg-window{padding:16px 22px 14px;gap:10px}.is-menu>.rpg-menu-side{display:none}.rpg-window.is-menu{padding:12px 16px 10px 34px;gap:6px 20px}.rpg-window-header{padding-bottom:8px}.rpg-window-header h2{font-size:20px}.rpg-ui .is-menu>.rpg-menu-tabs button{min-height:34px;padding-top:4px;padding-bottom:4px;font-size:16px}.rpg-member{padding:8px 12px 8px 8px;grid-template-columns:62px minmax(0,1fr)}.rpg-member-top h3{font-size:17px}.rpg-ended-host img{width:56px;height:66px}.rpg-title .rpg-window-header h2{font-size:34px}.rpg-title .rpg-menu-body{padding:2px 0 8px}.rpg-ui .rpg-title .rpg-menu-footer button{min-height:38px}.rpg-window.rpg-title::after{width:50%;margin-bottom:8px}.is-event .rpg-window-header,.is-ended .rpg-window-header{padding-bottom:12px}.rpg-window.is-ended[data-outcome=success]::after{width:56px;height:56px;font-size:14px;left:14px;bottom:10px}}

.rpg-target-arrow{position:absolute;width:clamp(21px,3.7cqh,35px);height:clamp(26px,4.5cqh,42px);display:none;z-index:30;pointer-events:none;color:#ffe095;transform:translate(-50%,-100%);filter:drop-shadow(0 3px 2px #0008);animation:rpg-target-bob .8s ease-in-out infinite alternate}
.rpg-target-arrow svg{width:100%!important;height:100%!important}
.rpg-enemy.is-target>.rpg-target-arrow,.rpg-party-card.is-target>.rpg-target-arrow{display:block}
.rpg-enemy.is-target .rpg-enemy-art,.rpg-party-card.is-target .rpg-party-portrait{animation:rpg-target-pulse 1.5s ease-in-out infinite}
.rpg-party-card.is-target{overflow:visible!important}.rpg-party-card.is-target .rpg-party-info{overflow:hidden}
.rpg-battle.is-targeting .rpg-skill-help{height:auto;max-height:18%;padding-top:10px;padding-bottom:10px}
.rpg-battle.is-targeting .rpg-skill-description,.rpg-battle.is-targeting .rpg-skill-unavailable{display:none}
.rpg-battle.is-targeting .rpg-skill-heading{align-items:center}
.rpg-battle.is-targeting .rpg-skill-heading h3{flex:1}
@keyframes rpg-target-bob{from{translate:0 -3px}to{translate:0 3px}}
@keyframes rpg-target-pulse{0%,100%{opacity:1}50%{opacity:.48}}
${SUPPLIER_STYLE}
@media(prefers-reduced-motion:reduce){.rpg-ui *,.rpg-ui *::before,.rpg-ui *::after,.rpg-stage>canvas{animation-duration:.01ms!important;transition-duration:.01ms!important}}
.rpg-enemy[data-phase="red"] .rpg-enemy-art{filter:sepia(.7) saturate(2.6) hue-rotate(-38deg) brightness(.92) drop-shadow(0 0 14px rgba(255,40,40,.75));animation:rpg-phase-red 1.6s ease-in-out infinite alternate}.rpg-enemy[data-phase="red"] .rpg-enemy-name{color:#ff8a7a}@keyframes rpg-phase-red{from{filter:sepia(.7) saturate(2.6) hue-rotate(-38deg) brightness(.92) drop-shadow(0 0 8px rgba(255,40,40,.55))}to{filter:sepia(.7) saturate(2.6) hue-rotate(-38deg) brightness(1) drop-shadow(0 0 18px rgba(255,40,40,.95))}}.rpg-enemy[data-phase="afterimage"] .rpg-enemy-art{filter:drop-shadow(-9px 0 0 rgba(255,70,70,.55)) drop-shadow(9px 0 0 rgba(70,130,255,.55));animation:rpg-phase-ghost 1.1s steps(2) infinite}@keyframes rpg-phase-ghost{from{filter:drop-shadow(-9px 0 0 rgba(255,70,70,.55)) drop-shadow(9px 0 0 rgba(70,130,255,.55))}to{filter:drop-shadow(-5px 2px 0 rgba(255,70,70,.4)) drop-shadow(5px -2px 0 rgba(70,130,255,.4))}}
`;
