import fs from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const directory = new URL('./', import.meta.url);
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const descriptor = JSON.parse(await fs.readFile(new URL('descriptor.json', directory), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
const runtime = await fs.readFile(new URL(descriptor.runtime.path, directory));
const compressed = await fs.readFile(new URL(descriptor.wasm.path, directory));
if (runtime.length !== descriptor.runtime.bytes || hash(runtime) !== descriptor.runtime.sha256 || compressed.length !== descriptor.wasm.bytes || hash(compressed) !== descriptor.wasm.sha256) throw new Error('Verifier integrity check failed');
const raw = gunzipSync(compressed, { maxOutputLength: descriptor.wasm.rawBytes });
if (raw.length !== descriptor.wasm.rawBytes || hash(raw) !== descriptor.wasm.rawSha256) throw new Error('Verifier integrity check failed');
await import(new URL(descriptor.runtime.path, directory));
const go = new globalThis.Go();
const instance = await WebAssembly.instantiate(raw, go.importObject);
go.run(instance.instance).catch(error => { console.error(error); process.exit(1); });
const input = await new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  process.stdin.on('data', chunk => { size += chunk.length; if (size > 1024 * 1024) reject(new Error('Verification input too large')); else chunks.push(chunk); });
  process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  process.stdin.on('error', reject);
});
const result = JSON.parse(globalThis.DreamReleaseAttestationVerify(input));
process.stdout.write(`${JSON.stringify(result)}\n`, () => process.exit(result.ok ? 0 : 1));
