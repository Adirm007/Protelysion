// Outdoor terrain: terrace levels first, then water / chasm / islands, then the built boundary.
// Every archetype produces a level field; heights are quantized so walls and stairs read clearly.
import { Noise, SURFACE, label, DIRS, type Grid } from "./grid";
import type { Draft } from "./draft";
import type { Random } from "./geometry";

const S = SURFACE;
export type TerrainPlan = {
  levelHeights: number[];
  block: number;
  margin: number;
};

function smoothLevels(g: Grid, lv: Int8Array, passes: number) {
  const tmp = new Int8Array(lv.length);
  for (let p = 0; p < passes; p++) {
    tmp.set(lv);
    for (let z = 1; z < g.h - 1; z++) for (let x = 1; x < g.w - 1; x++) {
      const k = g.i(x, z);
      if (lv[k]! < 0) continue;
      const counts = new Map<number, number>();
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const v = lv[g.i(x + dx, z + dz)]!;
        if (v >= 0) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      let best = lv[k]!, bc = counts.get(best) ?? 0;
      for (const [v, c] of counts) if (c > bc + 1) { best = v; bc = c; }
      tmp[k] = best;
    }
    lv.set(tmp);
  }
}

/** Merge terrace components smaller than `min` cells into their most common neighbour level. */
function mergeSmall(g: Grid, lv: Int8Array, min: number) {
  for (let pass = 0; pass < 3; pass++) {
    const { lab, sizes } = label(g, (k) => lv[k]! >= 0, (a, b) => lv[a] === lv[b]);
    let changed = false;
    const repl = new Map<number, number>();
    for (let k = 0; k < g.n; k++) {
      const id = lab[k]!;
      if (id < 0 || sizes[id]! >= min || repl.has(id)) continue;
      const x = k % g.w, z = (k / g.w) | 0, votes = new Map<number, number>();
      // Collect neighbour levels of the whole component (sampled from this seed cell's BFS region).
      const stack = [k], seen = new Set([k]);
      while (stack.length) {
        const p = stack.pop()!, px = p % g.w, pz = (p / g.w) | 0;
        for (const [dx, dz] of DIRS) {
          const nx = px + dx, nz = pz + dz;
          if (!g.in(nx, nz)) continue;
          const q = g.i(nx, nz);
          if (lab[q] === id) { if (!seen.has(q)) { seen.add(q); stack.push(q); } }
          else if (lv[q]! >= 0) votes.set(lv[q]!, (votes.get(lv[q]!) ?? 0) + 1);
        }
      }
      let best = -1, bc = -1;
      for (const [v, c] of votes) if (c > bc) { best = v; bc = c; }
      if (best >= 0) { repl.set(id, best); changed = true; }
      void x; void z;
    }
    if (!changed) break;
    for (let k = 0; k < g.n; k++) { const r = repl.get(lab[k]!); if (r !== undefined) lv[k] = r; }
  }
}

/** Upsample a block-resolution level field so walls run on a coarse architectural grid. */
function blockField(g: Grid, block: number, margin: number, f: (x: number, z: number) => number, levels: number, jitter: Noise | null) {
  const lv = new Int8Array(g.n).fill(-1);
  for (let z = margin; z < g.h - margin; z++) for (let x = margin; x < g.w - margin; x++) {
    let bx = Math.floor((x - margin) / block) * block + margin + block / 2;
    let bz = Math.floor((z - margin) / block) * block + margin + block / 2;
    if (jitter) { bx += (jitter.at(x * 0.31, z * 0.31) - 0.5) * block * 0.9; bz += (jitter.at(x * 0.29 + 40, z * 0.33) - 0.5) * block * 0.9; }
    const v = Math.max(0, Math.min(0.9999, f(bx, bz)));
    lv[g.i(x, z)] = Math.floor(v * levels);
  }
  return lv;
}

export function levelHeights(r: Random, count: number, lo: number, hi: number): number[] {
  const out = [0];
  for (let i = 1; i < count; i++) out.push(Math.round((out[i - 1]! + r.range(lo, hi)) * 4) / 4);
  return out;
}

function applyLevels(d: Draft, lv: Int8Array, heights: number[], groundCode: string) {
  const g = d.g;
  for (let k = 0; k < g.n; k++) {
    const l = lv[k]!;
    if (l < 0) continue;
    g.lvl[k] = l;
    g.ground(k, groundCode, heights[l]!);
  }
  d.levels = heights.slice();
}

/** Mark the outer ring as built boundary; its rendered height is decided by the kernel from neighbours. */
function boundary(g: Grid, margin: number) {
  for (let z = 0; z < g.h; z++) for (let x = 0; x < g.w; x++) {
    if (g.inner(x, z, margin)) continue;
    const k = g.i(x, z);
    g.block(k, S.bound);
    g.lvl[k] = -1;
  }
}

function carveBand(d: Draft, horizontal: boolean, pos: number, width: number, wobble: Noise, code: string, top: number) {
  const g = d.g, cells: number[] = [];
  const len = horizontal ? g.w : g.h;
  for (let t = 0; t < len; t++) {
    const centre = pos + (wobble.fbm(t * 0.07, pos * 0.1) - 0.5) * width * 1.6;
    for (let o = -Math.floor(width / 2); o < Math.ceil(width / 2); o++) {
      const x = horizontal ? t : Math.round(centre + o), z = horizontal ? Math.round(centre + o) : t;
      if (!g.inner(x, z, 2)) continue;
      const k = g.i(x, z);
      g.block(k, code, top);
      g.lvl[k] = -1;
      cells.push(k);
    }
  }
  return cells;
}

export function outdoorTerrain(d: Draft): TerrainPlan {
  const g = d.g, r = d.stream("terrain"), n1 = new Noise(r.int(1, 1 << 30)), n2 = new Noise(r.int(1, 1 << 30));
  const W = g.w, H = g.h, margin = 2;
  const back = (z: number) => 1 - (z - margin) / (H - 2 * margin); // 1 at the back (north), 0 at the front
  const side = r.pick([-1, 1]);
  let heights: number[], block: number, lv: Int8Array;
  const ground = S.ground;
  switch (d.archetype) {
    case "town": {
      const L = r.int(3, 4);
      heights = levelHeights(r, L, 1.5, 2.0);
      block = 4;
      const hx = r.range(0.25, 0.75) * W, hz = r.range(0.15, 0.45) * H;
      lv = blockField(g, block, margin, (x, z) => {
        const hill = Math.exp(-(((x - hx) / (W * 0.45)) ** 2 + ((z - hz) / (H * 0.5)) ** 2));
        const lateral = side > 0 ? x / W : 1 - x / W;
        return back(z) * 0.62 + hill * 0.22 + lateral * 0.12 + (n1.fbm(x * 0.08, z * 0.08) - 0.5) * 0.28;
      }, L, null);
      smoothLevels(g, lv, 1);
      mergeSmall(g, lv, 30);
      applyLevels(d, lv, heights, ground);
      d.landMode = "solid";
      break;
    }
    case "canal": {
      const L = 3;
      heights = levelHeights(r, L, 1.25, 1.7).map((h) => h + 0.9);
      block = 4;
      lv = blockField(g, block, margin, (x, z) => back(z) * 0.55 + (n1.fbm(x * 0.07, z * 0.07) - 0.5) * 0.35 + 0.2, L, null);
      smoothLevels(g, lv, 1);
      mergeSmall(g, lv, 30);
      applyLevels(d, lv, heights, ground);
      d.waterY = -0.2;
      const horizontal = r.next() < 0.6;
      const pos = horizontal ? Math.round(H * r.range(0.42, 0.6)) : Math.round(W * r.range(0.35, 0.65));
      carveBand(d, horizontal, pos, r.int(4, 5), n2, S.water, d.waterY);
      if (r.next() < 0.5) carveBand(d, !horizontal, horizontal ? Math.round(W * r.range(0.3, 0.7)) : Math.round(H * r.range(0.25, 0.4)), 3, n1, S.water, d.waterY);
      d.landMode = "canal";
      break;
    }
    case "cliff": {
      const L = r.int(4, 5);
      heights = levelHeights(r, L, 1.6, 2.3).map((h) => h + 1.2);
      block = 3;
      const coastLeft = side < 0;
      lv = blockField(g, block, margin, (x, z) => {
        const lat = coastLeft ? x / W : 1 - x / W;
        return back(z) * 0.5 + lat * 0.38 + (n1.fbm(x * 0.09, z * 0.09) - 0.5) * 0.3;
      }, L, n2);
      smoothLevels(g, lv, 2);
      mergeSmall(g, lv, 26);
      applyLevels(d, lv, heights, ground);
      // Sea on the low side, running the full depth of the map.
      d.waterY = -0.4;
      for (let z = margin; z < H - margin; z++) {
        const edge = Math.round(W * 0.16 + (n2.fbm(z * 0.08, 3.3) - 0.5) * 8);
        for (let t = margin; t < edge; t++) {
          const x = coastLeft ? t : W - 1 - t, k = g.i(x, z);
          g.block(k, S.water, d.waterY); g.lvl[k] = -1;
        }
      }
      d.landMode = "coast";
      break;
    }
    case "canyon": {
      const L = r.int(4, 5);
      heights = levelHeights(r, L, 1.4, 2.2);
      block = 2;
      lv = blockField(g, block, margin, (x, z) => back(z) * 0.45 + (n1.fbm(x * 0.06, z * 0.06) - 0.5) * 0.7 + 0.1, L, n2);
      smoothLevels(g, lv, 3);
      mergeSmall(g, lv, 28);
      applyLevels(d, lv, heights, ground);
      // A chasm crossing the map, spanned later by timber bridges.
      if (r.next() < 0.75) carveBand(d, r.next() < 0.5, Math.round((r.next() < 0.5 ? W : H) * r.range(0.4, 0.6)), 3, n2, S.pit, -6);
      d.landMode = "chasm";
      break;
    }
    case "grove": {
      const L = r.int(3, 4);
      heights = levelHeights(r, L, 1.1, 1.6);
      block = 2;
      lv = blockField(g, block, margin, (x, z) => back(z) * 0.4 + (n1.fbm(x * 0.05, z * 0.05) - 0.5) * 0.8 + 0.3, L, n2);
      smoothLevels(g, lv, 3);
      mergeSmall(g, lv, 30);
      applyLevels(d, lv, heights, ground);
      d.waterY = heights[0]! - 0.55;
      if (r.next() < 0.7) carveBand(d, r.next() < 0.5, Math.round(W * r.range(0.3, 0.7)), 2, n2, S.water, d.waterY);
      d.landMode = "solid";
      break;
    }
    case "isles": {
      heights = [0];
      block = 1;
      lv = new Int8Array(g.n).fill(-1);
      // Island centres on a jittered lattice, each at its own height.
      const cols = W > 50 ? 3 : 2, rows = 3, isl: { x: number; z: number; rx: number; rz: number; h: number }[] = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        if (r.next() < 0.12 && isl.length > 2) continue;
        const cx = margin + ((i + 0.5) / cols) * (W - 2 * margin) + r.range(-3, 3);
        const cz = margin + ((j + 0.5) / rows) * (H - 2 * margin) + r.range(-2, 2);
        isl.push({ x: cx, z: cz, rx: r.range(5.5, 8.5), rz: r.range(4.5, 7), h: Math.round(((rows - 1 - j) * 1.2 + r.range(0, 1.4)) * 4) / 4 });
      }
      const hs = [...new Set(isl.map((s) => s.h))].sort((a, b) => a - b);
      heights = hs;
      for (let z = margin; z < H - margin; z++) for (let x = margin; x < W - margin; x++) {
        for (const s of isl) {
          const q = ((x - s.x) / s.rx) ** 2 + ((z - s.z) / s.rz) ** 2 + (n1.at(x * 0.35, z * 0.35) - 0.5) * 0.5;
          if (q < 1) { lv[g.i(x, z)] = hs.indexOf(s.h); break; }
        }
      }
      applyLevels(d, lv, heights, ground);
      for (let k = 0; k < g.n; k++) if (g.lvl[k]! < 0) { g.block(k, S.void, -9); }
      for (const s of isl) d.landmasses.push({ x: Math.round(s.x - s.rx), z: Math.round(s.z - s.rz), w: Math.round(s.rx * 2), d: Math.round(s.rz * 2) });
      d.landMode = "islands";
      break;
    }
    case "works":
    default: {
      heights = [0, r.range(1.8, 2.2), r.range(3.6, 4.2)].map((h) => Math.round(h * 4) / 4);
      block = 4;
      const horizontal = r.next() < 0.5;
      lv = blockField(g, block, margin, (x, z) => {
        const t = horizontal ? Math.abs(z - H * 0.55) / (H * 0.5) : Math.abs(x - W * 0.5) / (W * 0.5);
        return 0.15 + t * 0.7 + back(z) * 0.25 + (n1.fbm(x * 0.1, z * 0.1) - 0.5) * 0.2;
      }, 3, null);
      smoothLevels(g, lv, 1);
      mergeSmall(g, lv, 30);
      applyLevels(d, lv, heights, S.grate);
      for (let k = 0; k < g.n; k++) if (g.lvl[k] === 0) g.surf[k] = S.ground.charCodeAt(0);
      d.landMode = "solid";
      break;
    }
  }
  boundary(g, margin);
  d.levels = heights;
  return { levelHeights: heights, block, margin };
}

/** Bridges across water / pits / void between walkable banks. Heights ramp ≤ 0.5 m per cell. */
export function bridges(d: Draft, maxSpan: number, count: number, widths: number[]) {
  const g = d.g, r = d.stream("bridges"), made: { cells: number[] }[] = [];
  type Site = { cells: number[]; a: number; b: number; hs: number[]; score: number; axis: "x" | "z" };
  const sites: Site[] = [];
  const gap = (k: number) => { const c = g.code(k); return c === S.water || c === S.pit || c === S.void; };
  for (const axis of ["x", "z"] as const) {
    for (let z = 3; z < g.h - 3; z++) for (let x = 3; x < g.w - 3; x++) {
      const a = g.i(x, z);
      if (!g.walk[a]) continue;
      const [dx, dz] = axis === "x" ? [1, 0] : [0, 1];
      if (!gap(g.i(x + dx, z + dz))) continue;
      let t = 1;
      while (t <= maxSpan + 1 && g.inner(x + dx * t, z + dz * t, 2) && gap(g.i(x + dx * t, z + dz * t))) t++;
      if (t > maxSpan + 1 || t < 2) continue;
      const bx = x + dx * t, bz = z + dz * t;
      if (!g.inner(bx, bz, 2)) continue;
      const b = g.i(bx, bz);
      if (!g.walk[b]) continue;
      const span = t - 1, h0 = g.top[a]!, h1 = g.top[b]!;
      if (Math.abs(h1 - h0) > 0.5 * (span + 1) - 0.01) continue;
      for (const w of widths) {
        const cells: number[] = [];
        let ok = true;
        const px = dz, pz = dx;
        for (let o = 0; o < w && ok; o++) {
          const ax = x + px * o, az = z + pz * o, bbx = bx + px * o, bbz = bz + pz * o;
          if (!g.inner(ax, az, 2) || !g.inner(bbx, bbz, 2)) { ok = false; break; }
          const aa = g.i(ax, az), bb = g.i(bbx, bbz);
          if (!g.walk[aa] || !g.walk[bb] || Math.abs(g.top[aa]! - h0) > 0.01 || Math.abs(g.top[bb]! - h1) > 0.01) { ok = false; break; }
          for (let s = 1; s <= span; s++) { const c = g.i(ax + dx * s, az + dz * s); if (!gap(c)) { ok = false; break; } cells.push(c); }
        }
        if (!ok) continue;
        const hs: number[] = [];
        const hump = g.code(cells[0]!) === S.water ? Math.min(0.45, span * 0.12) : 0;
        for (let s = 1; s <= span; s++) {
          const t2 = s / (span + 1);
          hs.push(h0 + (h1 - h0) * t2 + Math.sin(Math.PI * t2) * hump);
        }
        sites.push({ cells, a, b, hs, score: r.next() + (w >= 2 ? 0.5 : 0) - span * 0.05, axis });
      }
    }
  }
  sites.sort((p, q) => q.score - p.score);
  const used = new Set<number>();
  for (const s of sites) {
    if (made.length >= count) break;
    if (s.cells.some((c) => used.has(c))) continue;
    // Keep bridges apart.
    let near = false;
    for (const m of made) for (const c of m.cells) for (const e of s.cells) if (Math.abs((c % g.w) - (e % g.w)) + Math.abs(((c / g.w) | 0) - ((e / g.w) | 0)) < 6) near = true;
    if (near) continue;
    const span = s.hs.length, w = s.cells.length / span;
    for (let o = 0; o < w; o++) for (let t = 0; t < span; t++) {
      const k = s.cells[o * span + t]!;
      g.ground(k, S.bridge, s.hs[t]!);
      g.lvl[k] = 0;
      used.add(k);
    }
    made.push({ cells: s.cells });
    const ax = s.a % g.w, az = (s.a / g.w) | 0, bx = s.b % g.w, bz = (s.b / g.w) | 0;
    d.roads.push({ id: `bridge${made.length - 1}`, kind: "bridge", width: w, points: [{ x: ax, z: az }, { x: bx, z: bz }] });
  }
  return made.length;
}
