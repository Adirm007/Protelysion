export const SUPPLIER_STYLE = `
.rpg-supplier{position:absolute;inset:0;z-index:40;pointer-events:auto;isolation:isolate;overflow:hidden;background:linear-gradient(90deg,#08090d72,#08090d18 58%,#08090d3b);color:#eee9e0;font-family:"Noto Serif SC","Songti SC","SimSun",serif}
.rpg-supplier-portrait{position:absolute!important;z-index:0;right:0;bottom:0;width:49%!important;height:99%!important;max-width:none!important;max-height:none!important;object-fit:contain;object-position:right bottom;pointer-events:none;filter:drop-shadow(-10px 7px 14px #0006)}
.rpg-supplier-choices{position:absolute;z-index:2;left:50%;top:43%;transform:translate(-50%,-50%);display:grid;gap:14px;width:clamp(170px,27cqw,360px)}
.rpg-ui .rpg-supplier-choice{position:relative;width:100%;min-height:54px;padding:9px 22px;border:1px solid #ded8caaa;border-radius:0;color:#eee9e0;background:#14131ad9;box-shadow:inset 0 0 0 4px #17161d,inset 0 0 0 5px #99929b77,0 6px 16px #0005;font:inherit;font-size:clamp(19px,2.5cqw,28px);line-height:1.3;letter-spacing:.25em;text-align:center;text-shadow:0 2px 3px #000;transition:background .15s,color .15s}
.rpg-ui .rpg-supplier-choice:hover,.rpg-ui .rpg-supplier-choice:focus-visible{background:#39333bea;color:#fff8e3;border-color:#fff0cd;outline:2px solid #cdbf9b;outline-offset:3px}
.rpg-supplier-choice:focus-visible:before{content:"▸";position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:.7em}
.rpg-supplier-dialogue{position:absolute;z-index:1;left:2.2%;right:2.2%;bottom:2.8%;height:25%;min-height:90px;padding:24px 30px;border:1px solid #e0dacecc;background:#101015dd;box-shadow:inset 0 0 0 4px #1b1921,inset 0 0 0 5px #d0c8c188,0 0 0 3px #b0a7a544,0 7px 25px #0006}
.rpg-ui .rpg-supplier-name{position:absolute;left:-1px;bottom:calc(100% + 8px);margin:0;min-width:152px;padding:8px 22px;border:1px solid #e0dacecc;background:#141219ef;box-shadow:inset 0 0 0 4px #1b1921,inset 0 0 0 5px #d0c8c188;font:inherit;font-size:clamp(20px,2.6cqw,30px);font-weight:500;text-align:center;letter-spacing:.1em;line-height:1.4}
.rpg-ui .rpg-supplier-question{margin:0;padding:0;color:inherit;font:inherit;font-size:clamp(23px,3.1cqw,36px);line-height:1.65;text-align:left;letter-spacing:.08em;text-shadow:0 2px 2px #000}
.rpg-supplier-hint{position:absolute;right:20px;bottom:13px;font:12px/1.5 system-ui,sans-serif;letter-spacing:.05em;color:#b4aeba}
.rpg-supplier-corner{position:absolute;width:7px;height:7px;border:1px solid #e2d8c9aa;box-shadow:0 0 0 2px #111018;background:#49414d}
.rpg-supplier-corner.corner-0{left:8px;top:8px}.rpg-supplier-corner.corner-1{right:8px;top:8px}.rpg-supplier-corner.corner-2{left:8px;bottom:8px}.rpg-supplier-corner.corner-3{right:8px;bottom:8px}
.rpg-ui .rpg-supplier-close{position:absolute;left:2.2%;top:2.8%;z-index:3;width:42px;height:42px;min-height:42px;padding:0;border:1px solid #d2cbd66e;border-radius:0;color:#ddd3ce;background:#101015a3;font:26px/1 system-ui;opacity:.8}
.rpg-ui .rpg-supplier-close:hover,.rpg-ui .rpg-supplier-close:focus-visible{opacity:1;outline:2px solid #d9cba7;outline-offset:2px}
@container(max-width:580px){.rpg-supplier-portrait{width:68%!important;height:91%!important;right:-6%;bottom:4%}.rpg-supplier-choices{width:44%;top:43%;left:45%;gap:12px}.rpg-ui .rpg-supplier-choice{min-height:48px;padding:8px 18px}.rpg-supplier-dialogue{left:3%;right:3%;height:24%;padding:21px 20px}.rpg-ui .rpg-supplier-name{min-width:118px;padding:7px 18px}.rpg-supplier-hint{font-size:10px;right:16px;bottom:13px}}
@container(max-height:490px){.rpg-supplier-choices{top:40%;gap:10px;width:27%;min-width:155px}.rpg-ui .rpg-supplier-choice{min-height:44px;padding:6px 18px;font-size:20px}.rpg-supplier-dialogue{height:25%;min-height:74px;padding:13px 22px;bottom:3%}.rpg-ui .rpg-supplier-name{font-size:21px;min-width:120px;padding:5px 18px;bottom:calc(100% + 6px)}.rpg-ui .rpg-supplier-question{font-size:24px}.rpg-supplier-hint{font-size:10px;bottom:10px}.rpg-supplier-portrait{width:48%!important;height:100%!important;bottom:0;right:0}}
@media(pointer:coarse){.rpg-supplier-hint{display:none}}

/* 0.37.1: the choice list may never reach the name plate or dialogue box.
   Its centre stays where it was tuned; max-height keeps the lower half above the name plate
   (1px box clearance plus the 6px list padding), and long lists such as the shop scroll inside the list instead. */
.rpg-supplier-choices{box-sizing:border-box;padding:6px;max-height:calc(2 * (54.2% - max(25%, 90px) - 27px - 1.4 * clamp(20px, 2.6cqw, 30px)));overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#9a927f66 transparent}
.rpg-supplier-choices:has(>:nth-child(6)){width:min(46cqw,600px);gap:8px}
.rpg-ui .rpg-supplier-choices:has(>:nth-child(6)) .rpg-supplier-choice{min-height:0;padding:8px 18px 8px 30px;font-size:clamp(14px,1.8cqw,19px);line-height:1.45;letter-spacing:.04em;text-align:left}
@container(max-height:719.98px){.rpg-supplier-choices{top:36%;gap:10px;max-height:calc(2 * (61.2% - max(25%, 90px) - 27px - 1.4 * clamp(20px, 2.6cqw, 30px)))}.rpg-ui .rpg-supplier-choice{min-height:44px;padding:6px 18px;font-size:clamp(18px,2.2cqw,23px)}}
@container(max-height:490px){.rpg-supplier-choices{top:34%;gap:6px;max-height:calc(2 * (63% - max(25%, 74px) - 48.4px))}.rpg-ui .rpg-supplier-choice{min-height:35px;padding:4px 18px;font-size:19px}.rpg-ui .rpg-supplier-choices:has(>:nth-child(6)) .rpg-supplier-choice{padding:5px 14px 5px 26px;font-size:14px}}

.rpg-supplier-question{min-height:1.8em;cursor:pointer}
.rpg-supplier-letter{display:inline-block;white-space:pre;animation:rpg-letter-in .12s ease-out both}
.rpg-supplier-question.is-typing::after{content:'';display:inline-block;width:2px;height:1em;margin-left:5px;vertical-align:-.12em;background:#d9c59b;animation:rpg-writing-cursor .65s steps(2,end) infinite}
@keyframes rpg-letter-in{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
@keyframes rpg-writing-cursor{50%{opacity:0}}
@media(prefers-reduced-motion:reduce){.rpg-supplier-letter,.rpg-supplier-question.is-typing::after{animation:none}}
/* 0.40 补给员对话 */
.rpg-supplier-talk{position:absolute;z-index:2;left:2.2%;width:min(58%,760px);bottom:calc(max(25%, 90px) + 2.8% + 56px);top:9%;display:flex;flex-direction:column;gap:8px;pointer-events:auto}
.rpg-supplier-talk-log{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:10px 14px;border:1px solid #ded8ca55;background:#0d0d12b8;scrollbar-width:thin;scrollbar-color:#9a927f66 transparent}
.rpg-ui .rpg-supplier-talk-line{margin:0 0 8px;font-size:clamp(14px,1.7cqw,18px);line-height:1.6;letter-spacing:.04em;text-shadow:0 1px 2px #000;white-space:pre-wrap;word-break:break-word}
.rpg-ui .rpg-supplier-talk-line.is-player{color:#d9e6ff;text-align:right}.rpg-ui .rpg-supplier-talk-line.is-supplier{color:#eee9e0}.rpg-ui .rpg-supplier-talk-line.is-system{color:#d8c294;font-style:italic;font-size:clamp(12px,1.5cqw,15px)}
.rpg-supplier-talk-row{display:flex;gap:8px;align-items:stretch}
.rpg-ui .rpg-supplier-talk-input{flex:1;min-width:0;padding:9px 12px;border:1px solid #ded8caaa;border-radius:0;background:#14131ae8;color:#f3eee4;font:inherit;font-size:clamp(15px,1.8cqw,19px)}
.rpg-ui .rpg-supplier-talk-input:focus{outline:2px solid #cdbf9b;outline-offset:1px}
.rpg-ui .rpg-supplier-talk-send,.rpg-ui .rpg-supplier-talk-back{padding:8px 14px;border:1px solid #ded8caaa;border-radius:0;background:#14131ad9;color:#eee9e0;font:inherit;font-size:clamp(14px,1.7cqw,18px);letter-spacing:.1em;white-space:nowrap}
.rpg-ui .rpg-supplier-talk-send:disabled,.rpg-ui .rpg-supplier-talk-input:disabled{opacity:.55}
@container(max-width:580px){.rpg-supplier-talk{width:auto;right:3%;left:3%;top:6%}}
/* 0.40.1 移动端：对话区让开左上角关闭钮和名牌（名牌高度随字号变，按同一 clamp 算）；矮屏（手机横屏 / 弹出键盘）
   横屏改为让到关闭钮右侧，极矮时收起下方对话框、她最新一句改在记录区显示；触屏输入框 16px，避免 iOS 聚焦时整页放大。 */
.rpg-supplier-talk{top:max(9%, calc(2.8% + 50px));bottom:calc(max(25%, 90px) + 2.8% + 1.4 * clamp(20px, 2.6cqw, 30px) + 32px)}
.rpg-ui .rpg-supplier-talk-line.is-latest{display:none}
@container(max-width:580px){.rpg-supplier-talk{top:calc(2.8% + 50px);bottom:calc(max(24%, 90px) + 2.8% + 1.4 * clamp(20px, 2.6cqw, 30px) + 30px)}}
@container(max-height:490px){.rpg-supplier-talk{bottom:calc(max(25%, 74px) + 3% + 1.4 * 21px + 24px)}}
@container(max-height:490px) and (orientation:landscape){.rpg-supplier-talk{top:2.8%;left:calc(2.2% + 52px)}}
@container(max-height:300px){.rpg-supplier.is-talking .rpg-supplier-dialogue{display:none}.rpg-supplier.is-talking .rpg-supplier-talk{bottom:3%}.rpg-ui .rpg-supplier-talk-line.is-latest{display:block}}
@media(pointer:coarse){.rpg-ui .rpg-supplier-talk-input{font-size:clamp(16px,1.8cqw,19px)}}
/* 对话时浮动全屏按钮（平时 top:70px）挪到右上角、与关闭钮同一行；窄横屏的对话区右侧同样让开它。 */
.rpg-ui.is-supplier-talking .rpg-fullscreen{top:2.8%;right:2.2%;width:42px;height:42px;min-height:42px;padding:10px}
@container(max-height:490px) and (orientation:landscape) and (max-width:580px){.rpg-supplier-talk{right:calc(2.2% + 52px)}}
`;
