/**
 * Loading veil (Phase 9.2, 装订迷宫): while the next floor is generated and uploaded to the renderer, a page turns
 * and one of seven illustrated scenes is shown — the scenes the user chose on 10-20, now with 夜梦 redrawn in 兔串.
 * Three families keep their meaning (and the theme affinity table): library = 书库 / 钟楼书塔 / 雨夜书店,
 * fairytale = 童话·日 / 童话·夜 / 书页之海渡船, marionette = 提线剧场. A floor key picks the family's scene stably.
 * Every keyframe only animates `transform` / `opacity` (compositor-only: Godot builds floors on the main thread),
 * prefers-reduced-motion stops all of it. The veil stays at least MIN_MS, then fades out over FADE_MS.
 * Art is a set of release files (veil-art.ts); until a picture arrives the scene shows its painted fallback colour.
 */
import {VEIL_ART, type VeilArtKey} from './veil-art';
import {hydrateUiImages} from './ui-art';
import {BK_DISPLAY, BK_SERIF, BK_LATIN} from './binding-kit';

export type VeilVariant = 'library' | 'fairytale' | 'marionette';
export const VEIL_VARIANTS: readonly VeilVariant[] = ['library', 'fairytale', 'marionette'];
export type VeilInfo = {key: string; subtitle?: string; variant?: VeilVariant; boot?: boolean};
export const VEIL_MIN_MS = 1200, VEIL_FADE_MS = 450;
export type VeilScene = 'library' | 'clock' | 'shop' | 'fairy' | 'night' | 'ferry' | 'theater';
export const VEIL_SCENES: Readonly<Record<VeilVariant, readonly VeilScene[]>> = {library: ['library', 'clock', 'shop'], fairytale: ['fairy', 'night', 'ferry'], marionette: ['theater']};

const COPY: Record<VeilScene, {title: string; hints: string[]}> = {
  library: {title: '正在翻开下一页', hints: ['书架深处传来纸页摩挲的声音', '墨迹正在凝成道路与屋檐', '有一本书，正替你挑选下一段旅程']},
  clock: {title: '钟楼正在拨动指针', hints: ['齿轮咬合，下一层正转到你面前', '钟声敲响之前，路就会铺好', '她把黄铜钥匙插进了钟面']},
  shop: {title: '雨夜书店还亮着灯', hints: ['店门的铃铛轻轻响了一下', '雨水洇湿了书页的一角', '黑猫在门口守着下一本书']},
  fairy: {title: '故事正在展开', hints: ['城堡正从书页里立起来', '怀表停在了“从前从前”', '扑克牌卫兵正在列队']},
  night: {title: '童话正在入睡', hints: ['月亮替你翻过这一页', '星星一颗一颗亮起来', '睡前的故事还没有讲完']},
  ferry: {title: '渡船正在靠岸', hints: ['纸鹤替你探好了水路', '船灯照着摊开的书页之海', '再划几下，就到下一层了']},
  theater: {title: '幕间换景中', hints: ['布景师正在更换背景画板', '提线已经绷紧，请稍候', '帷幕之后，下一幕即将开演']},
};

const hash = (key: string) => {let h = 0x811c9dc5; for (let i = 0; i < key.length; i++) {h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193);} return h >>> 0;};
/** Stable variant for a floor key (FNV-1a). */
export function veilVariantFor(key: string): VeilVariant {return VEIL_VARIANTS[hash(key) % VEIL_VARIANTS.length]!;}

/** Themes whose world already speaks one of the three veil languages; every other floor uses the stable hash. */
export const VEIL_THEME_AFFINITY: Readonly<Record<string, VeilVariant>> = {
  T15: 'library', T22: 'library', T25: 'library', T27: 'library', T39: 'library', T41: 'library',
  T02: 'fairytale', T04: 'fairytale', T12: 'fairytale', T20: 'fairytale', T21: 'fairytale', T32: 'fairytale', T35: 'fairytale', T38: 'fairytale',
  T06: 'marionette', T11: 'marionette', T24: 'marionette', T33: 'marionette', T34: 'marionette', T45: 'marionette', T48: 'marionette',
};
export function veilVariantForTheme(theme: string | undefined, key: string): VeilVariant {
  return (theme ? VEIL_THEME_AFFINITY[theme] : undefined) ?? veilVariantFor(key);
}
/** The scene inside a family for a floor key (stable; a different salt from the family hash). */
export function veilSceneFor(variant: VeilVariant, key = ''): VeilScene {const list = VEIL_SCENES[variant]; return list[hash(key + '#scene') % list.length]!;}

const art = (k: VeilArtKey, css = '') => `<img class="${css}" alt="" draggable="false" data-ui-art="${VEIL_ART[k]}">`;
const rep = (n: number, fn: (i: number) => string) => Array.from({length: n}, (_, i) => fn(i)).join('');
const rnd = (i: number, k: number) => {const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x);};
const f = (v: number) => v.toFixed(2);
const motes = (n: number, seed: number) => `<div class="bsv-motes">${rep(n, i => `<i style="left:${f(rnd(i, seed) * 96)}%;top:${f(10 + rnd(i, seed + 1) * 70)}%;--t:${f(5 + rnd(i, seed + 2) * 5)}s;--d:${f(-rnd(i, seed + 3) * 8)}s"></i>`)}</div>`;

/** Scene markup: a 16:9 plate (picture + props) that covers the stage, then 夜梦's layer placed in the visible area. */
const SCENE_HTML: Record<VeilScene, () => string> = {
  library: () => `<div class="bsv-plate">${art('library-bg', 'bsv-bg')}<i class="bsv-glow" style="left:44%;top:30%"></i>${motes(14, 11)}<div class="bsv-fly a">${art('obj-book-a')}</div><div class="bsv-fly b">${art('obj-book-b')}</div></div><div class="bsv-dream">${art('library-dream')}</div>`,
  clock: () => `<div class="bsv-plate">${art('clock-bg', 'bsv-bg')}<i class="bsv-glow" style="left:60%;top:16%"></i><div class="bsv-gear">${art('obj-gear')}</div><div class="bsv-watch">${art('obj-watch')}</div>${motes(10, 21)}</div><div class="bsv-dream">${art('clock-dream')}</div>`,
  shop: () => `<div class="bsv-plate">${art('shop-bg', 'bsv-bg')}<i class="bsv-glow" style="left:52%;top:40%"></i><div class="bsv-rain"></div><div class="bsv-cat">${art('obj-cat')}</div></div><div class="bsv-dream">${art('shop-dream')}</div>`,
  fairy: () => `<div class="bsv-plate">${art('fairy-bg', 'bsv-bg')}<i class="bsv-glow" style="left:78%;top:8%"></i>${motes(12, 31)}<div class="bsv-card a">${art('obj-cards')}</div><div class="bsv-card b">${art('obj-cards')}</div></div><div class="bsv-dream">${art('fairy-dream')}</div>`,
  night: () => `<div class="bsv-plate">${art('night-bg', 'bsv-bg')}<div class="bsv-stars">${rep(16, i => `<i style="left:${f(4 + rnd(i, 41) * 92)}%;top:${f(3 + rnd(i, 42) * 34)}%;--s:${f(.5 + rnd(i, 43) * .9)};--t:${f(2 + rnd(i, 44) * 3)}s;--d:${f(-rnd(i, 45) * 4)}s"></i>`)}</div></div><div class="bsv-dream">${art('night-dream')}</div>`,
  ferry: () => `<div class="bsv-plate">${art('ferry-bg', 'bsv-bg')}<i class="bsv-glow" style="left:50%;top:30%"></i><div class="bsv-crane a">${art('obj-crane-a')}</div><div class="bsv-crane b">${art('obj-crane-b')}</div></div><div class="bsv-dream">${art('ferry-dream')}</div>`,
  theater: () => `<div class="bsv-plate">${art('theater-bg', 'bsv-bg')}<i class="bsv-spot"></i><div class="bsv-rig-pos"><div class="bsv-rig"><div class="bsv-sway"><span class="bsv-bar"></span><span class="bsv-string" style="left:28%;height:58%"></span><span class="bsv-string" style="left:50%;height:12%"></span><span class="bsv-string" style="left:72.5%;height:58%"></span>${art('theater-dream', 'bsv-puppet')}</div></div></div><div class="bsv-cur l">${art('theater-curtain')}</div><div class="bsv-cur r">${art('theater-curtain')}</div>${art('theater-frame', 'bsv-frame')}</div>`,
};
const MARKERS: Record<VeilVariant, string> = {library: 'bsv-lib', fairytale: 'bsv-fairy', marionette: 'bsv-thea'};

export function veilScene(v: VeilVariant, key = ''): string {
  const scene = veilSceneFor(v, key);
  return `<div class="bsv-stage ${MARKERS[v]}" data-scene="${scene}">${SCENE_HTML[scene]()}<div class="bsv-leaf"><i></i></div></div>`;
}

const FALLBACK: Record<VeilScene, string> = {library: '#4a3021', clock: '#3a2618', shop: '#1f2b33', fairy: '#47603a', night: '#1c2a4a', ferry: '#6a4a52', theater: '#2a0f12'};
export const VEIL_CSS = `
.bsv{position:absolute;inset:0;z-index:60;overflow:hidden;background:#140c09;container-type:size;color:#23180f;font-family:${BK_SERIF};pointer-events:auto;opacity:1;transition:opacity ${VEIL_FADE_MS}ms ease}
.bsv[hidden]{display:none}.bsv.is-leaving{opacity:0}
.bsv *{box-sizing:border-box}
.bsv img{display:block;max-width:none;transition:opacity .45s}
.bsv-scene,.bsv-stage{position:absolute;inset:0;perspective:1600px}
.bsv-plate{position:absolute;left:50%;top:50%;width:max(100cqw,177.78cqh);height:max(100cqh,56.25cqw);margin:calc(max(100cqh,56.25cqw) / -2) 0 0 calc(max(100cqw,177.78cqh) / -2);overflow:hidden;animation:bsv-in .6s ease-out both}
${Object.entries(FALLBACK).map(([k, c]) => `.bsv-stage[data-scene=${k}] .bsv-plate{background:radial-gradient(ellipse at 50% 42%,color-mix(in srgb,${c} 70%,#fff),${c} 62%,#120a07)}`).join('\n')}
.bsv-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.bsv-plate>*{position:absolute}
.bsv-plate>div>img{width:100%;height:auto}
.bsv-glow{width:30%;height:40%;margin:-20% 0 0 -15%;border-radius:50%;background:radial-gradient(closest-side,rgba(255,214,150,.4),transparent);animation:bsv-glow 4.6s ease-in-out infinite alternate}
.bsv-motes{inset:0}
.bsv-motes i{position:absolute;width:3px;height:3px;border-radius:50%;background:#ffe8b8;box-shadow:0 0 6px #ffd98a;opacity:0;animation:bsv-mote var(--t) linear var(--d) infinite}
.bsv-fly{width:8%;filter:drop-shadow(0 6px 6px rgba(0,0,0,.45))}
.bsv-fly.a{left:8%;top:30%;animation:bsv-drift-a 14s linear -2s infinite}
.bsv-fly.b{left:74%;top:16%;width:6%;animation:bsv-drift-b 17s linear -9s infinite}
.bsv-gear{left:70%;top:4%;width:13%;opacity:.88;animation:bsv-spin 22s linear infinite}
.bsv-watch{left:18%;top:-1%;width:6%;transform-origin:50% 0;animation:bsv-swing 3.2s ease-in-out infinite alternate}
.bsv-rain{inset:-100% 0 0;background:repeating-linear-gradient(104deg,transparent 0 22px,rgba(200,220,235,.18) 22px 23px,transparent 23px 41px);opacity:.75;animation:bsv-rain .9s linear infinite}
.bsv-cat{left:4%;bottom:4%;width:13%;filter:drop-shadow(0 4px 4px rgba(0,0,0,.5))}
.bsv-card{width:5%;filter:drop-shadow(0 4px 4px rgba(0,0,0,.35))}
.bsv-card.a{left:60%;top:-12%;animation:bsv-flutter 9s linear -1s infinite}
.bsv-card.b{left:30%;top:-12%;width:4%;animation:bsv-flutter 11s linear -6s infinite}
.bsv-stars{inset:0}
.bsv-stars i{position:absolute;width:6px;height:6px;margin:-3px;border-radius:50%;background:radial-gradient(closest-side,#fff8dc,rgba(255,240,190,.6) 45%,transparent);transform:scale(var(--s));animation:bsv-twinkle var(--t) ease-in-out var(--d) infinite alternate}
.bsv-crane{width:7%;filter:drop-shadow(0 6px 5px rgba(60,30,30,.35))}
.bsv-crane.a{left:64%;top:16%;animation:bsv-fly 16s linear -3s infinite}
.bsv-crane.b{left:84%;top:30%;width:5%;animation:bsv-fly 21s linear -12s infinite}
.bsv-spot{left:28%;top:-10%;width:44%;height:100%;background:radial-gradient(ellipse 50% 70% at 50% 0,rgba(255,226,170,.42),transparent 70%);opacity:0;animation:bsv-spot 1.2s ease-out .9s both}
.bsv-rig-pos{left:50%;top:9%;height:74%;aspect-ratio:832/1216;transform:translateX(-50%)}
.bsv-rig{position:absolute;inset:0;animation:bsv-drop 1.6s cubic-bezier(.3,1.25,.55,1) .5s both}
.bsv-sway{position:absolute;inset:0;transform-origin:50% -14%;animation:bsv-sway 4.8s ease-in-out 2.1s infinite alternate}
.bsv-puppet{position:absolute;left:0;top:0;width:100%!important;height:100%;object-fit:contain}
.bsv-bar{position:absolute;left:18%;right:18%;top:-15%;height:2.4%;border-radius:3px;background:linear-gradient(180deg,#8a5a34,#4a2c18);box-shadow:0 3px 6px rgba(0,0,0,.5)}
.bsv-bar::before{content:'';position:absolute;left:44%;width:12%;top:-260%;height:620%;border-radius:3px;background:linear-gradient(90deg,#4a2c18,#8a5a34,#4a2c18)}
.bsv-string{position:absolute;top:-13%;width:1px;margin-left:-.5px;background:linear-gradient(180deg,rgba(255,240,210,.85),rgba(255,240,210,.35))}
.bsv-cur{top:0;bottom:0;width:28%;z-index:3;overflow:hidden}
.bsv-plate .bsv-cur img{width:100%;height:100%;object-fit:cover}
.bsv-cur.l{left:14%;transform-origin:0 50%;animation:bsv-cur 1.4s cubic-bezier(.5,0,.2,1) .25s both}
.bsv-cur.r{right:14%;transform-origin:100% 50%;animation:bsv-cur 1.4s cubic-bezier(.5,0,.2,1) .25s both}
.bsv-plate .bsv-cur.r img{transform:scaleX(-1)}
.bsv-frame{inset:0;width:100%!important;height:100%;object-fit:cover;z-index:4}
.bsv-dream{position:absolute;inset:0 0 14cqh;display:flex;align-items:flex-end;pointer-events:none}
.bsv-dream img{height:84cqh;width:auto;max-width:60cqw;object-fit:contain;filter:drop-shadow(0 10px 16px rgba(0,0,0,.45));animation:bsv-dream-in 1.1s cubic-bezier(.2,.8,.3,1) .45s both}
.bsv-stage[data-scene=library] .bsv-dream{justify-content:flex-end;padding:0 7cqw 0 0;inset:0 0 6cqh}
.bsv-stage[data-scene=clock] .bsv-dream{justify-content:flex-start;padding:0 0 0 8cqw;inset:0}
.bsv-stage[data-scene=clock] .bsv-dream img{height:94cqh}
.bsv-stage[data-scene=shop] .bsv-dream{justify-content:flex-start;padding:0 0 0 14cqw;inset:0 0 3cqh}
.bsv-stage[data-scene=fairy] .bsv-dream{justify-content:flex-end;padding:0 10cqw 0 0;inset:0 0 5cqh}
.bsv-stage[data-scene=night] .bsv-dream{justify-content:flex-end;align-items:flex-start;padding:5cqh 5cqw 0 0;inset:0}
.bsv-stage[data-scene=night] .bsv-dream img{height:auto;width:min(54cqw,96cqh);max-width:none;animation:bsv-dream-in 1.1s cubic-bezier(.2,.8,.3,1) .45s both,bsv-float 6s ease-in-out 1.6s infinite alternate}
.bsv-stage[data-scene=ferry] .bsv-dream{justify-content:flex-start;padding:0 0 0 12cqw;inset:0}
.bsv-stage[data-scene=ferry] .bsv-dream img{height:90cqh;animation:bsv-dream-in 1.1s cubic-bezier(.2,.8,.3,1) .45s both,bsv-bob 4.4s ease-in-out 1.6s infinite alternate}
/* the opening: a page turns over to reveal the scene */
.bsv-leaf{position:absolute;inset:0;z-index:8;transform-origin:0 50%;backface-visibility:hidden;background:radial-gradient(ellipse at 50% 46%,transparent 40%,rgba(80,56,30,.25)),linear-gradient(90deg,rgba(80,56,30,.3),transparent 8%),#efe3c8;animation:bsv-turn 1s cubic-bezier(.45,.05,.3,1) .08s both}
.bsv-leaf i{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(30,16,8,.55));opacity:0;animation:bsv-shade 1s ease-in .08s both}
.bsv-vign{position:absolute;inset:0;z-index:5;pointer-events:none;background:radial-gradient(ellipse at 50% 46%,transparent 52%,rgba(14,8,5,.62)),linear-gradient(180deg,transparent 70%,rgba(14,8,5,.55))}
.bsv-caption{position:absolute;z-index:6;left:50%;bottom:max(18px,4cqh);width:min(580px,92cqw);margin-left:calc(min(580px,92cqw) / -2);padding:14px 26px 16px;text-align:center;background:linear-gradient(90deg,rgba(80,56,30,.18),transparent 6%,transparent 94%,rgba(80,56,30,.18)),#efe3c8;box-shadow:0 12px 30px rgba(0,0,0,.55),inset 0 0 0 1px rgba(35,24,15,.2);animation:bsv-cap .6s ease-out .3s both}
.bsv-ribbon{position:absolute;right:30px;top:-12px;width:18px;height:46px;background:linear-gradient(90deg,#8a1a1f,#b3262b 45%,#c8393e 58%,#8a1a1f);clip-path:polygon(0 0,100% 0,100% 100%,50% 78%,0 100%)}
.bsv-title{margin:0;font:900 clamp(18px,3.4cqh,26px)/1.35 ${BK_DISPLAY};letter-spacing:.3em;padding-left:.3em;color:#23180f}
.bsv-sub{margin:4px 0 0;font:13.5px/1.5 ${BK_SERIF};letter-spacing:.12em;color:#5e4b3a}
.bsv-sub:empty{display:none}
.bsv-hint{margin:6px 0 0;font:italic 14px/1.6 ${BK_SERIF};letter-spacing:.08em;color:#5e4b3a}
.bsv-prog{position:relative;height:2px;margin:10px auto 0;width:62%;overflow:hidden;background:rgba(35,24,15,.15)}
.bsv-prog i{position:absolute;inset:0 auto 0 0;width:34%;background:linear-gradient(90deg,transparent,#b3262b,transparent);animation:bsv-prog 1.5s ease-in-out infinite}
.bsv-mark{position:absolute;left:18px;top:14px;z-index:6;font:italic 13px/1 ${BK_LATIN};letter-spacing:.2em;color:rgba(239,227,200,.7)}
@container (max-aspect-ratio:1/1){
 .bsv-dream,.bsv-stage[data-scene] .bsv-dream{justify-content:center;padding:0;inset:auto 0 22cqh 0;height:66cqh}
 .bsv-dream img,.bsv-stage[data-scene] .bsv-dream img{height:100%;max-width:92cqw}
 .bsv-stage[data-scene=night] .bsv-dream{inset:6cqh 0 auto 0;height:auto}
 .bsv-stage[data-scene=night] .bsv-dream img{width:94cqw;height:auto}
 .bsv-rig-pos{top:12%;height:64%}
}
@container (max-height:420px){.bsv-caption{padding:8px 18px 10px;bottom:8px}.bsv-hint{display:none}.bsv-prog{margin-top:6px}}
@keyframes bsv-in{from{opacity:0}to{opacity:1}}
@keyframes bsv-turn{0%{transform:rotateY(0)}100%{transform:rotateY(-178deg)}}
@keyframes bsv-shade{0%{opacity:0}55%{opacity:.85}100%{opacity:1}}
@keyframes bsv-dream-in{from{opacity:0;transform:translateY(4cqh)}to{opacity:1;transform:translateY(0)}}
@keyframes bsv-cap{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes bsv-glow{from{opacity:.55;transform:scale(.94)}to{opacity:1;transform:scale(1.06)}}
@keyframes bsv-mote{0%{opacity:0;transform:translate(0,0)}20%{opacity:.9}80%{opacity:.6}100%{opacity:0;transform:translate(1.6cqw,-6cqh)}}
@keyframes bsv-drift-a{0%{opacity:0;transform:translate(0,0) rotate(-6deg)}8%{opacity:1}50%{transform:translate(32cqw,-6cqh) rotate(4deg)}92%{opacity:1}100%{opacity:0;transform:translate(64cqw,2cqh) rotate(-3deg)}}
@keyframes bsv-drift-b{0%{opacity:0;transform:translate(0,0) rotate(5deg)}10%{opacity:1}55%{transform:translate(-30cqw,8cqh) rotate(-4deg)}90%{opacity:1}100%{opacity:0;transform:translate(-56cqw,4cqh) rotate(3deg)}}
@keyframes bsv-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes bsv-swing{from{transform:rotate(-12deg)}to{transform:rotate(12deg)}}
@keyframes bsv-rain{from{transform:translateY(0)}to{transform:translateY(50%)}}
@keyframes bsv-flutter{0%{opacity:0;transform:translate(0,0) rotate(0)}10%{opacity:1}50%{transform:translate(-4cqw,60cqh) rotate(200deg)}90%{opacity:1}100%{opacity:0;transform:translate(3cqw,118cqh) rotate(380deg)}}
@keyframes bsv-twinkle{from{opacity:.2;transform:scale(calc(var(--s) * .7))}to{opacity:1;transform:scale(var(--s))}}
@keyframes bsv-float{from{transform:translateY(0)}to{transform:translateY(-2.4cqh)}}
@keyframes bsv-bob{0%{transform:translateY(0) rotate(-.8deg)}100%{transform:translateY(-1.4cqh) rotate(1deg)}}
@keyframes bsv-fly{0%{opacity:0;transform:translate(0,0)}10%{opacity:1}50%{transform:translate(-34cqw,-4cqh)}90%{opacity:1}100%{opacity:0;transform:translate(-70cqw,2cqh)}}
@keyframes bsv-spot{from{opacity:0}to{opacity:1}}
@keyframes bsv-cur{from{transform:scaleX(1)}to{transform:scaleX(.22)}}
@keyframes bsv-drop{from{transform:translateY(-74cqh)}to{transform:translateY(0)}}
@keyframes bsv-sway{from{transform:rotate(-2.4deg)}to{transform:rotate(2.4deg)}}
@keyframes bsv-prog{from{transform:translateX(-110%)}to{transform:translateX(310%)}}
@media (prefers-reduced-motion:reduce){.bsv *,.bsv *::before,.bsv *::after{animation-duration:.01s!important;animation-iteration-count:1!important;animation-delay:0s!important}.bsv-leaf{display:none}.bsv-prog i{animation:none!important;transform:translateX(90%)}}
`;

export type LoadingVeil = {update(info: VeilInfo | null): void; readonly visible: boolean; readonly variant: VeilVariant | null; dispose(): void};

export function mountLoadingVeil(stage: HTMLElement, win: Window = stage.ownerDocument.defaultView ?? window): LoadingVeil {
  const doc = stage.ownerDocument;
  if (!doc.getElementById('booksea-veil-style')) {const css = doc.createElement('style'); css.id = 'booksea-veil-style'; css.textContent = VEIL_CSS; doc.head.append(css);}
  const root = doc.createElement('div');
  root.className = 'bsv'; root.hidden = true; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite');
  root.innerHTML = '<div class="bsv-scene"></div><div class="bsv-vign"></div><span class="bsv-mark" aria-hidden="true">Protelysion</span><div class="bsv-caption"><span class="bsv-ribbon" aria-hidden="true"></span><p class="bsv-title"></p><p class="bsv-sub"></p><p class="bsv-hint"></p><div class="bsv-prog" aria-hidden="true"><i></i></div></div>';
  stage.append(root);
  const scene = root.querySelector<HTMLElement>('.bsv-scene')!, title = root.querySelector<HTMLElement>('.bsv-title')!, sub = root.querySelector<HTMLElement>('.bsv-sub')!, hint = root.querySelector<HTMLElement>('.bsv-hint')!;
  const now = () => win.performance?.now?.() ?? Date.now();
  let variant: VeilVariant | null = null, key = '', shownAt = 0, showing = false, hideTimer = 0, fadeTimer = 0, slowTimer = 0;
  const clear = () => {win.clearTimeout(hideTimer); win.clearTimeout(fadeTimer); hideTimer = fadeTimer = 0;};
  function show(info: VeilInfo) {
    clear();
    const v = info.variant ?? veilVariantFor(info.key), place = veilSceneFor(v, info.key), copy = COPY[place];
    const prevKey = key, fresh = !showing || info.key !== prevKey;
    if (v !== variant || fresh) {variant = v; scene.innerHTML = veilScene(v, info.key); root.dataset.variant = v; root.dataset.scene = place; hydrateUiImages(scene, win);}
    if (fresh) hint.textContent = copy.hints[Math.floor(Math.random() * copy.hints.length)]!;
    title.textContent = copy.title;
    sub.textContent = info.subtitle ?? '';
    key = info.key;
    root.classList.remove('is-leaving');
    if (!showing) {showing = true; shownAt = now(); root.hidden = false;}
    if (fresh) {
      win.clearTimeout(slowTimer);
      slowTimer = win.setTimeout(() => {if (showing) hint.textContent = '书页比平时更厚一些，请再稍候片刻……';}, 20000);
    }
  }
  function hide() {
    if (!showing || hideTimer || fadeTimer) return;
    const wait = Math.max(0, VEIL_MIN_MS - (now() - shownAt));
    hideTimer = win.setTimeout(() => {
      hideTimer = 0; root.classList.add('is-leaving');
      fadeTimer = win.setTimeout(() => {fadeTimer = 0; showing = false; root.hidden = true; root.classList.remove('is-leaving'); win.clearTimeout(slowTimer); scene.innerHTML = '';}, VEIL_FADE_MS);
    }, wait);
  }
  return {
    update(info) {if (info) show(info); else hide();},
    get visible() {return showing;},
    get variant() {return variant;},
    dispose() {clear(); win.clearTimeout(slowTimer); root.remove();},
  };
}
