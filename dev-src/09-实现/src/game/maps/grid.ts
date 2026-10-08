// Shared cell grid for P5 generation. One cell = 1 m. Cell centres are integer (x,z).
import { Random, hash32 } from "./geometry";
import type { Facing, Point } from "./types";

/**
 * Per-cell surface codes (one char each in FloorLayout.surface).
 * Walkable: g ground, c street, p plaza paving, d worn earth, w wooden deck, m metal grate, f interior floor,
 *           a rug/carpet, t tiled floor, o alternate floor, S stair, B bridge/ramp, D doorway, I enterable-house floor.
 * Blocked:  E upper edge (balustrade/hedge), P wall-foot planter, C stair cheek, W water, V void, H building,
 *           X interior wall, R rock/cliff, Z built boundary, K pit/trench, Q pool, Y seating tier, F furniture/prop,
 *           U closed-off floor (rendered as floor, not walkable).
 */
export const SURFACE = {
  ground: "g", street: "c", plaza: "p", worn: "d", deck: "w", grate: "m", floor: "f", rug: "a", tile: "t", alt: "o",
  stair: "S", bridge: "B", door: "D", house: "I",
  edge: "E", planter: "P", cheek: "C", water: "W", void: "V", building: "H", wall: "X", rock: "R", bound: "Z",
  pit: "K", pool: "Q", seats: "Y", prop: "F", closed: "U",
} as const;
export const WALKABLE_CODES = "gcpdwmfatoSBDI";
const WALKABLE_SET = new Set<string>(WALKABLE_CODES);
export const isWalkableCode = (c: string) => WALKABLE_SET.has(c);
export const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const FACING_VEC: Record<Facing, [number, number]> = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };
export const OPPOSITE: Record<Facing, Facing> = { e: "w", w: "e", n: "s", s: "n" };
export function facingOf(dx: number, dz: number): Facing {
  return Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? "e" : "w") : dz >= 0 ? "s" : "n";
}
export const r3 = (v: number) => Math.round(v * 1000) / 1000;

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly n: number;
  top: Float32Array; // walking surface / top height
  surf: Uint8Array; // SURFACE char code
  walk: Uint8Array; // 1 = walkable
  lvl: Int8Array; // terrace level, -1 = none (water/void/solid)
  own: Int16Array; // structure owner (+1), 0 none
  res: Uint8Array; // reservation bits (see RES)
  constructor(w: number, h: number) {
    this.w = w; this.h = h; this.n = w * h;
    this.top = new Float32Array(this.n);
    this.surf = new Uint8Array(this.n).fill(SURFACE.rock.charCodeAt(0));
    this.walk = new Uint8Array(this.n);
    this.lvl = new Int8Array(this.n).fill(-1);
    this.own = new Int16Array(this.n);
    this.res = new Uint8Array(this.n);
  }
  i(x: number, z: number) { return z * this.w + x; }
  in(x: number, z: number) { return x >= 0 && z >= 0 && x < this.w && z < this.h; }
  inner(x: number, z: number, m = 1) { return x >= m && z >= m && x < this.w - m && z < this.h - m; }
  s(x: number, z: number): string { return String.fromCharCode(this.surf[this.i(x, z)]!); }
  code(k: number): string { return String.fromCharCode(this.surf[k]!); }
  isWalk(x: number, z: number) { return this.in(x, z) && this.walk[this.i(x, z)] === 1; }
  /** Set walkable ground (code must be walkable). */
  ground(k: number, code: string, top?: number) {
    this.surf[k] = code.charCodeAt(0);
    this.walk[k] = WALKABLE_SET.has(code) ? 1 : 0;
    if (top !== undefined) this.top[k] = top;
  }
  /** Set a blocked cell. */
  block(k: number, code: string, top?: number) {
    this.surf[k] = code.charCodeAt(0);
    this.walk[k] = 0;
    if (top !== undefined) this.top[k] = top;
  }
  /** Repaint a walkable cell's material, keeping walkability. */
  paint(k: number, code: string) {
    if (this.walk[k] && WALKABLE_SET.has(code)) this.surf[k] = code.charCodeAt(0);
  }
  rows(): string[] {
    const out: string[] = [];
    for (let z = 0; z < this.h; z++) {
      let row = "";
      for (let x = 0; x < this.w; x++) row += String.fromCharCode(this.surf[this.i(x, z)]!);
      out.push(row);
    }
    return out;
  }
  tiles(): string[] {
    const out: string[] = [];
    for (let z = 0; z < this.h; z++) {
      let row = "";
      for (let x = 0; x < this.w; x++) row += this.walk[this.i(x, z)] ? "." : "#";
      out.push(row);
    }
    return out;
  }
}
/** Reservation bits: protected circulation that later passes may not block. */
export const RES = { corridor: 1, clear: 2, plaza: 4, poi: 8, door: 16, landing: 32, path: 64, keep: 128 } as const;
export const PROTECT = RES.path | RES.landing | RES.door | RES.poi;

/** Legal 4-neighbour step: flat ≤ 0.05 m; any stair/bridge cell involved ≤ 0.5 m. */
export function legalStep(g: Grid, a: number, b: number) {
  const ca = g.surf[a]!, cb = g.surf[b]!;
  const stairish = ca === 83 || ca === 66 || cb === 83 || cb === 66; // 'S' | 'B'
  return Math.abs(g.top[a]! - g.top[b]!) <= (stairish ? 0.5 : 0.05) + 1e-6;
}

/** BFS over walkable cells honouring legal steps. */
export function flood(g: Grid, start: Point, target?: Point) {
  const seen = new Int32Array(g.n).fill(-1);
  const dist = new Int32Array(g.n).fill(-1);
  const queue = new Int32Array(g.n);
  const s = g.i(start.x, start.z);
  if (!g.walk[s]) return { seen, dist, count: 0, path: [] as Point[], far: s };
  seen[s] = s; dist[s] = 0; queue[0] = s;
  let n = 1, far = s;
  for (let k = 0; k < n; k++) {
    const p = queue[k]!, x = p % g.w, z = (p / g.w) | 0;
    if (dist[p]! > dist[far]!) far = p;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
      const q = nz * g.w + nx;
      if (seen[q]! >= 0 || !g.walk[q] || !legalStep(g, p, q)) continue;
      seen[q] = p; dist[q] = dist[p]! + 1; queue[n++] = q;
    }
  }
  const path: Point[] = [];
  if (target) {
    let p = g.i(target.x, target.z);
    if (seen[p]! >= 0) {
      while (p !== s) { path.push({ x: p % g.w, z: (p / g.w) | 0 }); p = seen[p]!; }
      path.push({ x: start.x, z: start.z });
      path.reverse();
    }
  }
  return { seen, dist, count: n, path, far };
}

/** Weighted grid A* (4-neighbour). `cost` returns Infinity for impassable moves. */
export function astar(
  g: Grid, a: Point, b: Point,
  cost: (k: number, from: number, turn: boolean) => number,
): Point[] | null {
  const n = g.n, gs = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1);
  const dirOf = new Int8Array(n).fill(-1), fs = new Float32Array(n).fill(Infinity), closed = new Uint8Array(n);
  const heap: number[] = [];
  const start = g.i(a.x, a.z), goal = g.i(b.x, b.z);
  const hfn = (k: number) => Math.abs((k % g.w) - b.x) + Math.abs(((k / g.w) | 0) - b.z);
  gs[start] = 0; fs[start] = hfn(start); heap.push(start);
  const up = (i: number) => {
    while (i > 0) { const p = (i - 1) >> 1; if (fs[heap[p]!]! <= fs[heap[i]!]!) break; const t = heap[p]!; heap[p] = heap[i]!; heap[i] = t; i = p; }
  };
  const down = (i: number) => {
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < heap.length && fs[heap[l]!]! < fs[heap[m]!]!) m = l;
      if (r < heap.length && fs[heap[r]!]! < fs[heap[m]!]!) m = r;
      if (m === i) break; const t = heap[m]!; heap[m] = heap[i]!; heap[i] = t; i = m;
    }
  };
  while (heap.length) {
    const cur = heap[0]!; const last = heap.pop()!;
    if (heap.length) { heap[0] = last; down(0); }
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    const x = cur % g.w, z = (cur / g.w) | 0;
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIRS[d]!;
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
      const q = nz * g.w + nx;
      if (closed[q]) continue;
      const c = cost(q, cur, dirOf[cur]! >= 0 && dirOf[cur] !== d);
      if (!(c < Infinity)) continue;
      const ng = gs[cur]! + c;
      if (ng < gs[q]!) { gs[q] = ng; from[q] = cur; dirOf[q] = d; fs[q] = ng + hfn(q); heap.push(q); up(heap.length - 1); }
    }
  }
  if (goal !== start && from[goal]! < 0) return null;
  const path: Point[] = [];
  let p = goal;
  while (p !== start) { path.push({ x: p % g.w, z: (p / g.w) | 0 }); p = from[p]!; if (p < 0) return null; }
  path.push({ x: a.x, z: a.z });
  return path.reverse();
}

/** Seeded value noise in [0,1). */
export class Noise {
  private seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  private lattice(ix: number, iz: number) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ this.seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  at(x: number, z: number) {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = this.lattice(ix, iz), b = this.lattice(ix + 1, iz), c = this.lattice(ix, iz + 1), d = this.lattice(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }
  fbm(x: number, z: number, octaves = 3) {
    let v = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < octaves; o++) { v += this.at(x * f + o * 17.3, z * f - o * 9.1) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return v / norm;
  }
}
export const streamOf = (regionSeed: number) => (name: string) => new Random(hash32(`${regionSeed}|${name}`));

/** Connected components (4-connected) of cells satisfying `pred`, optionally split by `same`. */
export function label(g: Grid, pred: (k: number) => boolean, same?: (a: number, b: number) => boolean) {
  const lab = new Int32Array(g.n).fill(-1), sizes: number[] = [], queue = new Int32Array(g.n);
  let id = 0;
  for (let k0 = 0; k0 < g.n; k0++) {
    if (lab[k0]! >= 0 || !pred(k0)) continue;
    lab[k0] = id; queue[0] = k0; let n = 1;
    for (let q = 0; q < n; q++) {
      const p = queue[q]!, x = p % g.w, z = (p / g.w) | 0;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
        const k = nz * g.w + nx;
        if (lab[k]! >= 0 || !pred(k) || (same && !same(p, k))) continue;
        lab[k] = id; queue[n++] = k;
      }
    }
    sizes.push(n); id++;
  }
  return { lab, sizes };
}
