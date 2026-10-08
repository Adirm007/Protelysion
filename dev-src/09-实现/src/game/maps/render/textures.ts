// Deterministic pixel-art material synthesiser (32 px per metre, 64×64 tiles = 2 m, seamless).
// Every material is drawn from a hue-shifted 6-step ramp built from the theme palette: cool shadows,
// warm highlights, per-unit variation (each brick / stone / plank differs), cracks, stains and moss.
// Output: RGBA8 layers for a texture array + a per-layer "emissive/specular" hint.
import { hex, ramp, shade, mixc, desaturate, type RGB } from "./color";
import type { MaterialId, Palette, ThemeDesign } from "../themes";
import { kitFor } from "../kits";

export const TEX = 64;
export type Layer = { id: string; data: Uint8Array; emissive?: boolean; alpha?: boolean; course?: [number, number] };
/** Geometric roof courses per roof texture: [course length in horizontal metres, lip height]. Course length is
 * a whole number of painted rows (V runs 0.6 texture tiles per horizontal metre → 8 px row ≈ 0.208 m). */
export function roofCourse(kind: string): [number, number] | undefined {
  switch (kind) {
    case "terracotta": case "barrel": case "glazed": return [0.2083, 0.05];
    case "slate": return [0.3125, 0.035];
    case "shingle": case "shellroof": case "shell": return [0.2083, 0.04];
    case "thatch": return [0.5208, 0.1];
    default: return undefined;
  }
}

class Px {
  data = new Uint8Array(TEX * TEX * 4);
  set(x: number, y: number, c: RGB, a = 255) {
    x = ((x % TEX) + TEX) % TEX; y = ((y % TEX) + TEX) % TEX;
    const i = (y * TEX + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = a;
  }
  get(x: number, y: number): RGB {
    x = ((x % TEX) + TEX) % TEX; y = ((y % TEX) + TEX) % TEX;
    const i = (y * TEX + x) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!];
  }
  alpha(x: number, y: number) { x = ((x % TEX) + TEX) % TEX; y = ((y % TEX) + TEX) % TEX; return this.data[(y * TEX + x) * 4 + 3]!; }
  fill(c: RGB) { for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) this.set(x, y, c); }
  clear() { this.data.fill(0); }
}
/** Small deterministic hash-based RNG per material. */
class R {
  s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  n() { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  i(a: number, b: number) { return a + Math.floor(this.n() * (b - a + 1)); }
}
const h2 = (x: number, y: number, s: number) => {
  let h = Math.imul(((x % TEX) + TEX) % TEX, 374761393) ^ Math.imul(((y % TEX) + TEX) % TEX, 668265263) ^ s;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Tileable value noise (period TEX / cell). */
function tnoise(x: number, y: number, cell: number, s: number) {
  const p = TEX / cell, fx = x / cell, fy = y / cell;
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const L = (a: number, b: number) => h2(((a % p) + p) % p * 7, ((b % p) + p) % p * 13, s);
  const a = L(ix, iy), b = L(ix + 1, iy), c = L(ix, iy + 1), d = L(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x: number, y: number, s: number) => tnoise(x, y, 16, s) * 0.5 + tnoise(x, y, 8, s + 1) * 0.3 + tnoise(x, y, 4, s + 2) * 0.2;
/** 4×4 Bayer ordered dither threshold in [0,1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
/** Pick a ramp colour for a continuous shade value v∈[0,5] with ordered dithering between steps. */
function rampAt(rp: RGB[], v: number, x: number, y: number): RGB {
  v = Math.max(0, Math.min(5, v));
  const lo = Math.floor(v), f = v - lo;
  return rp[Math.min(5, f > bayer(x, y) ? lo + 1 : lo)]!;
}

// ------------------------------------------------------------------------------------------------
// Pattern painters. Each receives the base colour and returns a filled Px.
type Painter = (p: Px, base: RGB, r: R, pal: Palette, seed: number) => void;

/** Irregular units on rows (bricks/stones): per-unit tone, bevel light top-left, shadow bottom-right. */
function units(p: Px, base: RGB, r: R, seed: number, opt: { rowH: number[]; minW: number; maxW: number; mortar: RGB; bevel: number; round?: boolean; jitter?: number; crack?: number; moss?: RGB | null }) {
  const rp = ramp(base);
  p.fill(opt.mortar);
  let y = 0, row = 0;
  const rows: { y: number; h: number }[] = [];
  while (y < TEX) { const h = opt.rowH[row % opt.rowH.length]!; rows.push({ y, h: Math.min(h, TEX - y) }); y += h; row++; }
  // Make rows tile: last row absorbs the remainder.
  for (const rw of rows) {
    let x = r.i(0, opt.maxW);
    const start = x;
    while (x < start + TEX) {
      const w = Math.min(r.i(opt.minW, opt.maxW), start + TEX - x);
      if (w < 2) break;
      const tone = (r.n() - 0.5) * 1.3 + (opt.jitter ?? 0) * (r.n() - 0.5);
      const hueShift = r.n();
      for (let yy = 1; yy < rw.h; yy++) for (let xx = 1; xx < w; xx++) {
        const px = x + xx, py = rw.y + yy;
        if (opt.round) {
          const cx = (xx - w / 2) / (w / 2), cy = (yy - rw.h / 2) / (rw.h / 2);
          if (cx * cx + cy * cy > 1.05 + h2(px, py, seed) * 0.25) continue;
        }
        let v = 3 + tone;
        if (yy === 1 || xx === 1) v += opt.bevel;
        if (yy === rw.h - 1 || xx === w - 1) v -= opt.bevel * 1.2;
        v += (fbm(px, py, seed) - 0.5) * 1.1;
        let c = rampAt(rp, v, px, py);
        if (hueShift < 0.12) c = mixc(c, shade(c, -0.25), 0.5);
        if (opt.moss && yy >= rw.h - 2 && h2(px, py, seed + 9) < 0.35) c = mixc(c, opt.moss, 0.6);
        p.set(px, py, c);
      }
      // Occasional crack.
      if (opt.crack && r.n() < opt.crack) {
        let cx = x + r.i(2, Math.max(2, w - 2)), cy = rw.y + 1;
        for (let t = 0; t < rw.h - 1; t++) { p.set(cx, cy + t, rp[0]!); if (r.n() < 0.4) cx += r.n() < 0.5 ? -1 : 1; }
      }
      x += w;
    }
  }
}

function planks(p: Px, base: RGB, r: R, seed: number, opt: { w: number; vertical?: boolean; seamDark?: number; knots?: number; weather?: number }) {
  const rp = ramp(base);
  const n = Math.round(TEX / opt.w);
  for (let i = 0; i < n; i++) {
    const tone = (r.n() - 0.5) * 1.2;
    const cut = r.i(0, TEX - 1);
    const grainSeed = r.i(1, 1 << 20);
    for (let t = 0; t < TEX; t++) for (let s = 0; s < opt.w; s++) {
      const [x, y] = opt.vertical ? [i * opt.w + s, t] : [t, i * opt.w + s];
      const grain = Math.sin((t * 0.35 + tnoise(t, s * 8, 8, grainSeed) * 4)) * 0.35;
      let v = 3 + tone + grain + (fbm(x, y, seed) - 0.5) * 0.8;
      if (s === 0) v += 0.9;
      if (s === opt.w - 1) v -= 1.6 * (opt.seamDark ?? 1);
      if (t === cut || t === (cut + 1) % TEX) v -= s === 0 ? 0 : 1.4;
      if (opt.weather && h2(x, y, seed + 3) < opt.weather) v -= 0.8;
      p.set(x, y, rampAt(rp, v, x, y));
    }
    for (let k = 0; k < (opt.knots ?? 1); k++) if (r.n() < 0.5) {
      const kt = r.i(0, TEX - 1), ks = r.i(1, opt.w - 2);
      const [x, y] = opt.vertical ? [i * opt.w + ks, kt] : [kt, i * opt.w + ks];
      p.set(x, y, rp[0]!); p.set(x + 1, y, rp[1]!);
    }
  }
}

function ground(p: Px, base: RGB, seed: number, opt: { blades?: RGB; pebbles?: number; flowers?: RGB[]; contrast?: number; patch?: RGB }) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let v = 3 + (fbm(x, y, seed) - 0.5) * 2.4 * (opt.contrast ?? 1) + (tnoise(x, y, 2, seed + 5) - 0.5) * 0.9;
    let c = rampAt(rp, v, x, y);
    if (opt.patch && tnoise(x, y, 16, seed + 11) > 0.66) c = mixc(c, opt.patch, 0.55);
    p.set(x, y, c);
  }
  if (opt.blades) {
    const br = ramp(opt.blades);
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(h2(i, 1, seed) * TEX), y = Math.floor(h2(i, 2, seed) * TEX), l = 1 + Math.floor(h2(i, 3, seed) * 3);
      for (let t = 0; t < l; t++) p.set(x + (t === l - 1 && h2(i, 4, seed) < 0.5 ? 1 : 0), y - t, br[Math.min(5, 3 + t)]!);
      p.set(x, y + 1, br[1]!);
    }
  }
  if (opt.pebbles) {
    for (let i = 0; i < opt.pebbles; i++) {
      const x = Math.floor(h2(i, 7, seed) * TEX), y = Math.floor(h2(i, 8, seed) * TEX);
      p.set(x, y, rp[4]!); p.set(x + 1, y, rp[3]!); p.set(x, y + 1, rp[1]!); p.set(x + 1, y + 1, rp[0]!);
    }
  }
  if (opt.flowers) for (let i = 0; i < 26; i++) {
    const x = Math.floor(h2(i, 17, seed) * TEX), y = Math.floor(h2(i, 18, seed) * TEX), c = opt.flowers[i % opt.flowers.length]!;
    p.set(x, y, c); p.set(x + 1, y, shade(c, -0.3)); p.set(x, y - 1, shade(c, 0.3));
  }
}

function tiles(p: Px, base: RGB, seed: number, opt: { size: number; grout: RGB; alt?: RGB; gloss?: boolean; checker?: boolean }) {
  const rp = ramp(base), ra = opt.alt ? ramp(opt.alt) : rp;
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const tx = Math.floor(x / opt.size), ty = Math.floor(y / opt.size), lx = x % opt.size, ly = y % opt.size;
    if (lx === 0 || ly === 0) { p.set(x, y, opt.grout); continue; }
    const useAlt = opt.checker && (tx + ty) % 2 === 1;
    const rr = useAlt ? ra : rp;
    let v = 3 + (h2(tx, ty, seed) - 0.5) * 0.9 + (fbm(x, y, seed) - 0.5) * 0.6;
    if (lx === 1 || ly === 1) v += 0.7;
    if (lx === opt.size - 1 || ly === opt.size - 1) v -= 0.8;
    if (opt.gloss && lx > 1 && ly > 1 && lx + ly < 5) v += 1.2;
    p.set(x, y, rampAt(rr, v, x, y));
  }
}

function roofTiles(p: Px, base: RGB, r: R, seed: number, opt: { kind: "barrel" | "slate" | "shingle" | "thatch" | "metal" | "glazed" | "tent" | "shell" }) {
  const rp = ramp(base);
  if (opt.kind === "barrel" || opt.kind === "glazed") {
    // Rows of curved tiles (course 8 px tall, tiles 8 px wide, staggered): bright crown, dark trough.
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const row = Math.floor(y / 8), ly = y % 8, off = (row % 2) * 4, lx = (x + off) % 8;
      const crown = Math.cos(((lx + 0.5) / 8) * Math.PI * 2);
      let v = 3 + crown * 1.3 - (ly >= 6 ? 1.2 : 0) + (ly === 0 ? -1.4 : 0) + (h2(Math.floor((x + off) / 8), row, seed) - 0.5) * 0.9;
      if (opt.kind === "glazed" && lx === 3 && ly > 1 && ly < 5) v += 1.4;
      p.set(x, y, rampAt(rp, v, x, y));
    }
  } else if (opt.kind === "slate" || opt.kind === "shingle" || opt.kind === "shell") {
    const hgt = opt.kind === "slate" ? 6 : 8, wid = opt.kind === "slate" ? 7 : 6;
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const row = Math.floor(y / hgt), ly = y % hgt, off = (row % 2) * Math.floor(wid / 2), cell = Math.floor((x + off) / wid), lx = (x + off) % wid;
      let v = 3 + (h2(cell, row, seed) - 0.5) * 1.4 - (ly >= hgt - 1 ? 1.6 : 0) + (ly === 0 ? 0.8 : 0) + (lx === 0 ? -0.9 : 0);
      if (opt.kind === "shell") { const cx = (lx - wid / 2) / (wid / 2); if (ly > hgt - 2 - Math.abs(cx) * 2) v -= 1.2; }
      v += (fbm(x, y, seed) - 0.5) * 0.7;
      p.set(x, y, rampAt(rp, v, x, y));
    }
  } else if (opt.kind === "thatch") {
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const strand = Math.sin(x * 1.7 + tnoise(x, y, 4, seed) * 6) * 0.8;
      const row = y % 10;
      let v = 3 + strand - (row >= 8 ? 1.4 : 0) + (fbm(x, y, seed) - 0.5) * 1.2;
      p.set(x, y, rampAt(rp, v, x, y));
    }
  } else if (opt.kind === "tent") {
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const stripe = Math.floor(x / 8) % 2;
      let v = 3 + (stripe ? 0.4 : -0.4) + (fbm(x, y, seed) - 0.5) * 0.6 + (x % 8 === 0 ? -0.8 : 0);
      p.set(x, y, rampAt(stripe ? rp : ramp(shade(base, -0.15)), v, x, y));
    }
  } else {
    // Standing-seam metal.
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const lx = x % 8;
      let v = 3 + (lx === 0 ? 1.6 : lx === 1 ? -1.3 : 0) + (fbm(x, y, seed) - 0.5) * 0.8 + (h2(x >> 3, y >> 4, seed) < 0.15 ? -0.7 : 0);
      p.set(x, y, rampAt(rp, v, x, y));
    }
  }
  void r;
}

function strata(p: Px, base: RGB, seed: number, opt: { bands: number; cracks: number; ice?: boolean }) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const band = Math.sin((y + tnoise(x, y, 16, seed) * 10) * ((Math.PI * 2 * opt.bands) / TEX));
    let v = 3 + band * 0.9 + (fbm(x, y, seed) - 0.5) * 1.6;
    const ch = tnoise(x, y, 8, seed + 3);
    if (Math.abs(ch - 0.5) < 0.03 * opt.cracks) v -= 1.8;
    if (Math.abs(ch - 0.5) < 0.06 * opt.cracks && Math.abs(ch - 0.5) >= 0.03 * opt.cracks) v += 0.6;
    if (opt.ice && tnoise(x, y, 4, seed + 9) > 0.8) v += 1.4;
    p.set(x, y, rampAt(rp, v, x, y));
  }
}

/** Layered sandstone cliff: irregular horizontal beds of varied tone, lit ledge lips over dark undercuts,
 * vertical erosion streaks and a few long fractures (reads as canyon rock, not masonry). */
function sandCliff(p: Px, base: RGB, seed: number) {
  const rp = ramp(base);
  // Irregular bed boundaries (px) within the 64 px (2 m) tile; tone per bed.
  const edges = [0, 13, 21, 37, 46, 64], tone = [0.35, -0.3, 0.55, -0.15, 0.2];
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const warp = (tnoise(x, 0, 32, seed + 2) - 0.5) * 5 + Math.sin((x / TEX) * Math.PI * 2 + seed) * 1.5;
    const yy = (((y + warp) % TEX) + TEX) % TEX;
    let b = 0;
    while (b < tone.length - 1 && yy >= edges[b + 1]!) b++;
    const d0 = yy - edges[b]!, d1 = edges[b + 1]! - yy;
    let v = 3 + tone[b]! + (fbm(x, y, seed) - 0.5) * 1.0 + (tnoise(x, y, 4, seed + 7) - 0.5) * 0.5;
    if (d0 < 1.6) v += 0.8; // lit ledge lip on top of each bed
    else if (d1 < 2.2) v -= 1.0 + (2.2 - d1) * 0.3; // undercut shadow below the next lip
    const streak = tnoise(x * 1.5, y * 0.12, 16, seed + 5);
    if (streak > 0.7) v -= (streak - 0.7) * 3.5;
    const fr = tnoise(x, y, 32, seed + 9);
    if (Math.abs(fr - 0.5) < 0.01 && tnoise(x, y, 16, seed + 11) > 0.55) v -= 1.5;
    p.set(x, y, rampAt(rp, v, x, y));
  }
}

function plaster(p: Px, base: RGB, seed: number, opt: { stain?: boolean; patches?: RGB; lines?: boolean; patchT?: number }) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let v = 3 + (fbm(x, y, seed) - 0.5) * 0.9 + (tnoise(x, y, 2, seed + 4) - 0.5) * 0.5;
    if (opt.stain) v -= Math.max(0, tnoise(x, y, 16, seed + 7) - 0.6) * 3;
    let c = rampAt(rp, v, x, y);
    // Exposed brick where the render has fallen off.
    if (opt.patches && tnoise(x, y, 16, seed + 13) > (opt.patchT ?? 0.74)) {
      const row = Math.floor(y / 4), off = (row % 2) * 4;
      const br = ramp(opt.patches);
      c = y % 4 === 0 || (x + off) % 8 === 0 ? br[0]! : rampAt(br, 3 + (h2((x + off) >> 3, row, seed) - 0.5), x, y);
    }
    if (opt.lines && y % 16 === 15) c = rp[1]!;
    p.set(x, y, c);
  }
}

function fabric(p: Px, base: RGB, seed: number, opt: { pattern: "carpet" | "wallpaper" | "velvet" | "cloth" | "plain" | "faded"; accent: RGB }) {
  const rp = ramp(base), ra = ramp(opt.accent);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let v = 3 + (tnoise(x, y, 2, seed) - 0.5) * 0.8;
    let c: RGB;
    if (opt.pattern === "wallpaper") {
      const stripe = x % 16 < 2;
      const motif = ((x % 16) - 8) ** 2 + ((y % 16) - 8) ** 2 < 6 && (x % 16) >= 5;
      v += (fbm(x, y, seed) - 0.5) * 0.5;
      c = stripe ? ra[2]! : motif ? ra[3]! : rampAt(rp, v, x, y);
    } else if (opt.pattern === "carpet") {
      const border = x % 32 < 3 || y % 32 < 3;
      const diamond = Math.abs((x % 32) - 16) + Math.abs((y % 32) - 16) < 6;
      c = border ? rampAt(ra, v, x, y) : diamond ? rampAt(ra, v + 0.8, x, y) : rampAt(rp, v, x, y);
    } else if (opt.pattern === "plain") {
      // Worn, damp moquette: fibre noise + large faint stains.
      v += (tnoise(x, y, 1, seed + 3) - 0.5) * 0.7 - Math.max(0, tnoise(x, y, 16, seed + 9) - 0.62) * 2.4;
      c = rampAt(rp, v, x, y);
    } else if (opt.pattern === "faded") {
      // Low-contrast vertical wallpaper (thin darker pinstripes, tiny motif).
      const stripe = x % 8 === 0;
      const motif = x % 8 === 4 && y % 8 === 3;
      v += (fbm(x, y, seed) - 0.5) * 0.35 - (stripe ? 0.55 : 0) + (motif ? 0.4 : 0) - Math.max(0, tnoise(x, y, 16, seed + 5) - 0.7) * 1.8;
      c = rampAt(rp, v, x, y);
    } else if (opt.pattern === "velvet") {
      v += Math.sin(x * 0.5) * 0.9;
      c = rampAt(rp, v, x, y);
    } else {
      v += (x + y) % 4 === 0 ? -0.6 : 0;
      c = rampAt(rp, v, x, y);
    }
    p.set(x, y, c);
  }
}

function metal(p: Px, base: RGB, seed: number, opt: { rivets?: boolean; grate?: boolean; corrugated?: boolean; panel?: number; rust?: RGB; rustT?: number }) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let v = 3 + (fbm(x, y, seed) - 0.5) * 0.7;
    if (opt.corrugated) v += Math.sin((x / 4) * Math.PI) * 1.2;
    if (opt.panel) { const lx = x % opt.panel, ly = y % opt.panel; if (lx === 0 || ly === 0) v -= 1.8; if (lx === 1 || ly === 1) v += 0.9; if (opt.rivets && (lx === 3 || lx === opt.panel - 3) && (ly === 3 || ly === opt.panel - 3)) v += 2; }
    if (opt.grate) { const lx = x % 6, ly = y % 6; if (lx < 2 || ly < 2) v += 0.8; else v -= 2.2; }
    let c = rampAt(rp, v, x, y);
    if (opt.rust && tnoise(x, y, 8, seed + 5) > (opt.rustT ?? 0.7)) c = mixc(c, opt.rust, 0.55);
    p.set(x, y, c);
  }
}

function crystal(p: Px, base: RGB, seed: number) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const a = Math.floor((x + y * 0.6) / 10), b = Math.floor((x * 0.7 - y) / 12);
    let v = 3 + (h2(a, b, seed) - 0.5) * 2.2 + (tnoise(x, y, 4, seed) - 0.5) * 0.6;
    if ((x + y * 0.6) % 10 < 1) v += 1.6;
    p.set(x, y, rampAt(rp, v, x, y));
  }
}

function organic(p: Px, base: RGB, seed: number, veins: RGB) {
  const rp = ramp(base), rv = ramp(veins);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const n = tnoise(x, y, 16, seed), m = tnoise(x, y, 8, seed + 3);
    let c = rampAt(rp, 3 + (n - 0.5) * 2 + (tnoise(x, y, 2, seed + 1) - 0.5) * 0.6, x, y);
    if (Math.abs(m - 0.5) < 0.035) c = rv[1]!;
    else if (Math.abs(m - 0.5) < 0.06) c = rv[3]!;
    p.set(x, y, c);
  }
}

function paperStack(p: Px, base: RGB, seed: number, text: boolean) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let v = 3.3 + (tnoise(x, y, 4, seed) - 0.5) * 0.5;
    if (y % 3 === 0) v -= 1.1;
    if (text && y % 3 === 1 && x % 16 > 2 && x % 16 < 14 && h2(x >> 2, y, seed) > 0.4) v -= 1.8;
    p.set(x, y, rampAt(rp, v, x, y));
  }
}

function bookshelf(p: Px, base: RGB, seed: number, accent: RGB) {
  const wood = ramp(base);
  const books = [accent, shade(accent, -0.3), [140, 60, 50] as RGB, [70, 90, 120] as RGB, [150, 130, 80] as RGB, [80, 110, 70] as RGB];
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const shelf = y % 16;
    if (shelf >= 14) { p.set(x, y, shelf === 14 ? wood[4]! : wood[1]!); continue; }
    const bi = Math.floor(x / 3) + Math.floor(y / 16) * 7;
    const c = books[Math.floor(h2(bi, 3, seed) * books.length)]!;
    const bh = 9 + Math.floor(h2(bi, 5, seed) * 4);
    if (shelf < 14 - bh) { p.set(x, y, wood[0]!); continue; }
    const lx = x % 3;
    const br = ramp(c);
    p.set(x, y, lx === 0 ? br[4]! : lx === 2 ? br[1]! : shelf === 14 - bh + 2 ? br[5]! : br[3]!);
  }
}

function waterTex(p: Px, base: RGB, seed: number) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const w = Math.sin(x * 0.2 + tnoise(x, y, 16, seed) * 5) + Math.sin(y * 0.3 + x * 0.1);
    let v = 3 + w * 0.5 + (tnoise(x, y, 4, seed + 2) - 0.5) * 0.6;
    p.set(x, y, rampAt(rp, v, x, y));
  }
}

function glass(p: Px, base: RGB, seed: number, frame: RGB) {
  const rp = ramp(base), fr = ramp(frame);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const lx = x % 16, ly = y % 32;
    if (lx === 0 || ly === 0) { p.set(x, y, fr[2]!); continue; }
    if (lx === 1 || ly === 1) { p.set(x, y, fr[4]!); continue; }
    let v = 2.6 + (x + y * 0.5) / TEX * 1.5 + ((lx + ly) % 11 === 0 ? 1.6 : 0);
    p.set(x, y, rampAt(rp, v, x, y));
  }
  void seed;
}

/** Foliage / flower / grass cards (alpha-cut). */
function foliageCard(p: Px, base: RGB, seed: number, kind: "leaf" | "flower" | "grass" | "pine", accent: RGB) {
  p.clear();
  const rp = ramp(base);
  if (kind === "grass") {
    for (let i = 0; i < 70; i++) {
      const x0 = 4 + Math.floor(h2(i, 1, seed) * 56), hgt = 10 + Math.floor(h2(i, 2, seed) * 30), lean = (h2(i, 3, seed) - 0.5) * 0.6;
      for (let t = 0; t < hgt; t++) { const x = Math.round(x0 + lean * t), y = TEX - 1 - t; p.set(x, y, rp[Math.min(5, 1 + Math.floor((t / hgt) * 4.5))]!); }
    }
    return;
  }
  if (kind === "pine") {
    for (let y = 0; y < TEX; y++) {
      const tier = (y % 16) / 16, width = (0.15 + (y / TEX) * 0.85) * (0.55 + tier * 0.45) * 30;
      for (let x = 0; x < TEX; x++) {
        const dx = Math.abs(x - 32);
        if (dx > width + (h2(x, y, seed) - 0.5) * 3) continue;
        let v = 3 + (1 - dx / (width + 1)) * 0.8 - tier * 1.4 + (x < 32 ? 0.5 : -0.5) + (h2(x, y, seed + 1) - 0.5) * 0.9;
        p.set(x, y, rampAt(rp, v, x, y));
      }
    }
    return;
  }
  // Leaf clusters: many small blobs lit from top-left.
  const blobs = kind === "flower" ? 26 : 34;
  for (let i = 0; i < blobs; i++) {
    const cx = 8 + h2(i, 1, seed) * 48, cy = 8 + h2(i, 2, seed) * 48, rad = 4 + h2(i, 3, seed) * 6;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (x < 0 || y < 0 || x >= TEX || y >= TEX) continue;
      const dx = (x - cx) / rad, dy = (y - cy) / rad, dd = dx * dx + dy * dy;
      if (dd > 1 - h2(x, y, seed + i) * 0.25) continue;
      let v = 3 + (-dx - dy) * 0.9 + (1 - dd) * 0.5 + (cy / TEX - 0.5) * -1.2 + (h2(x, y, seed + 5) - 0.5) * 0.8;
      p.set(x, y, rampAt(rp, v, x, y));
    }
  }
  if (kind === "flower") for (let i = 0; i < 40; i++) {
    const x = Math.floor(8 + h2(i, 7, seed) * 48), y = Math.floor(8 + h2(i, 8, seed) * 48);
    if (p.alpha(x, y)) { p.set(x, y, accent); p.set(x + 1, y, shade(accent, -0.35)); p.set(x, y - 1, shade(accent, 0.35)); }
  }
}

/** Opaque foliage mass: dark depth base under ~150 overlapping leaf clusters lit from the top-left
 * (tile-wrapped, so crowns and hedges read as painted leaves instead of flat colour). */
function leafMass(p: Px, base: RGB, seed: number) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) p.set(x, y, rampAt(rp, 0.9 + (fbm(x, y, seed) - 0.5) * 1.1, x, y));
  for (let i = 0; i < 150; i++) {
    const cx = h2(i, 1, seed) * TEX, cy = h2(i, 2, seed) * TEX, rad = 2.2 + h2(i, 3, seed) * 2.9;
    const tone = (h2(i, 4, seed) - 0.5) * 0.9, warm = h2(i, 6, seed) < 0.12;
    for (let yy = -Math.ceil(rad); yy <= Math.ceil(rad); yy++) for (let xx = -Math.ceil(rad); xx <= Math.ceil(rad); xx++) {
      const dx = xx / rad, dy = yy / (rad * 0.82), dd = dx * dx + dy * dy;
      if (dd > 1 - h2(xx + i, yy, seed) * 0.2) continue;
      const x = Math.round(cx + xx), y = Math.round(cy + yy);
      let v = 2.9 + tone + (-dx * 0.75 - dy * 0.95) + (1 - dd) * 0.45;
      if (dd > 0.72 && dy > 0) v -= 0.7;
      let c = rampAt(rp, v, x, y);
      if (warm) c = mixc(c, shade(c, 0.25), 0.35);
      p.set(x, y, c);
    }
  }
}

function emissive(p: Px, base: RGB) {
  // Warm lit window glass with mullion shadow and soft gradient.
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const v = 4.3 - (y / TEX) * 1.4 + ((x % 32) < 2 || (y % 32) < 2 ? -2 : 0);
    p.set(x, y, rampAt(rp, v, x, y));
  }
}


// ------------------------------------------------------------------------------------------------
// Architecture painters (hd2d-architecture-2): clapboard, board-and-batten, louvred shutters, awning
// stripes, painted shop signs, paper lattice, neon glyphs, cork.
const lumOf = (c: RGB) => (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;

/** Horizontal clapboard: shadow line under each overlapping board, bright lower lip, grain, paint wear. */
function siding(p: Px, base: RGB, seed: number, opt: { board: number; wear?: RGB; weather?: number }) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const row = Math.floor(y / opt.board), ly = y % opt.board;
    let v = 3.1 + (h2(3, row, seed) - 0.5) * 0.5 + Math.sin(x * 0.45 + tnoise(x, y * 6, 8, seed) * 5) * 0.12 + (fbm(x, y, seed) - 0.5) * 0.5;
    if (ly === 0) v -= 2.0; else if (ly === 1) v -= 0.8; else if (ly === opt.board - 1) v += 0.7;
    if (h2(x >> 4, row, seed + 9) < 0.08 && (x & 15) === 0) v -= 1.2; // butt joints
    let c = rampAt(rp, v, x, y);
    if (opt.wear && tnoise(x, y, 8, seed + 21) > 1 - (opt.weather ?? 0.2) && ly > 1) c = rampAt(ramp(opt.wear), 2.6 + (h2(x, y, seed) - 0.5), x, y);
    p.set(x, y, c);
  }
}
/** Board-and-batten: vertical boards with raised battens every 16 px. */
function batten(p: Px, base: RGB, r: R, seed: number) {
  planks(p, base, r, seed, { w: 8, vertical: true, knots: 1, weather: 0.04, seamDark: 0.7 });
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const lx = x % 16;
    if (lx === 0) p.set(x, y, rampAt(rp, 4.4 + (fbm(x, y, seed) - 0.5), x, y));
    else if (lx === 1 || lx === 2) p.set(x, y, rampAt(rp, 3.6 + (fbm(x, y, seed) - 0.5), x, y));
    else if (lx === 3) p.set(x, y, rp[0]!);
  }
}
/** Two louvred shutter leaves side by side (each 32×64): stiles, rails, slats with shadow. */
function louver(p: Px, base: RGB, seed: number) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const lx = x % 32;
    let v: number;
    const stile = lx < 4 || lx > 27, rail = y < 4 || y > 59 || (y > 29 && y < 34);
    if (stile || rail) v = 3.3 + (lx === 0 || y === 0 ? 1 : 0) + (lx === 31 || y === 63 ? -1.4 : 0);
    else { const ly = y % 4; v = ly === 0 ? 1.4 : ly === 1 ? 4.0 : ly === 2 ? 3.2 : 2.6; if (lx === 4 || lx === 27) v -= 0.8; }
    v += (fbm(x, y, seed) - 0.5) * 0.6 - (tnoise(x, y, 16, seed + 3) > 0.78 ? 0.9 : 0);
    p.set(x, y, rampAt(rp, v, x, y));
  }
}
/** Awning / tent canvas: vertical stripes (accent / cream) with fabric weave and sag shading. */
function stripes(p: Px, a: RGB, b: RGB, seed: number, w = 8) {
  const ra = ramp(a), rb = ramp(b);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const st = Math.floor(x / w) % 2, lx = x % w;
    let v = 3.1 + ((x + y) % 2 ? 0.12 : -0.12) + (fbm(x, y, seed) - 0.5) * 0.5 + Math.cos((lx / w) * Math.PI * 2) * 0.25;
    if (lx === 0) v -= 0.6;
    p.set(x, y, rampAt(st ? rb : ra, v, x, y));
  }
}
/** Shop signs: 2×2 painted boards (inn mug, sword, potion, loaf) on framed wood. */
function signboard(p: Px, wood: RGB, paint: RGB, ink: RGB, seed: number) {
  const rw = ramp(wood), rpnt = ramp(paint), ri = ramp(ink);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const lx = x % 32, ly = y % 32;
    const edge = Math.min(lx, ly, 31 - lx, 31 - ly);
    let c: RGB;
    if (edge < 3) c = rampAt(rw, (edge === 0 ? 1.2 : edge === 1 ? 3.8 : 2.8) + (fbm(x, y, seed) - 0.5) * 0.6, x, y);
    else c = rampAt(rpnt, 3 + (fbm(x, y, seed + 2) - 0.5) * 0.8 - (edge === 3 ? 0.9 : 0), x, y);
    p.set(x, y, c);
  }
  const put = (qx: number, qy: number, pts: string[]) => {
    for (let j = 0; j < pts.length; j++) for (let i = 0; i < pts[j]!.length; i++) {
      const ch = pts[j]![i];
      if (ch === "#") p.set(qx * 32 + 6 + i, qy * 32 + 6 + j, ri[4]!);
      else if (ch === "+") p.set(qx * 32 + 6 + i, qy * 32 + 6 + j, ri[5]!);
      else if (ch === "o") p.set(qx * 32 + 6 + i, qy * 32 + 6 + j, ri[2]!);
    }
  };
  const mug = ["", "", "   +#####+", "   #ooooo#", "   #######", "   ##########", "   #######  #", "   #######  #", "   #######  #", "   #######  #", "   ####### ##", "   #######", "   #######", "    #####", "", "", "  ###########"];
  const sword = ["             ##", "            #+#", "           #+#", "          #+#", "         #+#", "        #+#", "       #+#", "  #   #+#", "   # #+#", "    ##+", "    ###", "   ## ##", "  ##", " ##", ""];
  const potion = ["", "     ###", "     #o#", "     #o#", "    ##o##", "   #ooooo#", "  #ooo+ooo#", "  #oo+++oo#", "  #########", "  #########", "  #########", "   #######", "    #####", ""];
  const loaf = ["", "", "", "     #####", "   #########", "  ###+##+###", " #############", " #############", " #############", "  ###########", "", "", " ###  ###  ###"];
  put(0, 0, mug); put(1, 0, sword); put(0, 1, potion); put(1, 1, loaf);
}
/** Paper lattice (shoji / paper window): warm paper cells with dark wooden bars. */
function lattice(p: Px, paper: RGB, bar: RGB, seed: number, cell = 8) {
  const rp = ramp(paper), rb = ramp(bar);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const lx = x % cell, ly = y % (cell * 2);
    if (lx === 0 || ly === 0) { p.set(x, y, rb[lx === 0 && ly === 0 ? 1 : 2]!); continue; }
    if (lx === 1 || ly === 1) { p.set(x, y, rb[3]!); continue; }
    const v = 3.4 + (fbm(x, y, seed) - 0.5) * 0.5 - (y / TEX) * 0.4 + (h2(x >> 3, y >> 4, seed) - 0.5) * 0.3;
    p.set(x, y, rampAt(rp, v, x, y));
  }
}
/** Neon sign: dark backing with bright glyph strokes and a halo. */
/** 3×5 pixel font for neon signage (rows top→bottom, 3 bits each, MSB = left). */
const FONT3: Record<string, number[]> = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], Y: [5, 5, 2, 2, 2],
  "2": [6, 1, 2, 4, 7], "4": [5, 5, 7, 1, 1], K: [5, 5, 6, 5, 5], G: [3, 4, 5, 5, 3], V: [5, 5, 5, 5, 2],
};
function neonWord(p: Px, word: string, y0: number, r: RGB[]) {
  const cw = 8, x0 = Math.floor((TEX - word.length * cw + 2) / 2);
  [...word].forEach((ch, k) => {
    const g = FONT3[ch];
    if (!g) return;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
      if (!((g[row]! >> (2 - col)) & 1)) continue;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) {
        const x = x0 + k * cw + col * 2 + dx, y = y0 + row * 3 + dy;
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) if (p.get(x + ox, y + oy)[0] < r[2]![0]) p.set(x + ox, y + oy, r[2]!);
      }
    }
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
      if (!((g[row]! >> (2 - col)) & 1)) continue;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) p.set(x0 + k * cw + col * 2 + dx, y0 + row * 3 + dy, dx === 0 && dy === 1 ? r[5]! : r[4]!);
    }
  });
}
/** Neon signage: two readable words (pixel font) as glowing tubes on a dark board with a border tube. */
function neon(p: Px, glow: RGB, alt: RGB, seed: number) {
  const back: RGB = shade(mixc(glow, [20, 20, 30], 0.85), -0.2);
  p.fill(back);
  const rg = ramp(glow), ra = ramp(alt);
  const top = ["MOTEL", "DINER", "HOTEL", "BAR", "CAFE", "GAS"], bot = ["OPEN", "EAT", "24H", "OPEN", "SODA", "TAKE"];
  const k = Math.floor(h2(3, 7, seed) * top.length) % top.length;
  neonWord(p, top[k]!, 7, rg);
  neonWord(p, bot[(k + Math.floor(h2(5, 1, seed) * 3)) % bot.length]!, 39, ra);
  for (let x = 2; x < TEX - 2; x++) { p.set(x, 2, ra[3]!); p.set(x, TEX - 3, ra[3]!); }
  for (let y = 2; y < TEX - 2; y++) { p.set(2, y, ra[3]!); p.set(TEX - 3, y, ra[3]!); }
  for (let x = 6; x < TEX - 6; x += 2) p.set(x, 32, rg[2]!);
}
function cork(p: Px, base: RGB, seed: number) {
  const rp = ramp(base);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let v = 3 + (fbm(x, y, seed) - 0.5) * 1.1 + (h2(x, y, seed) - 0.5) * 1.3;
    if (h2(x, y, seed + 7) < 0.06) v -= 2.2;
    p.set(x, y, rampAt(rp, v, x, y));
  }
}

/** Material slots used by the building grammar ("a_*"), coloured from the theme palette + kit. */
/** Stage curtain: deep velvet folds (6 per tile) with crest highlights, dark troughs and a gold fringe band. */
function curtain(p: Px, base: RGB, seed: number, fringe: RGB) {
  const rp = ramp(base), fr = ramp(fringe);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const f = Math.sin((x / TEX) * Math.PI * 2 * 6 + Math.sin(y * 0.09 + (seed & 7)) * 0.5);
    let v = 2.5 + f * 1.55 + (fbm(x, y, seed) - 0.5) * 0.5 + (f > 0.85 ? 0.5 : 0);
    if (y >= TEX - 7) {
      // Fringe: braid line + hanging tassels.
      if (y === TEX - 7) { p.set(x, y, fr[(x & 1) ? 4 : 3]!); continue; }
      const tassel = (x % 4) < 2;
      if (tassel) { p.set(x, y, rampAt(fr, 3.4 - (y - (TEX - 6)) * 0.35 + ((x % 4) === 0 ? 0.6 : -0.4), x, y)); continue; }
      v -= 1.6;
    }
    p.set(x, y, rampAt(rp, v, x, y));
  }
}
/** Playbill poster: coloured field, border, title bar, a marionette silhouette and text rows. */
function poster(p: Px, paper: RGB, ink: RGB, field: RGB, seed: number) {
  const rp = ramp(paper), rf = ramp(field);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let c = rampAt(rp, 3.2 + (fbm(x, y, seed) - 0.5) * 0.9, x, y);
    const bx = Math.min(x, TEX - 1 - x), by = Math.min(y, TEX - 1 - y);
    if (bx < 2 || by < 2) c = shade(ink, -0.1);
    else if (bx < 4 || by < 4) c = rampAt(rp, 2.4, x, y);
    else if (y >= 6 && y < 16) c = rampAt(rf, 3 + (tnoise(x, y, 4, seed) - 0.5) * 0.8, x, y);
    else if (y >= 18 && y < 50 && x >= 12 && x < 52) c = rampAt(rf, 1.6 + (y - 18) / 32 * 1.5, x, y);
    p.set(x, y, c);
  }
  // Title glyph blocks.
  for (let i = 0; i < 6; i++) for (let yy = 8; yy < 14; yy++) for (let xx = 0; xx < 5; xx++) if (h2(i * 7 + xx, yy, seed) < 0.62) p.set(9 + i * 8 + xx, yy, shade(paper, 0.2));
  // Marionette: control bar, strings, head, body, limbs.
  const ink2 = shade(ink, -0.2);
  for (let x = 22; x <= 42; x++) p.set(x, 20, ink2);
  for (const sx of [24, 32, 40]) for (let y = 21; y < 30; y++) if ((y & 1) === 0) p.set(sx, y, shade(paper, 0.1));
  for (let y = 28; y < 33; y++) for (let x = 30; x < 35; x++) p.set(x, y, ink2);
  for (let y = 33; y < 42; y++) for (let x = 29; x < 36; x++) p.set(x, y, ink2);
  for (let t = 0; t < 7; t++) { p.set(28 - t, 34 + t, ink2); p.set(36 + t, 34 + (t >> 1), ink2); p.set(30 - (t >> 1), 42 + t, ink2); p.set(34 + (t >> 1), 42 + t, ink2); }
  // Text rows.
  for (let r = 0; r < 3; r++) for (let x = 10; x < 54; x++) if (h2(x, r, seed + 5) < 0.7 && (x % 6) !== 0) p.set(x, 53 + r * 3, shade(ink, 0.1));
}
/** Painted scenery flat: sky gradient, cloud, storm bolt, rolling hills and a tree, on canvas. */
function sceneryFlat(p: Px, sky: RGB, hill: RGB, seed: number) {
  const rs = ramp(sky), rh = ramp(hill);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const hy = 40 + Math.sin(x * 0.12 + (seed & 3)) * 5 + Math.sin(x * 0.31) * 2;
    const hy2 = 48 + Math.sin(x * 0.09 + 2) * 4;
    let c: RGB;
    if (y > hy2) c = rampAt(rh, 2.2 + (fbm(x, y, seed) - 0.5) * 1.2, x, y);
    else if (y > hy) c = rampAt(rh, 3.3 + (fbm(x, y, seed + 1) - 0.5) * 1.2, x, y);
    else c = rampAt(rs, 4.2 - (y / 40) * 2.2 + (tnoise(x, y, 8, seed) - 0.5) * 0.6, x, y);
    const cx = (x - 18) / 10, cy = (y - 12) / 4.5;
    if (cx * cx + cy * cy < 1 + tnoise(x, y, 4, seed) * 0.5) c = mixc(c, [236, 232, 226], 0.7);
    p.set(x, y, c);
  }
  // Lightning bolt.
  let bx = 44;
  for (let y = 6; y < 36; y++) { p.set(bx, y, [255, 246, 190]); p.set(bx + 1, y, [255, 230, 140]); if (y % 5 === 0) bx += y % 10 === 0 ? 3 : -2; }
  // Tree.
  for (let y = 30; y < 44; y++) p.set(12, y, [70, 50, 36]);
  for (let y = 22; y < 34; y++) for (let x = 6; x < 19; x++) { const dx = (x - 12) / 6.5, dy = (y - 28) / 6; if (dx * dx + dy * dy < 1) p.set(x, y, rampAt(rh, 1.6 + (h2(x, y, seed) - 0.5) * 1.4, x, y)); }
  // Canvas weave.
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) if (((x + y) & 3) === 0) p.set(x, y, shade(p.get(x, y), -0.06));
}

function archMaterials(design: ThemeDesign, C: { Wl: RGB; W2: RGB; Rf: RGB; Tr: RGB; Ac: RGB; Cl: RGB; G: RGB }): MaterialSpec[] {
  const kit = kitFor(design.id), lang = kit.lang, m = design.mats, pal = design.pal;
  const { Wl, W2, Rf, Tr, Ac } = C;
  const X = (s: string | undefined, d: RGB): RGB => (s ? hex(s) : d);
  const cream: RGB = [232, 222, 200];
  const plasterC = X(kit.colors?.plaster, lumOf(Wl) > 0.55 && m.wall !== "brick" ? Wl : lumOf(W2) > 0.55 ? W2 : mixc(Wl, cream, 0.7));
  const brickC = X(kit.colors?.brick, m.wall === "brick" ? Wl : m.wall2 === "brick" ? W2 : mixc([152, 80, 60], Wl, 0.2));
  const sidingC = X(kit.colors?.siding, lang === "nordic" ? [142, 60, 46] : lang === "frontier" ? [152, 120, 90] : mixc(W2, cream, 0.4));
  const battenC = X(kit.colors?.batten, lang === "frontier" ? [128, 72, 52] : mixc(Tr, [128, 100, 72], 0.5));
  const lacquerC = X(kit.colors?.lacquer, lang === "eastern" ? (W2[0] > W2[1] * 1.5 ? W2 : [158, 56, 42]) : shade(Tr, -0.1));
  const shutterC = X(kit.colors?.shutter, lang === "mediterranean" ? [78, 118, 84] : lang === "victorian" ? [58, 76, 66] : lang === "nordic" ? [214, 206, 188] : lang === "frontier" ? [72, 92, 112] : shade(Tr, -0.05));
  const awnA = X(kit.colors?.awning, Ac);
  const paintC = X(kit.colors?.paint, [228, 222, 206]);
  const corrC = X(kit.colors?.corr, m.wall === "corrugated" || m.wall === "metal" ? Wl : [132, 136, 134]);
  const roof2: [MaterialId, RGB] = kit.colors?.roof2 ? [kit.roof2 ?? "shingle", hex(kit.colors.roof2)] :
    lang === "medieval" ? ["thatch", [178, 150, 94]] : lang === "mediterranean" ? ["terracotta", [190, 104, 66]] : lang === "frontier" ? ["roofmetal", [150, 92, 70]] :
    lang === "eastern" ? ["glazed", shade(Rf, -0.12)] : lang === "victorian" ? ["slate", [84, 90, 100]] : lang === "nordic" ? ["shingle", [96, 74, 58]] :
    lang === "tribal" ? ["thatch", [170, 140, 84]] : lang === "industrial" || lang === "urban" ? ["roofmetal", [128, 134, 136]] : [m.roof, shade(Rf, -0.1)];
  const r = (id: string, paint: (p: Px, r: R, s: number) => void, extra: Partial<MaterialSpec> = {}): MaterialSpec => ({ id, paint, ...extra });
  const out: MaterialSpec[] = [
    r("a_plaster", (p, _r, s) => plaster(p, plasterC, s, { stain: true, patches: lang === "mediterranean" || lang === "medieval" || kit.deco.includes("ruin") ? brickC : undefined, patchT: kit.deco.includes("ruin") ? 0.72 : 0.83 })),
    r("a_brick", (p, rr, s) => units(p, brickC, rr, s, { rowH: [4, 4, 4, 4], minW: 8, maxW: 8, mortar: shade(brickC, 0.45), bevel: 0.7, jitter: 1.2, crack: 0.05 })),
    r("a_siding", (p, _r, s) => siding(p, sidingC, s, { board: 6, wear: shade(sidingC, -0.3), weather: lang === "frontier" ? 0.2 : 0.06 })),
    r("a_batten", (p, rr, s) => batten(p, battenC, rr, s)),
    r("a_lacquer", (p, rr, s) => planks(p, lacquerC, rr, s, { w: 16, vertical: true, knots: 0, seamDark: 0.35 })),
    r("a_roof2", (p, rr, s) => roofTiles(p, roof2[1], rr, s, { kind: roof2[0] === "terracotta" ? "barrel" : roof2[0] === "glazed" ? "glazed" : roof2[0] === "thatch" ? "thatch" : roof2[0] === "roofmetal" ? "metal" : roof2[0] === "slate" ? "slate" : "shingle" }), { course: roofCourse(roof2[0] === "roofmetal" ? "metal" : roof2[0] === "terracotta" || roof2[0] === "glazed" || roof2[0] === "thatch" || roof2[0] === "slate" ? roof2[0] : "shingle") }),
    r("a_shutter", (p, _r, s) => louver(p, shutterC, s)),
    r("a_awning", (p, _r, s) => stripes(p, awnA, [236, 228, 212], s)),
    r("a_sign", (p, _r, s) => signboard(p, shade(Tr, -0.15), lumOf(Ac) > 0.5 ? shade(Ac, -0.45) : Ac, [236, 214, 150], s)),
    r("a_lattice", (p, _r, s) => lattice(p, mixc([240, 230, 204], hex(pal.glow), 0.2), shade(Tr, -0.35), s)),
    r("a_neon", (p, _r, s) => neon(p, hex(pal.glow), Ac, s)),
    r("a_corr", (p, _r, s) => metal(p, corrC, s, { corrugated: true, rust: kit.deco.includes("rust") || lang === "frontier" ? [118, 72, 48] : undefined, rustT: 0.8 })),
    r("a_log", (p, rr, s) => planks(p, X(kit.colors?.log, mixc(Tr, [124, 88, 56], 0.55)), rr, s, { w: 8, knots: 3, seamDark: 1.7 })),
    r("a_concrete", (p, _r, s) => plaster(p, X(kit.colors?.concrete, mixc(Wl, [170, 168, 162], 0.55)), s, { stain: true, lines: true })),
    r("a_paint", (p, rr, s) => planks(p, paintC, rr, s, { w: 8, vertical: true, knots: 0, seamDark: 0.4, weather: 0.02 })),
    r("a_wood", (p, rr, s) => planks(p, X(kit.colors?.wood, mixc([152, 112, 74], Tr, 0.15)), rr, s, { w: 8, vertical: true, knots: 2, seamDark: 0.9, weather: 0.03 })),
    r("a_timber", (p, rr, s) => planks(p, X(kit.colors?.timber, mixc([78, 56, 44], Tr, 0.15)), rr, s, { w: 16, vertical: true, knots: 1, seamDark: 0.5, weather: 0.02 })),
  ];
  const kinds = new Set([...kit.kinds.map((k) => k[0]), ...kit.sig]);
  if (kinds.has("corkhouse")) out.push(r("a_cork", (p, _r, s) => cork(p, [170, 124, 80], s)));
  if (kinds.has("theater") || kinds.has("puppetbooth") || kinds.has("flytower") || kinds.has("scenerystore") || kinds.has("carousel")) {
    out.push(r("a_velvet", (p, _r, s) => curtain(p, X(kit.colors?.velvet, [150, 30, 42]), s, [226, 180, 84])));
    out.push(r("a_poster", (p, _r, s) => poster(p, [232, 220, 190], [40, 28, 30], lumOf(Ac) > 0.6 ? shade(Ac, -0.4) : Ac, s)));
    out.push(r("a_flat", (p, _r, s) => sceneryFlat(p, [96, 120, 168], [92, 120, 70], s)));
  }
  if (kinds.has("saltblock")) out.push(r("a_salt", (p, _r, s) => crystal(p, [222, 232, 226], s)));
  if (kinds.has("obelisk") || kinds.has("shardhouse") || kinds.has("prismchapel") || kinds.has("ringtemple") || kinds.has("tesseract")) out.push(r("a_crystal", (p, _r, s) => crystal(p, mixc(hex(pal.glow), [200, 210, 240], 0.5), s)));
  return out;
}

// ------------------------------------------------------------------------------------------------
export type MaterialSpec = { id: string; paint: (p: Px, r: R, seed: number) => void; alpha?: boolean; emissive?: boolean; course?: [number, number] };

export function themeMaterials(design: ThemeDesign): MaterialSpec[] {
  const pal = design.pal, m = design.mats;
  const c = (s: string) => hex(s);
  const desat = design.desaturate ?? 0;
  const col = (s: string) => (desat ? desaturate(c(s), desat) : c(s));
  const G = col(pal.ground), Pp = col(pal.path), Wl = col(pal.wall), W2 = col(pal.wall2), Rf = col(pal.roof), Tr = col(pal.trim), Cl = col(pal.cliff);
  const Fl = col(pal.floor), Iw = col(pal.inwall), Fo = col(pal.foliage), Ac = col(pal.accent), Wa = col(pal.water);
  const mortar = (b: RGB) => shade(b, -0.55);
  const moss: RGB = shade(Fo, -0.15);
  const byMat = (id: MaterialId, base: RGB): Painter => {
    switch (id) {
      case "leaves": return (p, b, _r, _pal, s) => leafMass(p, b, s);
      case "grass": return (p, b, r, _pal, s) => ground(p, b, s, { blades: shade(b, 0.1), flowers: design.snow ? undefined : [Ac, [236, 226, 170], [220, 120, 140]], patch: shade(b, -0.2) });
      case "drygrass": return (p, b, r, _pal, s) => ground(p, b, s, { blades: shade(b, 0.2), pebbles: 10, patch: shade(Pp, 0) });
      case "dirt": case "earth": return (p, b, r, _pal, s) => ground(p, b, s, { pebbles: 22, contrast: 1.1 });
      case "sand": return (p, b, r, _pal, s) => ground(p, b, s, { pebbles: 6, contrast: 0.7 });
      case "snow": return (p, b, r, _pal, s) => ground(p, b, s, { contrast: 0.45, pebbles: 2 });
      case "rubble": case "gravel": case "ash": return (p, b, r, _pal, s) => ground(p, b, s, { pebbles: 60, contrast: 1.3 });
      case "moss": return (p, b, r, _pal, s) => ground(p, b, s, { blades: shade(b, 0.2), contrast: 1.2 });
      case "salt": return (p, b, r, _pal, s) => crystal(p, b, s);
      case "flesh": case "fleshwall": return (p, b, r, _pal, s) => organic(p, b, s, shade(Ac, -0.1));
      case "paper": case "pagestack": return (p, b, r, _pal, s) => paperStack(p, b, s, id === "pagestack");
      case "cobble": return (p, b, r, _pal, s) => units(p, b, r, s, { rowH: [7, 8, 6, 8, 7, 6, 8, 7, 7], minW: 6, maxW: 10, mortar: mortar(b), bevel: 1.1, round: true, moss: design.snow ? null : moss });
      case "slab": case "flagstone": return (p, b, r, _pal, s) => units(p, b, r, s, { rowH: [16, 16, 16, 16], minW: 12, maxW: 22, mortar: mortar(b), bevel: 0.8, crack: 0.25 });
      case "brickpave": return (p, b, r, _pal, s) => units(p, b, r, s, { rowH: [4, 4], minW: 8, maxW: 8, mortar: mortar(b), bevel: 0.6 });
      case "planks": return (p, b, r, _pal, s) => planks(p, b, r, s, { w: 8, knots: 2, weather: 0.03 });
      case "asphalt": case "concrete": return (p, b, r, _pal, s) => plaster(p, b, s, { stain: true, lines: id === "concrete" });
      case "tiles": case "floortile": return (p, b, r, _pal, s) => tiles(p, b, s, { size: 16, grout: shade(b, -0.35), gloss: true });
      case "grate": return (p, b, r, _pal, s) => metal(p, b, s, { grate: true, rust: design.id === "T01" || design.id === "T47" ? [140, 80, 50] : undefined });
      case "hexfloor": case "wax": return (p, b, r, _pal, s) => tiles(p, b, s, { size: 8, grout: shade(b, -0.4), checker: true, alt: shade(b, 0.12) });
      case "plaster": return (p, b, r, _pal, s) => plaster(p, b, s, { stain: true, patches: design.style === "stucco" || design.id === "T01" ? shade(W2, 0) : undefined });
      case "adobe": return (p, b, r, _pal, s) => plaster(p, b, s, { stain: true });
      case "stone": case "masonry": return (p, b, r, _pal, s) => units(p, b, r, s, { rowH: [10, 12, 9, 11, 10, 12], minW: 10, maxW: 20, mortar: mortar(b), bevel: 1.1, crack: 0.2, moss: design.snow ? null : moss, jitter: 0.8 });
      case "sandstone": return (p, b, r, _pal, s) => units(p, b, r, s, { rowH: [16, 16, 16, 16], minW: 20, maxW: 32, mortar: mortar(b), bevel: 0.9 });
      case "brick": return (p, b, r, _pal, s) => units(p, b, r, s, { rowH: [4, 4, 4, 4], minW: 8, maxW: 8, mortar: shade(b, 0.4), bevel: 0.7, jitter: 1.2, crack: 0.05 });
      case "timber": case "boards": case "wood": case "darkwood": case "lacquer": return (p, b, r, _pal, s) => planks(p, b, r, s, { w: id === "timber" ? 10 : 8, vertical: id !== "timber", knots: 1, weather: id === "boards" ? 0.05 : 0.01, seamDark: id === "lacquer" ? 0.6 : 1 });
      case "logs": return (p, b, r, _pal, s) => planks(p, b, r, s, { w: 8, knots: 3, seamDark: 1.6 });
      case "bamboo": return (p, b, r, _pal, s) => planks(p, b, r, s, { w: 6, vertical: true, seamDark: 1.4, knots: 3 });
      case "metal": case "panel": case "ironwork": case "brass": case "copper": return (p, b, r, _pal, s) => metal(p, b, s, { panel: 16, rivets: id !== "brass", rust: design.id === "T01" || design.id === "T19" ? [130, 75, 45] : undefined });
      case "corrugated": return (p, b, r, _pal, s) => metal(p, b, s, { corrugated: true, rust: [140, 80, 50] });
      case "paperwall": return (p, b, r, _pal, s) => tiles(p, b, s, { size: 16, grout: shade(Tr, -0.2) });
      case "coral": case "shellroof": return (p, b, r, _pal, s) => id === "shellroof" ? roofTiles(p, b, r, s, { kind: "shell" }) : organic(p, b, s, shade(b, 0.35));
      case "glass": return (p, b, r, _pal, s) => glass(p, b, s, Tr);
      case "wallpaper": return (p, b, r, _pal, s) => fabric(p, b, s, { pattern: design.id === "AB" ? "faded" : "wallpaper", accent: shade(b, -0.25) });
      case "moquette": return (p, b, r, _pal, s) => fabric(p, b, s, { pattern: "plain", accent: b });
      case "tilewall": return (p, b, r, _pal, s) => tiles(p, b, s, { size: 8, grout: shade(b, -0.3), gloss: true });
      case "velvet": return (p, b, r, _pal, s) => fabric(p, b, s, { pattern: "velvet", accent: Ac });
      case "carpet": return (p, b, r, _pal, s) => fabric(p, b, s, { pattern: "carpet", accent: Ac });
      case "bookshelf": return (p, b, r, _pal, s) => bookshelf(p, Tr, s, Ac);
      case "terracotta": return (p, b, r, _pal, s) => roofTiles(p, b, r, s, { kind: "barrel" });
      case "glazed": return (p, b, r, _pal, s) => roofTiles(p, b, r, s, { kind: "glazed" });
      case "slate": return (p, b, r, _pal, s) => roofTiles(p, b, r, s, { kind: "slate" });
      case "shingle": return (p, b, r, _pal, s) => roofTiles(p, b, r, s, { kind: "shingle" });
      case "thatch": return (p, b, r, _pal, s) => roofTiles(p, b, r, s, { kind: "thatch" });
      case "roofmetal": return (p, b, r, _pal, s) => roofTiles(p, b, r, s, { kind: "metal" });
      case "tent": case "canvas": case "cloth": return (p, b, r, _pal, s) => roofTiles(p, b, r, s, { kind: "tent" });
      case "redrock": return (p, b, _r, _pal, s) => sandCliff(p, b, s);
      case "rock": case "basalt": return (p, b, r, _pal, s) => strata(p, b, s, { bands: 2, cracks: 0.7 });
      case "ice": return (p, b, r, _pal, s) => strata(p, b, s, { bands: 1, cracks: 0.8, ice: true });
      case "woodfloor": return (p, b, r, _pal, s) => planks(p, b, r, s, { w: 8, knots: 1, seamDark: 0.9 });
      case "marble": return (p, b, r, _pal, s) => tiles(p, b, s, { size: 32, grout: shade(b, -0.25), gloss: true, checker: true, alt: shade(b, -0.12) });
      case "rockfloor": return (p, b, r, _pal, s) => units(p, b, r, s, { rowH: [16, 16, 16, 16], minW: 14, maxW: 24, mortar: mortar(b), bevel: 0.7, crack: 0.3 });
      case "bone": return (p, b, r, _pal, s) => plaster(p, b, s, { lines: true });
      case "crystal": return (p, b, r, _pal, s) => crystal(p, b, s);
      case "water": return (p, b, r, _pal, s) => waterTex(p, b, s);
      default: return (p, b, r, _pal, s) => plaster(p, b, s, {});
    }
  };
  const spec = (id: string, mat: MaterialId, base: RGB): MaterialSpec => ({ id, paint: (p, r, s) => byMat(mat, base)(p, base, r, pal, s), course: id === "roof" || id === "wall" || id === "wall2" || id === "trim" ? roofCourse(mat) : undefined });
  const extras: MaterialSpec[] = [
    spec("ground", m.ground, G),
    spec("ground2", m.ground === "grass" ? "dirt" : m.ground === "snow" ? "gravel" : m.ground === "carpet" || m.ground === "floortile" ? m.ground : "dirt", design.snow ? shade(Pp, 0.2) : shade(mixc(G, Pp, 0.6), -0.05)),
    spec("path", m.path, Pp),
    spec("plaza", m.path === "asphalt" ? "slab" : m.path === "planks" ? "planks" : m.path === "cobble" ? "slab" : m.path, shade(Pp, 0.1)),
    spec("wall", m.wall, Wl),
    spec("wall2", m.wall2, W2),
    spec("roof", m.roof, Rf),
    spec("trim", m.trim, Tr),
    spec("cliff", m.cliff, Cl),
    spec("retain", m.cliff === "rock" || m.cliff === "redrock" || m.cliff === "basalt" || m.cliff === "earth" || m.cliff === "ice" || m.cliff === "pagestack" ? m.cliff : "masonry", design.style === "keep" || design.style === "brick" || design.style === "stucco" || design.style === "asian" ? shade(Cl, 0.05) : Cl),
    spec("floor", m.floor, Fl),
    spec("inwall", m.inwall, Iw),
    spec("wood", "wood", shade(Tr, 0)),
    spec("darkwood", "darkwood", shade(Tr, -0.35)),
    spec("stone", "stone", mixc(Cl, [150, 145, 135], 0.4)),
    spec("metal", "metal", [120, 124, 128]),
    spec("brass", "brass", [176, 140, 74]),
    spec("cloth", "cloth", Ac),
    spec("cloth2", "cloth", shade(mixc(Ac, [230, 220, 200], 0.55), 0)),
    spec("leaves", "leaves", Fo),
    spec("bark", "timber", design.flora.includes("birch") ? [200, 200, 190] : design.flora.includes("pencil") ? [220, 170, 90] : [96, 72, 52]),
    spec("water", "water", Wa),
    spec("rug", "carpet", shade(Ac, -0.2)),
    spec("tile", "floortile", design.id === "T10" || design.id === "T35" ? [220, 228, 226] : mixc(Fl, [230, 230, 225], 0.5)),
    spec("paper", "paper", [236, 228, 208]),
    spec("book", "bookshelf", Tr),
    spec("grasscard", "grasscard", Fo),
  ];
  // Alpha cards + emissive window.
  const cards: MaterialSpec[] = [
    { id: "foliage", alpha: true, paint: (p, r, s) => foliageCard(p, Fo, s, design.flora.includes("snowpine") || design.flora.includes("pine") ? "pine" : "leaf", Ac) },
    { id: "flowers", alpha: true, paint: (p, r, s) => foliageCard(p, shade(Fo, 0.1), s, "flower", Ac) },
    { id: "grass", alpha: true, paint: (p, r, s) => foliageCard(p, shade(G, 0.15), s, "grass", Ac) },
    { id: "leafcard", alpha: true, paint: (p, r, s) => foliageCard(p, Fo, s + 99, "leaf", Ac) },
    { id: "window", emissive: true, paint: (p) => emissive(p, hex(pal.glow)) },
    { id: "glass", paint: (p, r, s) => glass(p, shade(hex(pal.sky), -0.35), s, Tr) },
  ];
  // grasscard spec uses a painter id not present in byMat's switch; replace with a solid colour.
  const out = [...extras.filter((e) => e.id !== "grasscard"), ...cards, ...archMaterials(design, { Wl, W2, Rf, Tr, Ac, Cl, G })];
  return out;
}

/** Render every material layer for a theme. Returns layers in a stable order; index = material slot. */
export function buildTextures(design: ThemeDesign, extraThemes: ThemeDesign[] = []): { layers: Layer[]; index: Record<string, number> } {
  const layers: Layer[] = [], index: Record<string, number> = {};
  // Foreign (collage) themes only need building materials; terrain / sky slots fall back to the base theme.
  const FOREIGN_SKIP = new Set(["ground", "ground2", "path", "plaza", "cliff", "retain", "water", "leaves", "bark", "grass", "leafcard", "tile", "grasscard"]);
  const add = (d: ThemeDesign, prefix: string) => {
    let seed = 0;
    for (const ch of d.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
    for (const m of themeMaterials(d)) {
      if (prefix && FOREIGN_SKIP.has(m.id)) continue;
      const p = new Px();
      let s = seed;
      for (const ch of m.id) s = Math.imul(s ^ ch.charCodeAt(0), 2654435761) >>> 0;
      m.paint(p, new R(s), s & 0xffff);
      index[prefix + m.id] = layers.length;
      layers.push({ id: prefix + m.id, data: p.data, alpha: m.alpha, emissive: m.emissive, course: m.course });
    }
  };
  add(design, "");
  for (const d of extraThemes) add(d, d.id + ":");
  return { layers, index };
}
export const PALETTE_KEYS: (keyof Palette)[] = ["ground", "path", "wall", "wall2", "roof", "trim", "cliff", "floor", "inwall", "foliage", "accent", "water", "sky", "sun", "glow"];
