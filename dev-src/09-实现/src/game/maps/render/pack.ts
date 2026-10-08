// P5 render kernel → engine transport. Packs a KernelOutput into
//  • one binary glTF (GLB): a mesh + node per chunk, named "c<index>";
//  • one raw RGBA8 blob holding every texture layer (size × size × 4 × layers);
//  • a JSON meta document (lighting preset, camera, enterable buildings, chunk pass/group table, stats).
// Godot imports the GLB natively (GLTFDocument.append_from_buffer) and maps the attributes to:
//   POSITION / NORMAL, TEXCOORD_0 → UV (2 m per tile), TEXCOORD_1 → UV2 = (layer A + 128·B, flags),
//   COLOR_0 → COLOR (rgb AO·tint, a layer blend; UNSIGNED_BYTE normalized), TEXCOORD_2/3 → CUSTOM0 = baked lamp rgb.
// Deterministic: identical input → identical bytes.
import type { KernelOutput } from "./kernel";

export const PACK_VERSION = "p5-pack-1" as const;
export type FloorPack = { glb: Uint8Array; tex: Uint8Array; meta: string };

type Accessor = { bufferView: number; componentType: number; count: number; type: string; normalized?: boolean; min?: number[]; max?: number[] };

export function packFloor(out: KernelOutput): FloorPack {
  const views: { byteOffset: number; byteLength: number; target?: number }[] = [];
  const accessors: Accessor[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;
  const push = (bytes: Uint8Array, target?: number) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { parts.push(new Uint8Array(pad)); offset += pad; }
    views.push({ byteOffset: offset, byteLength: bytes.byteLength, ...(target ? { target } : {}) });
    parts.push(bytes); offset += bytes.byteLength;
    return views.length - 1;
  };
  const f32 = (a: Float32Array, type: string, count: number, minmax = false) => {
    const view = push(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), 34962);
    const acc: Accessor = { bufferView: view, componentType: 5126, count, type };
    if (minmax) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { const v = a[i + k]!; if (v < mn[k]!) mn[k] = v; if (v > mx[k]!) mx[k] = v; }
      acc.min = mn; acc.max = mx;
    }
    accessors.push(acc);
    return accessors.length - 1;
  };
  const meshes: unknown[] = [], nodes: unknown[] = [], table: { name: string; pass: string; group: string; bounds: number[]; triangles: number }[] = [];
  out.chunks.forEach((c, i) => {
    const n = c.position.length / 3;
    if (!n || !c.index.length) return;
    const pos = f32(c.position, "VEC3", n, true);
    const nor = f32(c.normal, "VEC3", n);
    const uv = f32(c.uv, "VEC2", n);
    const uv2 = f32(c.layer, "VEC2", n);
    const col8 = new Uint8Array(n * 4);
    for (let k = 0; k < n * 4; k++) col8[k] = Math.max(0, Math.min(255, Math.round(c.color[k]! * 255)));
    const colView = push(col8, 34962);
    accessors.push({ bufferView: colView, componentType: 5121, normalized: true, count: n, type: "VEC4" });
    const col = accessors.length - 1;
    const rg = new Float32Array(n * 2), b0 = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) { rg[k * 2] = c.lamp[k * 3]!; rg[k * 2 + 1] = c.lamp[k * 3 + 1]!; b0[k * 2] = c.lamp[k * 3 + 2]!; }
    const t2 = f32(rg, "VEC2", n), t3 = f32(b0, "VEC2", n);
    const idxView = push(new Uint8Array(c.index.buffer, c.index.byteOffset, c.index.byteLength), 34963);
    accessors.push({ bufferView: idxView, componentType: 5125, count: c.index.length, type: "SCALAR" });
    const idx = accessors.length - 1;
    const name = "c" + i;
    meshes.push({ name, primitives: [{ attributes: { POSITION: pos, NORMAL: nor, TEXCOORD_0: uv, TEXCOORD_1: uv2, COLOR_0: col, TEXCOORD_2: t2, TEXCOORD_3: t3 }, indices: idx, mode: 4 }] });
    nodes.push({ name, mesh: meshes.length - 1 });
    table.push({ name, pass: c.pass, group: c.group, bounds: c.bounds.map((v) => +v.toFixed(2)), triangles: c.index.length / 3 });
  });
  const bin = new Uint8Array(offset + ((4 - (offset % 4)) % 4));
  let o = 0;
  for (const p of parts) { bin.set(p, o); o += p.byteLength; }
  const gltf = {
    asset: { version: "2.0", generator: "booksea " + PACK_VERSION + " / " + out.version },
    scene: 0, scenes: [{ name: "floor", nodes: nodes.map((_, i) => i) }], nodes, meshes, accessors,
    bufferViews: views.map((v) => ({ buffer: 0, ...v })), buffers: [{ byteLength: bin.byteLength }],
  };
  let json = new TextEncoder().encode(JSON.stringify(gltf));
  const jpad = (4 - (json.byteLength % 4)) % 4;
  if (jpad) { const j = new Uint8Array(json.byteLength + jpad); j.set(json); j.fill(0x20, json.byteLength); json = j; }
  const total = 12 + 8 + json.byteLength + 8 + bin.byteLength;
  const glb = new Uint8Array(total), dv = new DataView(glb.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, json.byteLength, true); dv.setUint32(16, 0x4e4f534a, true); glb.set(json, 20);
  const b = 20 + json.byteLength;
  dv.setUint32(b, bin.byteLength, true); dv.setUint32(b + 4, 0x004e4942, true); glb.set(bin, b + 8);
  // Texture layers.
  const S = out.textures.size, L = out.textures.layers.length;
  const tex = new Uint8Array(S * S * 4 * L);
  out.textures.layers.forEach((l, i) => tex.set(l.data, i * S * S * 4));
  const meta = JSON.stringify({
    version: PACK_VERSION, kernel: out.version, fingerprint: out.fingerprint, quality: out.quality,
    textures: { size: S, count: L, ids: out.textures.layers.map((l) => l.id) },
    lighting: out.lighting, camera: out.camera, sky: out.sky, enterable: out.enterable,
    lights: out.lights.slice(0, 64), chunks: table, stats: out.stats, glbBytes: glb.byteLength,
  });
  return { glb, tex, meta };
}
