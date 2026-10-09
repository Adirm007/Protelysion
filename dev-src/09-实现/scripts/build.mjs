import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir = new URL('../release/', import.meta.url);
await mkdir(dir, { recursive: true });
const result = await build({ entryPoints: ['src/main.ts'], bundle: true, format: 'iife', globalName: 'BookseaStage0', target: 'es2022', write: false, minify: false, charset: 'utf8' });
const js = result.outputFiles[0].text, css = await readFile('src/style.css', 'utf8');
const html = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>书海 · 阶段0接口验证</title><style>${css}</style></head><body><main id="booksea-stage0"></main><script>${js.replace(/<\/script/gi, '<\\/script')}\nBookseaStage0.mount(document.getElementById('booksea-stage0'));<\/script></body></html>\n`;
const regex = {
  id: '89036d40-a00e-4b90-9586-703585a635f1', scriptName: '书海-阶段0接口验证-0.1.0（不是游戏入口）',
  findRegex: '/<booksea-probe>验证<\\/booksea-probe>/g', replaceString: '```html\n' + html + '\n```',
  trimStrings: [], placement: [2], disabled: false, markdownOnly: true, promptOnly: false, runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null,
};
const files = { 'booksea-stage0.iife.js': js, 'booksea-stage0.html': html, '书海-阶段0接口验证正则.json': JSON.stringify(regex, null, 2) + '\n' };
const hashes = {};
for (const [name, content] of Object.entries(files)) { await writeFile(new URL(name, dir), content); hashes[name] = createHash('sha256').update(content).digest('hex'); }
await writeFile(new URL('manifest.json', dir), JSON.stringify({ version: '0.1.0-stage0', kind: 'diagnostic-not-game', sha256: hashes, hostWriteback: false }, null, 2) + '\n');
console.log('Built diagnostic HTML, IIFE, importable regex and SHA256 manifest. Not a game release.');
