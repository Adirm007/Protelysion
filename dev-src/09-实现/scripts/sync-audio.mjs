import {mkdir, readFile, writeFile, stat, link, copyFile, rename, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
const project = fileURLToPath(new URL('../../', import.meta.url));
const canonical = path.join(project, '21-音频制作/assets');
const sha = data => createHash('sha256').update(data).digest('hex');

export async function syncAudio(destination = path.join(project, '16-Godot可玩区域/web/audio')) {
  const raw = await readFile(path.join(canonical, 'audio-manifest.json'));
  const manifest = JSON.parse(raw);
  if (manifest.version !== 'booksea-audio/1') throw Error('Audio manifest not ready; run 21-音频制作/tools/prepare_audio.py first.');
  const assets = new Map();
  for (const item of [...Object.values(manifest.music), ...Object.values(manifest.sfx)]) {
    for (const rel of Object.values(item.files)) {
      if (!/^(music|sfx)\//.test(rel) || rel.split('/').includes('..')) throw Error('Invalid audio path: ' + rel);
      assets.set(rel, item.sha256[rel]);
    }
  }
  let linked = 0, copied = 0, unchanged = 0, bytes = 0;
  for (const [rel, expected] of assets) {
    const src = path.join(canonical, rel), dest = path.join(destination, rel);
    const content = await readFile(src);
    if (sha(content) !== expected) throw Error('Audio asset hash mismatch: ' + rel);
    bytes += content.length;
    let sourceStat = await stat(src), targetStat;
    try {targetStat = await stat(dest);} catch {}
    if (targetStat && sourceStat.dev === targetStat.dev && sourceStat.ino === targetStat.ino) {unchanged++; continue;}
    if (targetStat && targetStat.size === content.length && sha(await readFile(dest)) === expected) {unchanged++; continue;}
    await mkdir(path.dirname(dest), {recursive: true});
    const temporary = dest + '.booksea-audio-part'; await rm(temporary, {force: true});
    try {await link(src, temporary); linked++;} catch {await copyFile(src, temporary); copied++;}
    await rename(temporary, dest);
  }
  await mkdir(destination, {recursive: true});
  await writeFile(path.join(destination, 'audio-manifest.json.booksea-audio-part'), raw);
  await rename(path.join(destination, 'audio-manifest.json.booksea-audio-part'), path.join(destination, 'audio-manifest.json'));
  await copyFile(path.join(canonical, 'CREDITS.txt'), path.join(destination, 'CREDITS.txt'));
  const summary = {revision: 'booksea-audio/1', music: Object.keys(manifest.music).length, effects: Object.keys(manifest.sfx).length,
    themes: Object.keys(manifest.themes).length, monsters: Object.keys(manifest.monsters).length,
    files: assets.size, bytes, manifestSha256: sha(raw), linked, copied, unchanged};
  return summary;
}
export async function updatePlayableManifest(audio) {
  const file = path.join(project, '16-Godot可玩区域/verification/web-manifest.json');
  const manifest = JSON.parse(await readFile(file));
  const script = await readFile(path.join(project, '16-Godot可玩区域/web/play.js'));
  manifest.files['play.js'] = {bytes: script.length, sha256: sha(script)};
  manifest.audio = audio; // Preserve the verified art revision, PCK and engine hashes.
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
}
