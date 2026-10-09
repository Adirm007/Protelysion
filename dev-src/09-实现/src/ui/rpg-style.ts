import {SUPPLIER_STYLE} from './supplier-style';
import {OCTO_CORNERS as C, OCTO_CURSOR, OCTO_DIAMOND, OCTO_STAR, OCTO_SERIF, OCTO_SANS, OCTO_FILL, OCTO_FILL_SOFT, octoFrame} from './octo-kit';

// 0.37 Octopath-style skin. Battle geometry below is kept verbatim from 0.36; the battle skin block only changes
// colours, borders, shadows and type (the player-tuned battle layout is intentionally untouched).
export const RPG_STYLE = String.raw`
.bs-playing,.bs-shell.bs-playing{max-width:none!important;padding:0!important;border:0!important;border-radius:0!important;background:#111!important;overflow:visible!important}
.bs-playing>.bs-portal{min-height:0!important;box-shadow:none!important;max-width:none!important;padding:0!important;border:0!important;border-radius:0!important}
.bs-playing>.bs-portal>.bs-nav,.bs-playing>.bs-portal>.bs-header,.bs-playing>.bs-portal>.bs-footer,.bs-playing>.bs-portal>#status{display:none!important}
.rpg-stage,.bs-stage.rpg-stage{position:relative;isolation:isolate;container-type:size;width:100%;height:var(--rpg-viewport-height,100dvh);min-height:0;max-height:none;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;overflow:hidden;background:#131317;color:#f7f0df}
.rpg-stage:fullscreen,.rpg-stage.is-fullscreen{position:fixed!important;inset:0!important;width:var(--rpg-viewport-width,100vw)!important;height:var(--rpg-viewport-height,100dvh)!important;min-height:0!important;max-width:none!important;max-height:none!important;z-index:2147483000;border:0!important;border-radius:0!important;padding:0!important;margin:0!important}
.rpg-stage>canvas{position:absolute!important;inset:0;display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;aspect-ratio:auto!important;border:0!important;border-radius:0!important;outline:0;touch-action:none;transition:filter .3s,transform .3s}
.rpg-stage.is-battle>canvas{filter:blur(3px) brightness(.58) saturate(.72)}
.rpg-ui{position:absolute;inset:0;z-index:2;font:16px/1.45 ${OCTO_SANS};pointer-events:none;text-align:left;color:#efe6d0;--rpg-gold:#d8b978;--rpg-gold-hi:#f3dfa8;--rpg-gold-dim:rgba(216,185,120,.34);--rpg-panel:rgba(12,15,25,.94);--rpg-line:rgba(216,185,120,.46);--rpg-ink:#080a12;--rpg-mute:#a89f8c;--rpg-serif:${OCTO_SERIF}}
.rpg-ui *{box-sizing:border-box;min-width:0}
.rpg-ui [hidden]{display:none!important}
.rpg-ui button,.rpg-ui select,.rpg-ui input,.rpg-ui summary{pointer-events:auto;font:inherit}
.rpg-ui button{min-height:40px;margin:0;border:1px solid var(--rpg-line);border-radius:1px;padding:8px 14px;background:linear-gradient(180deg,rgba(26,31,48,.92),rgba(11,13,22,.94));color:#f1e7cf;cursor:pointer;line-height:1.25;letter-spacing:0;font-family:var(--rpg-serif);box-shadow:inset 0 0 0 2px rgba(6,8,13,.75),inset 0 0 0 3px rgba(216,185,120,.1);text-shadow:0 1px 2px #000;transition:background .16s,border-color .16s,color .16s,box-shadow .16s}
.rpg-ui button:hover:not(:disabled){background:linear-gradient(180deg,rgba(74,60,34,.9),rgba(26,22,18,.94));border-color:var(--rpg-gold-hi);color:#fff6dc}
.rpg-ui button:focus-visible,.rpg-ui summary:focus-visible{outline:1px solid var(--rpg-gold-hi);outline-offset:3px;box-shadow:inset 0 0 0 2px rgba(6,8,13,.75),inset 0 0 0 3px rgba(243,223,168,.35),0 0 14px rgba(243,210,140,.28)}
.rpg-ui button:disabled{opacity:.42;cursor:not-allowed}
.rpg-ui button[aria-pressed=true]{border-color:var(--rpg-gold-hi);color:#fff3d2;background:linear-gradient(180deg,rgba(120,94,48,.62),rgba(46,36,22,.85))}
.rpg-ui h2,.rpg-ui h3,.rpg-ui p{margin:0}.rpg-ui h2{font-size:24px}.rpg-ui h3{font-size:18px}.rpg-ui small{font-size:12px;color:#c3baa6}
.rpg-ui h2,.rpg-ui h3{font-family:var(--rpg-serif);font-weight:600}
/* ---- exploration HUD ---- */
.rpg-ui .rpg-hud{position:absolute;inset:14px 16px auto;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;z-index:8}
.rpg-place{position:relative;display:grid;gap:1px;min-width:170px;padding:9px 30px 11px 20px;background:linear-gradient(90deg,rgba(8,10,18,.9),rgba(8,10,18,.72) 70%,transparent);border-left:2px solid var(--rpg-gold);text-shadow:0 2px 6px #000;color:#f3e9d1}
.rpg-place::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,var(--rpg-gold),rgba(216,185,120,.25) 60%,transparent)}
.rpg-place-name{font:600 22px/1.25 var(--rpg-serif);letter-spacing:.16em;color:#f6e7bf}
.rpg-place-sub{font:13px/1.4 var(--rpg-serif);letter-spacing:.14em;color:#c9bea4}
.rpg-ui .rpg-menu-button{margin-left:auto;width:46px;height:46px;min-height:46px;padding:11px;border-radius:50%;background:radial-gradient(circle at 50% 35%,rgba(40,46,70,.92),rgba(8,10,18,.94));border-color:var(--rpg-gold-dim);box-shadow:inset 0 0 0 3px rgba(6,8,13,.8),inset 0 0 0 4px rgba(216,185,120,.22),0 4px 12px #0008;color:var(--rpg-gold-hi)}
.rpg-menu-button svg{display:block;width:100%!important;height:100%!important;pointer-events:none}
.rpg-ui .rpg-fullscreen{position:absolute;top:70px;right:16px;z-index:45;width:46px;height:46px;min-height:46px;padding:11px;border-radius:50%;background:radial-gradient(circle at 50% 35%,rgba(40,46,70,.92),rgba(8,10,18,.94));border-color:var(--rpg-gold-dim);box-shadow:inset 0 0 0 3px rgba(6,8,13,.8),inset 0 0 0 4px rgba(216,185,120,.22),0 4px 12px #0008;color:var(--rpg-gold-hi);pointer-events:auto}
.rpg-ui .rpg-window .rpg-fullscreen-inline{margin-left:auto;align-self:center;flex:none;width:38px;height:38px;min-height:38px;padding:8px;border-radius:50%;color:var(--rpg-gold-hi)}
.rpg-ui .rpg-window .rpg-fullscreen-inline:not([hidden])+.rpg-back{margin-left:8px}
.rpg-fullscreen svg,.rpg-fullscreen-inline svg{display:block;width:100%;height:100%;pointer-events:none}
.rpg-toast{position:absolute;left:50%;top:78px;transform:translateX(-50%);max-width:80%;min-width:min(420px,80%);padding:10px 60px;background:linear-gradient(90deg,transparent,rgba(8,10,18,.9) 22%,rgba(8,10,18,.9) 78%,transparent);font:16px/1.5 var(--rpg-serif);letter-spacing:.18em;text-align:center;color:#f4e8cc;text-shadow:0 1px 3px #000;animation:rpg-appear .25s}
.rpg-nearby{position:absolute;left:50%;top:62%;transform:translateX(-50%);padding:7px 34px;background:linear-gradient(90deg,transparent,rgba(8,10,18,.86) 24%,rgba(8,10,18,.86) 76%,transparent);border-top:1px solid rgba(214,184,120,.55);border-bottom:1px solid rgba(214,184,120,.55);font:15px/1.5 var(--rpg-serif);letter-spacing:.24em;white-space:nowrap;color:#f4e8cc;text-shadow:0 1px 3px #000;pointer-events:none;animation:rpg-appear .2s}
.rpg-toast::before,.rpg-toast::after{content:'';position:absolute;left:8%;right:8%;height:1px;background:linear-gradient(90deg,transparent,var(--rpg-gold) 30%,var(--rpg-gold) 70%,transparent)}.rpg-toast::before{top:0}.rpg-toast::after{bottom:0}
.rpg-explore-actions{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));right:max(18px,env(safe-area-inset-right));display:flex;align-items:center;gap:12px}
.rpg-help{display:flex;align-items:center;gap:7px;padding:7px 14px 7px 12px;font:13px/1 var(--rpg-serif);letter-spacing:.1em;color:#e6dcc4;text-shadow:0 1px 3px #000;background:linear-gradient(90deg,transparent,rgba(8,10,18,.8) 18%);border-bottom:1px solid var(--rpg-gold-dim)}
.rpg-help kbd{display:inline-grid;place-items:center;min-width:24px;height:22px;padding:0 6px;margin-left:6px;font:600 11px/1 Georgia,serif;letter-spacing:.04em;color:var(--rpg-gold-hi);background:linear-gradient(180deg,#232a40,#0b0d16);border:1px solid var(--rpg-gold-dim);border-radius:3px;box-shadow:0 2px 0 #000}
.rpg-help kbd:first-child{margin-left:0}
/* Native-feeling touch controls; no text selection, callout, or per-frame canvas. */
.rpg-joystick{display:none;position:absolute;width:116px;height:116px;left:max(14px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;z-index:9}
.rpg-stick-ring{width:100%!important;height:100%!important;fill:rgba(8,10,18,.5);stroke:rgba(216,185,120,.62);stroke-width:1.4;pointer-events:none}.rpg-stick-ring path{fill:none;stroke-width:3;stroke:#f3dfa8}
.rpg-stick-thumb{position:absolute;width:42px;height:42px;left:37px;top:37px;border:1px solid rgba(243,223,168,.8);border-radius:50%;background:radial-gradient(circle at 38% 30%,#f3dfa8aa,#6d5630cc 45%,#141722ee);box-shadow:0 3px 12px #0008,inset 0 0 0 3px rgba(8,10,18,.6);pointer-events:none;will-change:transform}
.rpg-joystick.is-active .rpg-stick-ring{stroke:#f3dfa8}
.rpg-ui button,.rpg-target-arrow{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
.rpg-ui .rpg-interact{width:58px;min-width:58px;height:58px;padding:14px;border-radius:50%;touch-action:none;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,rgba(48,54,80,.95),rgba(8,10,18,.95));border-color:var(--rpg-gold);box-shadow:inset 0 0 0 3px rgba(6,8,13,.8),inset 0 0 0 4px rgba(216,185,120,.3),0 4px 14px #0009;color:var(--rpg-gold-hi)}.rpg-interact svg{width:100%!important;height:100%!important;pointer-events:none}
/* ---- menus: title, journal, event, settlement ---- */
.rpg-menu-shade{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,rgba(14,18,32,.62),rgba(4,5,10,.9));backdrop-filter:blur(7px) saturate(.75);display:grid;place-items:center;padding:clamp(10px,2.6cqh,24px);pointer-events:auto;z-index:12}
.rpg-window{position:relative;width:min(820px,100%);max-height:100%;display:flex;flex-direction:column;gap:16px;padding:30px 34px 26px;background:${octoFrame(OCTO_FILL, 26)};border:1px solid rgba(216,185,120,.58);box-shadow:0 0 0 1px #04050a,inset 0 0 0 3px rgba(4,6,10,.7),inset 0 0 0 4px rgba(216,185,120,.14),0 26px 80px #000c;overflow:hidden;color:#efe6d0}
.rpg-window-header{position:relative;display:flex;align-items:flex-end;gap:16px;padding-bottom:14px;flex-shrink:0}
.rpg-window-header::after{content:'';position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(90deg,transparent,rgba(216,185,120,.75) 18%,rgba(216,185,120,.2) 46%,transparent 49%,transparent 51%,rgba(216,185,120,.2) 54%,rgba(216,185,120,.75) 82%,transparent) center/100% 1px no-repeat,${OCTO_DIAMOND} center/12px 12px no-repeat}
.rpg-window-header h2{font:600 26px/1.3 var(--rpg-serif);letter-spacing:.24em;background:linear-gradient(180deg,#fff4d4,#e2c283 60%,#b18f4f);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 2px #000)}
.rpg-window-sub{flex:1;padding-bottom:4px;font:14px/1.4 var(--rpg-serif);letter-spacing:.14em;color:#b9ae96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rpg-ui .rpg-window .rpg-back{margin-left:auto;align-self:center;width:38px;height:38px;min-height:38px;padding:0;border-radius:50%;font:20px/1 Georgia,serif;color:var(--rpg-gold-hi)}
.rpg-menu-tabs{display:flex;flex-wrap:wrap;gap:6px}
.rpg-menu-body{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#8a7148 transparent;display:grid;align-content:start;gap:12px;font-size:14px;padding-right:4px}
.rpg-menu-body>p{font:15px/1.8 var(--rpg-serif);color:#d8cfbb;letter-spacing:.06em;white-space:pre-line}
.rpg-menu-body details{border-top:1px solid rgba(216,185,120,.14);padding:8px 0 2px;pointer-events:auto}
.rpg-menu-body summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;font:15px/1.5 var(--rpg-serif);letter-spacing:.08em;color:#ecd9ae}
.rpg-menu-body summary::-webkit-details-marker{display:none}
.rpg-menu-body summary::before{content:'';width:9px;height:9px;flex:none;background:${OCTO_DIAMOND} center/contain no-repeat;transition:transform .15s}
.rpg-menu-body details[open]>summary::before{transform:rotate(45deg)}
.rpg-menu-body details>p{padding:6px 0 4px 17px}
.rpg-menu-body p{color:#c8bfac;line-height:1.75;white-space:pre-line;overflow-wrap:anywhere}
.rpg-menu-body section{position:relative;display:grid;gap:7px;padding:13px 16px 14px;background:linear-gradient(90deg,rgba(216,185,120,.06),rgba(255,255,255,.012) 60%);border:1px solid rgba(216,185,120,.16);border-left:2px solid rgba(216,185,120,.5)}
.rpg-menu-body section>h3{display:flex;align-items:center;gap:10px;font:600 17px/1.4 var(--rpg-serif);letter-spacing:.1em;color:#f1e1b8}
.rpg-menu-body button{font-size:14px;min-height:36px;padding:7px 14px}
.rpg-menu-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.rpg-menu-actions{display:flex;gap:6px;flex-wrap:wrap}
.rpg-menu-empty{padding:34px 0;text-align:center;font-family:var(--rpg-serif);letter-spacing:.2em;color:#8f8674!important}
.rpg-choice{width:100%;text-align:left;white-space:normal;min-height:48px!important}
.rpg-menu-footer{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;flex-shrink:0}
.rpg-menu-footer button{min-width:128px;letter-spacing:.2em}
.rpg-ui .rpg-menu-footer .is-primary{border-color:var(--rpg-gold-hi);color:#20170a;text-shadow:none;background:linear-gradient(180deg,#f6e2ad,#d3ae66 55%,#a9853f);box-shadow:inset 0 0 0 1px rgba(255,248,220,.6),0 0 16px rgba(230,195,120,.25)}
.rpg-ui .rpg-menu-footer .is-primary:hover:not(:disabled){background:linear-gradient(180deg,#fff0c4,#e2bd74 55%,#b99449);color:#1a1207}
.rpg-ui .rpg-menu-footer .is-danger{color:#f0b7a4;border-color:rgba(214,120,96,.55)}
.rpg-ui .rpg-menu-footer .is-danger:hover:not(:disabled){background:linear-gradient(180deg,rgba(110,40,30,.85),rgba(40,14,12,.95));border-color:#e59b82;color:#ffe2d6}
.rpg-ui button[data-confirm=yes]{border-color:#e59b82!important;color:#ffd9c9!important;animation:rpg-confirm .8s ease-in-out infinite alternate}
.rpg-menu-side{display:none}
.rpg-audio{position:relative;pointer-events:auto}.rpg-audio>details[data-booksea-audio]{position:relative!important;inset:auto!important;max-width:none!important;width:100%;border:0!important;box-shadow:none!important;background:transparent!important}.rpg-audio>details>summary{display:none}.rpg-audio>details>div{width:100%!important;max-width:none!important;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px!important;padding:0!important}.rpg-audio small{display:none}
/* Journal (pause menu): Octopath-style two-pane book with a vertical command list. */
.rpg-window.is-menu{width:min(1180px,100%);height:min(700px,100%);display:grid;grid-template-columns:clamp(180px,20%,240px) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"header header" "tabs body" "side footer";gap:16px 28px;padding:30px 36px 24px}
.is-menu>.rpg-window-header{grid-area:header}.is-menu>.rpg-menu-body{grid-area:body}.is-menu>.rpg-menu-footer{grid-area:footer;align-self:end}.is-menu>.rpg-audio{grid-area:body}
.is-menu>.rpg-menu-tabs{grid-area:tabs;flex-direction:column;flex-wrap:nowrap;gap:3px;align-self:stretch;padding:4px 18px 0 0;border-right:1px solid transparent;border-image:linear-gradient(180deg,transparent,rgba(216,185,120,.4) 12%,rgba(216,185,120,.4) 88%,transparent) 1}
.rpg-ui .is-menu>.rpg-menu-tabs button{position:relative;min-height:44px;padding:9px 12px 9px 36px;text-align:left;font:600 18px/1.3 var(--rpg-serif);letter-spacing:.34em;color:#a99f8a;background:none;border:0;border-radius:0;box-shadow:none}
.rpg-ui .is-menu>.rpg-menu-tabs button::before{content:'';position:absolute;left:10px;top:50%;width:16px;height:16px;transform:translateY(-50%);background:${OCTO_CURSOR} center/contain no-repeat;opacity:0;transition:opacity .15s,left .15s}
.rpg-ui .is-menu>.rpg-menu-tabs button:hover:not(:disabled){color:#eadbb6;background:linear-gradient(90deg,rgba(216,185,120,.1),transparent)}
.rpg-ui .is-menu>.rpg-menu-tabs button[aria-pressed=true]{color:#fff1c9;background:linear-gradient(90deg,rgba(216,185,120,.24),rgba(216,185,120,.05) 70%,transparent);text-shadow:0 0 10px rgba(243,210,140,.35)}
.rpg-ui .is-menu>.rpg-menu-tabs button[aria-pressed=true]::before,.rpg-ui .is-menu>.rpg-menu-tabs button:focus-visible::before{opacity:1;animation:rpg-cursor-x .7s ease-in-out infinite alternate}
.is-menu>.rpg-menu-side{grid-area:side;display:grid;gap:4px;align-self:end;padding:12px 4px 2px 0;font:13px/1.6 var(--rpg-serif);letter-spacing:.08em;color:#b3a992}
.rpg-menu-side>div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(216,185,120,.12);padding-bottom:3px}
.rpg-menu-side b{font:600 15px/1.5 Georgia,var(--rpg-serif);color:#f0dca8;font-variant-numeric:tabular-nums}
.rpg-menu-side>div:last-child b{color:#f5d27e}
/* Party members */
.rpg-member{position:relative;display:grid;grid-template-columns:clamp(72px,9cqw,100px) minmax(0,1fr);gap:8px 18px;align-items:start;padding:14px 18px 14px 14px;background:linear-gradient(90deg,rgba(216,185,120,.07),rgba(255,255,255,.012) 55%);border:1px solid rgba(216,185,120,.18);border-left:2px solid rgba(216,185,120,.55)}
.rpg-member.is-away{opacity:.6;filter:grayscale(.6)}
.rpg-member-art{position:relative;grid-row:span 2;aspect-ratio:1;overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,#2d3450,#0b0d17);border:1px solid rgba(216,185,120,.7);box-shadow:inset 0 0 0 3px rgba(6,8,13,.8),inset 0 0 0 4px rgba(216,185,120,.25)}
.rpg-member-art img{position:absolute;inset:4px;width:calc(100% - 8px);height:calc(100% - 8px);object-fit:cover;object-position:center 22%}
.rpg-member-art span{font:600 40px/1 var(--rpg-serif);color:#d9bf8a;text-shadow:0 0 16px rgba(216,185,120,.35)}
.rpg-member-top{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.rpg-member-top h3{font:600 21px/1.3 var(--rpg-serif);letter-spacing:.14em;color:#f6e6bd}
.rpg-member-meta{font:13px/1.4 var(--rpg-serif);letter-spacing:.1em;color:#a99f89}
.rpg-member-tag{margin-left:auto;padding:1px 10px;font:12px/1.6 var(--rpg-serif);letter-spacing:.14em;color:#f0b6a3;border:1px solid rgba(214,120,96,.5);background:rgba(90,30,24,.35)}
.rpg-member-bars{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 20px}
.rpg-meter{display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:0 8px;font:11px/1.3 Georgia,serif;letter-spacing:.08em;color:#bdb39c}
.rpg-meter b{justify-self:end;font:600 15px/1.3 Georgia,var(--rpg-serif);color:#f3e8cf;font-variant-numeric:tabular-nums}
.rpg-meter b small{font-size:11px;color:#9d937e;font-weight:400}
.rpg-meter i{grid-column:1/-1;height:5px;margin-top:3px;background:#070910;border:1px solid rgba(216,185,120,.28);overflow:hidden}
.rpg-meter i em{display:block;height:100%;background:linear-gradient(90deg,#4f9d74,#a9e2a9);box-shadow:0 0 6px rgba(169,226,169,.35)}
.rpg-meter.mp i em{background:linear-gradient(90deg,#4f73c6,#a4c3f5)}.rpg-meter.sp i em{background:linear-gradient(90deg,#b98534,#f1d185)}
.rpg-meter.is-low b{color:#f19c86}.rpg-meter.is-low i em{background:linear-gradient(90deg,#a8412f,#f08a6c)}
.rpg-member-actions{grid-column:2;display:flex;flex-wrap:wrap;gap:6px}
.rpg-member-actions>details{border:1px solid rgba(216,185,120,.22);padding:3px 12px 3px 9px;background:rgba(8,10,18,.5)}
.rpg-member-actions>details[open]{flex-basis:100%;padding:6px 12px 10px}
.rpg-member-actions summary{font-size:14px}
.rpg-member-actions>.rpg-menu-actions,.rpg-member-actions>button{flex-basis:auto}
.rpg-member-actions:empty{display:none}
/* Bag tiles */
.rpg-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.rpg-tile{display:grid;gap:2px;padding:14px 18px;text-align:center;background:linear-gradient(180deg,rgba(216,185,120,.08),rgba(255,255,255,.01));border:1px solid rgba(216,185,120,.22)}
.rpg-tile span{font:13px/1.4 var(--rpg-serif);letter-spacing:.2em;color:#a99f89}
.rpg-tile b{font:600 30px/1.2 Georgia,var(--rpg-serif);color:#f3dfa8;font-variant-numeric:tabular-nums;text-shadow:0 0 12px rgba(243,210,140,.2)}
.rpg-tag{display:inline-block;padding:0 8px;font:12px/1.7 var(--rpg-serif);letter-spacing:.12em;color:#e5cf99;border:1px solid rgba(216,185,120,.4);background:rgba(216,185,120,.08)}
/* Event */
.rpg-window.is-event{width:min(780px,100%)}
.is-event .rpg-menu-body>p{font-size:16px;line-height:1.95;color:#e2d9c3;padding:2px 2px 6px}
.rpg-owner-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.rpg-owner-row>span{margin-right:6px;font:13px/1 var(--rpg-serif);letter-spacing:.24em;color:#a99f89}
.rpg-ui .rpg-owner-row button{min-height:34px;padding:5px 14px;font-size:14px;letter-spacing:.12em}
.rpg-ui .rpg-choice{position:relative;padding:12px 20px 12px 42px;font:600 17px/1.4 var(--rpg-serif);letter-spacing:.1em;background:linear-gradient(90deg,rgba(26,31,48,.9),rgba(11,13,22,.85));border-color:rgba(216,185,120,.3)}
.rpg-ui .rpg-choice::before{content:'';position:absolute;left:14px;top:15px;width:16px;height:16px;background:${OCTO_CURSOR} center/contain no-repeat;opacity:.18;transition:opacity .15s}
.rpg-ui .rpg-choice:hover:not(:disabled)::before,.rpg-ui .rpg-choice:focus-visible::before{opacity:1}
.rpg-ui .rpg-choice:hover:not(:disabled){background:linear-gradient(90deg,rgba(96,76,40,.75),rgba(20,18,20,.9))}
.rpg-event-description{color:#b8ae98;font-family:${OCTO_SANS};letter-spacing:.02em}
/* Settlement */
.rpg-window.is-ended{width:min(860px,100%)}
.rpg-ended-host{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:18px;padding:4px 0 6px}
.rpg-ended-host img{width:84px;height:84px;border-radius:0;object-fit:cover;border:1px solid var(--rpg-gold);box-shadow:0 0 0 3px #0a0c14,0 0 0 4px rgba(216,185,120,.35),0 6px 18px #000a}
.rpg-ended-host p{font:16px/1.8 var(--rpg-serif)!important;letter-spacing:.1em;color:#e8dcc0!important}
.rpg-ended-host p small{display:block;font-size:12px;letter-spacing:.3em;color:#9e947f}
.rpg-ledger{display:grid;gap:0;padding:6px 16px;background:rgba(255,255,255,.015);border:1px solid rgba(216,185,120,.16)}
.rpg-ledger>h3{padding:8px 0 6px;font:600 14px/1.4 var(--rpg-serif)!important;letter-spacing:.3em;color:#bfae86!important}
.rpg-ledger-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:8px 2px;border-top:1px solid rgba(216,185,120,.12);font:15px/1.5 var(--rpg-serif);letter-spacing:.08em;color:#e9dfc8}
.rpg-ledger-row b{font:600 16px/1.5 Georgia,var(--rpg-serif);color:#f3d58c;font-variant-numeric:tabular-nums}
.rpg-ledger-row small{flex-basis:100%;font:12px/1.6 ${OCTO_SANS}!important;color:#9f9683!important;margin-top:-2px}
.rpg-ledger-row{flex-wrap:wrap}
/* Title */
.rpg-menu-shade.is-title{place-items:center start;padding:0 0 0 clamp(20px,7cqw,120px);background:linear-gradient(90deg,rgba(4,6,12,.9) 0%,rgba(4,6,12,.62) 34%,rgba(4,6,12,.08) 62%,transparent),linear-gradient(0deg,rgba(4,6,12,.7),transparent 30%),var(--rpg-title-art,#0b0e18) center right/cover no-repeat;backdrop-filter:none}
.rpg-menu-shade.is-title::after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(1.5px 1.5px at 18% 30%,#f3dfa8,transparent),radial-gradient(1px 1px at 32% 62%,#f3dfa8cc,transparent),radial-gradient(1.5px 1.5px at 42% 18%,#fff2cc,transparent),radial-gradient(1px 1px at 12% 76%,#f3dfa8,transparent),radial-gradient(2px 2px at 27% 44%,#f6e2ae99,transparent);animation:rpg-motes 9s ease-in-out infinite alternate}
.rpg-window.rpg-title{width:min(560px,92%);padding:0;gap:0;background:none;border:0;box-shadow:none;overflow:visible;text-align:center;align-items:center}
.rpg-title .rpg-window-header{flex-direction:column;align-items:center;gap:6px;padding-bottom:22px}
.rpg-title .rpg-window-header::after{left:12%;right:12%}
.rpg-title .rpg-window-header h2{font:600 clamp(40px,8.6cqh,66px)/1.2 var(--rpg-serif);letter-spacing:.2em;padding-left:.2em;filter:drop-shadow(0 3px 3px #000) drop-shadow(0 0 22px rgba(230,190,110,.25))}
.rpg-title .rpg-window-sub{flex:none;padding:0 0 0 .7em;font:500 clamp(12px,2cqh,15px)/1.6 Georgia,serif;letter-spacing:.7em;color:#cdb988}
.rpg-title .rpg-menu-body{overflow:visible;padding:18px 0 26px}
.rpg-title .rpg-menu-body>p{font:clamp(14px,2.3cqh,17px)/1.8 var(--rpg-serif);letter-spacing:.34em;color:#d9cdb2;text-shadow:0 2px 6px #000}
.rpg-title .rpg-menu-footer{flex-direction:column;align-items:center;gap:6px}
.rpg-ui .rpg-title .rpg-menu-footer button{position:relative;min-width:250px;min-height:48px;padding:10px 40px;font:600 clamp(17px,3cqh,21px)/1.3 var(--rpg-serif);letter-spacing:.42em;color:#dcd0b4;background:none;border:0;box-shadow:none;border-radius:0}
.rpg-ui .rpg-title .rpg-menu-footer button::before{content:'';position:absolute;left:10px;top:50%;width:18px;height:18px;transform:translateY(-50%);background:${OCTO_CURSOR} center/contain no-repeat;opacity:0;transition:opacity .15s}
.rpg-ui .rpg-title .rpg-menu-footer button:hover:not(:disabled),.rpg-ui .rpg-title .rpg-menu-footer button:focus-visible{color:#fff3cf;background:linear-gradient(90deg,transparent,rgba(216,185,120,.22) 30%,rgba(216,185,120,.22) 70%,transparent);text-shadow:0 0 12px rgba(243,210,140,.5);outline:0}
.rpg-ui .rpg-title .rpg-menu-footer button:hover::before,.rpg-ui .rpg-title .rpg-menu-footer button:focus-visible::before{opacity:1;animation:rpg-cursor-x .7s ease-in-out infinite alternate}
.rpg-title-mark{margin-top:26px;font:11px/1 Georgia,serif;letter-spacing:.5em;color:#8b8069}
/* "?" warning: no portrait, no speaker. */
.rpg-warning{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 50%,rgba(40,6,8,.35),rgba(0,0,0,.72));z-index:40;pointer-events:auto;animation:rpg-fade .3s}
.rpg-warning-box{position:relative;min-width:min(380px,86%);padding:30px 44px 24px;text-align:center;background:${octoFrame('linear-gradient(180deg,rgba(34,14,18,.95),rgba(10,8,12,.97))', 22)};border:1px solid rgba(214,120,96,.6);box-shadow:0 0 0 1px #05030a,inset 0 0 0 3px rgba(4,3,6,.7),inset 0 0 0 4px rgba(214,120,96,.18),0 0 60px rgba(160,30,30,.3),0 20px 60px #000c}
.rpg-warning-text{font:600 22px/1.6 var(--rpg-serif);letter-spacing:.3em;color:#f4d6c8;text-shadow:0 0 14px rgba(240,90,70,.45);animation:rpg-warn 1.6s ease-in-out infinite alternate}
.rpg-ui .rpg-warning-button{margin-top:18px;min-width:120px;letter-spacing:.3em;border-color:rgba(214,120,96,.55)}
.rpg-exit-ask{background:radial-gradient(ellipse at 50% 50%,rgba(8,10,20,.3),rgba(0,0,0,.62))}
.rpg-exit-ask .rpg-warning-box{background:${octoFrame(OCTO_FILL, 22)};border-color:rgba(216,185,120,.58);box-shadow:0 0 0 1px #04050a,inset 0 0 0 3px rgba(4,6,10,.7),inset 0 0 0 4px rgba(216,185,120,.14),0 20px 60px #000c}
.rpg-exit-ask .rpg-warning-text{color:#f1e1b8;text-shadow:0 0 12px rgba(230,195,120,.3);animation:none}
.rpg-exit-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
.rpg-ui .rpg-exit-ask .rpg-warning-button{border-color:var(--rpg-gold-dim)}
.rpg-ui .rpg-exit-ask .rpg-warning-button.is-primary{border-color:var(--rpg-gold-hi);color:#20170a;text-shadow:none;background:linear-gradient(180deg,#f6e2ad,#d3ae66 55%,#a9853f)}
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
.rpg-ui .rpg-commands{background:${octoFrame(OCTO_FILL, 18)};border-color:rgba(216,185,120,.6);box-shadow:inset 0 0 0 3px rgba(5,7,12,.8),inset 0 0 0 4px rgba(216,185,120,.14),0 8px 22px #000a}
.rpg-command-owner{font-family:var(--rpg-serif);letter-spacing:.14em;color:#cdb688}
.rpg-ui .rpg-command{font-family:var(--rpg-serif);letter-spacing:.3em;background:transparent;box-shadow:none;color:#e6dcc4}
.rpg-ui .rpg-command:hover:not(:disabled),.rpg-ui .rpg-command:focus-visible{background:linear-gradient(90deg,transparent,rgba(216,185,120,.2) 25%,rgba(216,185,120,.2) 75%,transparent);border-color:transparent;color:#fff2cc;outline:0;box-shadow:none;text-shadow:0 0 10px rgba(243,210,140,.45)}
.rpg-command:hover::before,.rpg-command:focus-visible::before{border:0;width:14px;height:14px;background:${OCTO_CURSOR} center/contain no-repeat;animation:rpg-cursor-x .7s ease-in-out infinite alternate}
.rpg-skill-help,.rpg-action-window{background:${octoFrame(OCTO_FILL, 20)};border-color:rgba(216,185,120,.58);box-shadow:inset 0 0 0 3px rgba(5,7,12,.78),inset 0 0 0 4px rgba(216,185,120,.14),0 10px 28px #000b}
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
@keyframes rpg-confirm{from{box-shadow:0 0 0 rgba(229,155,130,0)}to{box-shadow:0 0 14px rgba(229,155,130,.45)}}
@keyframes rpg-motes{from{opacity:.55;translate:0 4px}to{opacity:1;translate:0 -6px}}
@keyframes rpg-fade{from{opacity:0}to{opacity:1}}
@keyframes rpg-warn{from{opacity:.75}to{opacity:1}}
@container(max-width:760px){.rpg-window{padding:22px 20px 18px}.rpg-window.is-menu{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;grid-template-areas:"header" "tabs" "body" "footer";gap:10px;padding:20px 18px 16px}.is-menu>.rpg-menu-side{display:none}.is-menu>.rpg-menu-tabs{flex-direction:row;flex-wrap:wrap;overflow:visible;padding:0 0 4px;border-right:0;border-bottom:1px solid rgba(216,185,120,.25);border-image:none}.rpg-ui .is-menu>.rpg-menu-tabs button{flex:1 0 auto;min-height:38px;padding:6px 10px 6px 26px;font-size:15px;letter-spacing:.16em}.rpg-ui .is-menu>.rpg-menu-tabs button::before{left:6px;width:13px;height:13px}.rpg-member-bars{grid-template-columns:minmax(0,1fr)}.rpg-window-sub{display:none}.rpg-title .rpg-window-sub{display:block}.rpg-menu-shade.is-title{place-items:end center;padding:0 0 8cqh;background:linear-gradient(0deg,rgba(4,6,12,.94) 0%,rgba(4,6,12,.6) 45%,transparent 75%),var(--rpg-title-art,#0b0e18) 72% center/cover no-repeat}.rpg-place-name{font-size:18px}.rpg-tiles{gap:6px}.rpg-tile{padding:10px 6px}.rpg-tile b{font-size:22px}.rpg-menu-footer button{min-width:0;flex:1}}
@container(max-width:480px){.rpg-member{grid-template-columns:58px minmax(0,1fr);padding:10px;gap:6px 12px}.rpg-member-top h3{font-size:17px}.rpg-member-art span{font-size:28px}.rpg-window-header h2{font-size:20px}.rpg-place{min-width:0;padding:6px 18px 8px 12px}.rpg-place-name{font-size:16px}.rpg-place-sub{font-size:11px}.rpg-toast{padding:8px 30px;font-size:14px;letter-spacing:.08em}.rpg-title .rpg-window-header h2{font-size:34px}.rpg-ui .rpg-title .rpg-menu-footer button{min-width:200px}}
@container(max-height:520px) and (min-width:761px){.rpg-window.is-menu{grid-template-areas:"header header" "tabs body" "tabs footer"}}
@container(max-height:520px){.rpg-window{padding:16px 22px 14px;gap:10px}.is-menu>.rpg-menu-side{display:none}.rpg-window.is-menu{padding:12px 16px 10px;gap:6px 20px}.rpg-window-header{padding-bottom:10px}.rpg-window-header h2{font-size:20px}.rpg-ui .is-menu>.rpg-menu-tabs button{min-height:34px;padding-top:5px;padding-bottom:5px;font-size:16px}.rpg-member{padding:8px 12px 8px 8px;grid-template-columns:62px minmax(0,1fr)}.rpg-member-top h3{font-size:17px}.rpg-ended-host img{width:60px;height:60px}.rpg-title .rpg-window-header h2{font-size:38px}.rpg-title .rpg-menu-body{padding:10px 0 14px}.rpg-ui .rpg-title .rpg-menu-footer button{min-height:38px}}

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
@media(prefers-reduced-motion:reduce){.rpg-ui *,.rpg-stage>canvas{animation-duration:.01ms!important;transition-duration:.01ms!important}}
.rpg-enemy[data-phase="red"] .rpg-enemy-art{filter:sepia(.7) saturate(2.6) hue-rotate(-38deg) brightness(.92) drop-shadow(0 0 14px rgba(255,40,40,.75));animation:rpg-phase-red 1.6s ease-in-out infinite alternate}.rpg-enemy[data-phase="red"] .rpg-enemy-name{color:#ff8a7a}@keyframes rpg-phase-red{from{filter:sepia(.7) saturate(2.6) hue-rotate(-38deg) brightness(.92) drop-shadow(0 0 8px rgba(255,40,40,.55))}to{filter:sepia(.7) saturate(2.6) hue-rotate(-38deg) brightness(1) drop-shadow(0 0 18px rgba(255,40,40,.95))}}.rpg-enemy[data-phase="afterimage"] .rpg-enemy-art{filter:drop-shadow(-9px 0 0 rgba(255,70,70,.55)) drop-shadow(9px 0 0 rgba(70,130,255,.55));animation:rpg-phase-ghost 1.1s steps(2) infinite}@keyframes rpg-phase-ghost{from{filter:drop-shadow(-9px 0 0 rgba(255,70,70,.55)) drop-shadow(9px 0 0 rgba(70,130,255,.55))}to{filter:drop-shadow(-5px 2px 0 rgba(255,70,70,.4)) drop-shadow(5px -2px 0 rgba(70,130,255,.4))}}
`;
