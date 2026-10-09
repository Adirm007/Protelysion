import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SUPPLIER_STYLE} from '../src/ui/supplier-style';

// 版式本身由 scripts/verify-supplier-browser.mjs 在真实浏览器里按 5 种视口测量；这里只锁住规则和顺序，防止被后续改动悄悄覆盖。
test('0.40.1 手机端：对话区让开关闭钮/全屏钮/名牌，横屏让到关闭钮右侧，极矮屏收起对话框并把最新一句放回记录区，触屏输入框 16px', () => {
 assert.match(SUPPLIER_STYLE, /\.rpg-supplier-talk\{top:max\(9%, calc\(2\.8% \+ 50px\)\);bottom:calc\(max\(25%, 90px\) \+ 2\.8% \+ 1\.4 \* clamp\(20px, 2\.6cqw, 30px\) \+ 32px\)\}/);
 assert.match(SUPPLIER_STYLE, /@container\(max-height:490px\) and \(orientation:landscape\)\{\.rpg-supplier-talk\{top:2\.8%;left:calc\(2\.2% \+ 52px\)\}\}/);
 assert.match(SUPPLIER_STYLE, /@container\(max-height:300px\)\{\.rpg-supplier\.is-talking \.rpg-supplier-dialogue\{display:none\}/);
 assert.match(SUPPLIER_STYLE, /\.rpg-ui \.rpg-supplier-talk-line\.is-latest\{display:none\}/);
 assert.match(SUPPLIER_STYLE, /\.rpg-ui\.is-supplier-talking \.rpg-fullscreen\{top:2\.8%;right:2\.2%;width:42px;height:42px/);
 assert.match(SUPPLIER_STYLE, /@container\(max-height:490px\) and \(orientation:landscape\) and \(max-width:580px\)\{\.rpg-supplier-talk\{right:calc\(2\.2% \+ 52px\)\}\}/);
 assert.match(SUPPLIER_STYLE, /@media\(pointer:coarse\)\{\.rpg-ui \.rpg-supplier-talk-input\{font-size:clamp\(16px,1\.8cqw,19px\)\}\}/);
 const order = ['@container(max-width:580px){.rpg-supplier-talk{top:calc(', '@container(max-height:490px){.rpg-supplier-talk{bottom:', '@container(max-height:300px)'].map(k => SUPPLIER_STYLE.indexOf(k));
 assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1]!)), '窄屏 → 矮屏 → 极矮屏 规则必须按此顺序覆盖：' + order);
 const dialogue = readFileSync(new URL('../src/ui/supplier-dialogue.ts', import.meta.url), 'utf8');
 assert.match(dialogue, /i === lastHer \? ' is-latest' : ''/);
 assert.match(dialogue, /enterKeyHint = 'send'/);
 assert.match(dialogue, /logWatch\?\.disconnect\(\)/);
 assert.match(dialogue, /parent\.classList\.toggle\('is-supplier-talking', !!talk\)/);
 assert.match(dialogue, /parent\.classList\.remove\('is-supplier-talking'\)/);
 const panel = readFileSync(new URL('../src/distribution/narrative-panel.ts', import.meta.url), 'utf8');
 assert.match(panel, /\.bs-portal\.bs-narrative\{min-height:0\}/);
});
