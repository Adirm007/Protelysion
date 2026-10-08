// Mutable generation state and shared passes for P5 floors.
import type { Random } from "./geometry";
import { Grid, SURFACE, DIRS, FACING_VEC, OPPOSITE, flood, astar, RES, PROTECT, legalStep, label } from "./grid";
import type { ThemeDesign } from "./themes";
import type {
  AnomalyKind, Archetype, Building, Facing, FloorLayout, Intrusion, Lighting, Plaza, Point, PropTuple, Rect,
  Road, Room, Scheme, Stair,
} from "./types";

const S = SURFACE;
const C = (c: string) => c.charCodeAt(0);
const CODE_S = C(S.stair), CODE_B = C(S.bridge);
export const isStairCode = (code: number) => code === CODE_S || code === CODE_B;

export type Draft = {
  g: Grid;
  stream: (name: string) => Random;
  theme: string;
  design: ThemeDesign;
  archetype: Archetype;
  scheme: Scheme;
  anomaly: AnomalyKind | null;
  interior: boolean;
  lighting: Lighting;
  landMode: FloorLayout["landMode"];
  waterY: number;
  levels: number[];
  buildings: Building[];
  rooms: Room[];
  stairs: Stair[];
  props: PropTuple[];
  roads: Road[];
  plazas: Plaza[];
  landmasses: Rect[];
  intrusions: Intrusion[];
  spawn: Point;
  down: Point;
  route: Point[];
  loops: number;
  districts: number;
};

export function newDraft(g: Grid, base: Pick<Draft, "stream" | "theme" | "design" | "archetype" | "scheme" | "anomaly" | "interior" | "lighting" | "landMode">): Draft {
  return {
    g, ...base, waterY: -1.1, levels: [0], buildings: [], rooms: [], stairs: [], props: [], roads: [], plazas: [],
    landmasses: [], intrusions: [], spawn: { x: 1, z: 1 }, down: { x: 1, z: 1 }, route: [], loops: 0, districts: 1,
  };
}

/**
 * Remove every illegal height step between 4-adjacent walkable cells.
 * A cell beside a stair becomes a cheek; otherwise the lower cell becomes a wall-foot planter
 * (or the upper an edge when the lower one is protected).
 */
export function legalize(d: Draft) {
  const g = d.g;
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (let z = 0; z < g.h; z++) for (let x = 0; x < g.w; x++) {
      const a = z * g.w + x;
      if (!g.walk[a]) continue;
      for (let t = 0; t < 2; t++) {
        const nx = x + (t === 0 ? 1 : 0), nz = z + (t === 1 ? 1 : 0);
        if (nx >= g.w || nz >= g.h) continue;
        const b = nz * g.w + nx;
        if (!g.walk[b] || legalStep(g, a, b)) continue;
        const sa = isStairCode(g.surf[a]!), sb = isStairCode(g.surf[b]!);
        let victim: number;
        if (sa !== sb) victim = sa ? b : a;
        else {
          // Interiors: the upper edge becomes a railed ledge. Outdoors: balustrade/hedge on top or a
          // planter at the wall foot, chosen per 4×4 block so a wall run reads consistently.
          const upperFirst = d.interior || ((((x >> 2) * 73856093) ^ ((z >> 2) * 19349663) ^ d.levels.length) >>> 0) % 5 < 3;
          const lowerCell = g.top[a]! < g.top[b]! ? a : b;
          victim = upperFirst ? (lowerCell === a ? b : a) : lowerCell;
        }
        const other = victim === a ? b : a;
        if (g.res[victim]! & PROTECT && !(g.res[other]! & PROTECT) && !isStairCode(g.surf[other]!)) victim = other;
        g.walk[victim] = 0;
        if (g.surf[victim] === CODE_S) g.surf[victim] = C(S.cheek);
        else if (!isStairCode(g.surf[victim]!)) {
          const beside = sa || sb;
          const lower = g.top[victim]! < g.top[victim === a ? b : a]!;
          g.surf[victim] = C(beside ? S.cheek : lower ? S.planter : S.edge);
        }
        changed = true;
        if (!g.walk[a]) break;
      }
    }
    if (!changed) break;
  }
}

/** Block every walkable cell not reachable from spawn, and drop stair records whose flight became unreachable. */
export function prune(d: Draft) {
  const g = d.g, f = flood(g, d.spawn);
  let removed = 0;
  // Orphaned flights (both landings pruned) revert to the terrain they were cut from.
  d.stairs = d.stairs.filter((s) => {
    let reachable = false;
    for (let z = s.z; z < s.z + s.d; z++) for (let x = s.x; x < s.x + s.w; x++) if (f.seen[g.i(x, z)]! >= 0) reachable = true;
    if (reachable) return true;
    for (let z = s.z; z < s.z + s.d; z++) for (let x = s.x; x < s.x + s.w; x++) {
      const k = g.i(x, z);
      if (!isStairCode(g.surf[k]!)) continue;
      g.walk[k] = 0;
      g.surf[k] = C(d.interior ? S.closed : S.planter);
      g.top[k] = s.h0;
    }
    return false;
  });
  for (let k = 0; k < g.n; k++) {
    if (g.walk[k] && f.seen[k]! < 0) {
      g.walk[k] = 0;
      const c = g.surf[k]!;
      if (d.interior) { if (!isStairCode(c)) g.surf[k] = C(S.closed); }
      else if (!isStairCode(c) && c !== C(S.door) && c !== C(S.house)) g.surf[k] = C(S.planter);
      removed++;
    }
  }
  return removed;
}

/** Distance (cells, 4-neighbour) from each cell to the nearest non-walkable cell. */
export function clearance(g: Grid) {
  const dist = new Int16Array(g.n).fill(-1), q = new Int32Array(g.n);
  let n = 0;
  for (let k = 0; k < g.n; k++) if (!g.walk[k]) { dist[k] = 0; q[n++] = k; }
  for (let i = 0; i < n; i++) {
    const p = q[i]!, x = p % g.w, z = (p / g.w) | 0;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
      const k = nz * g.w + nx;
      if (dist[k]! >= 0) continue;
      dist[k] = dist[p]! + 1; q[n++] = k;
    }
  }
  return dist;
}

/** Straight-line simplification of a cell path into a polyline. */
export function toRoad(id: string, kind: Road["kind"], width: number, path: Point[]): Road {
  const pts: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!, a = path[i - 1], b = path[i + 1];
    if (!a || !b || p.x - a.x !== b.x - p.x || p.z - a.z !== b.z - p.z) pts.push({ x: p.x, z: p.z });
  }
  return { id, kind, width, points: pts };
}

/** Street routing over walkable cells with legal steps. `bias` adds per-cell cost. */
export function routeCells(d: Draft, a: Point, b: Point, bias?: Float32Array, clear?: Int16Array) {
  const g = d.g;
  return astar(g, a, b, (k, from, turn) => {
    if (!g.walk[k] || !legalStep(g, from, k)) return Infinity;
    let c = 1;
    if (turn) c += 0.6;
    if (clear) c += Math.max(0, 3 - clear[k]!) * 0.45;
    if (bias) c += bias[k]!;
    return c;
  });
}

/** Mark a path as protected circulation (RES.path), optionally widening it on equal-height cells. */
export function reservePath(d: Draft, path: Point[], margin: number, paint?: string, keep?: string) {
  const g = d.g;
  for (const p of path) {
    const c = g.i(p.x, p.z);
    for (let dz = -margin; dz <= margin; dz++) for (let dx = -margin; dx <= margin; dx++) {
      if (Math.abs(dx) + Math.abs(dz) > margin) continue;
      const x = p.x + dx, z = p.z + dz;
      if (!g.in(x, z)) continue;
      const k = g.i(x, z);
      if (!g.walk[k]) continue;
      if ((dx || dz) && Math.abs(g.top[k]! - g.top[c]!) > 0.01) continue;
      if (!dx && !dz) g.res[k] = g.res[k]! | RES.path;
      else g.res[k] = g.res[k]! | RES.corridor;
      if (paint && !isStairCode(g.surf[k]!) && (!keep || !keep.includes(g.code(k)))) g.surf[k] = C(paint);
    }
  }
}

/** Union-find. */
export class DSU {
  p: Int32Array;
  constructor(n: number) { this.p = new Int32Array(n); for (let i = 0; i < n; i++) this.p[i] = i; }
  find(a: number): number { while (this.p[a] !== a) { this.p[a] = this.p[this.p[a]!]!; a = this.p[a]!; } return a; }
  union(a: number, b: number) { const x = this.find(a), y = this.find(b); if (x === y) return false; this.p[x] = y; return true; }
}

/** Walkable, non-stair components of equal height. */
export function heightRegions(g: Grid) {
  return label(g, (k) => g.walk[k] === 1 && !isStairCode(g.surf[k]!), (a, b) => Math.abs(g.top[a]! - g.top[b]!) < 0.01);
}

export type StairSite = {
  ra: number; rb: number; dir: Facing; w: number; cells: number[]; heights: number[];
  bottom: Point; top: Point; h0: number; h1: number; score: number;
};

/**
 * Candidate straight flights between two terrace regions. A wall line lies between a low cell L and an
 * upper cell U = L + a (a = ascending direction). The flight takes `kin` cells cut into the upper terrace
 * and `kout` cells jutting into the lower one. Landings keep one free cell beyond them.
 */
export function stairSites(d: Draft, reg: Int32Array, sizes: number[], opts: { widths: number[]; maxRise: number; minRegion: number; cut: number }) {
  const g = d.g, out: StairSite[] = [];
  const dirs: Facing[] = ["n", "s", "e", "w"];
  for (let z = 3; z < g.h - 3; z++) for (let x = 3; x < g.w - 3; x++) {
    const L = g.i(x, z);
    if (!g.walk[L] || reg[L]! < 0 || sizes[reg[L]!]! < opts.minRegion) continue;
    for (const dir of dirs) {
      const [ax, az] = FACING_VEC[dir];
      const ux = x + ax, uz = z + az;
      const U = g.i(ux, uz);
      if (!g.walk[U] || reg[U]! < 0 || reg[U] === reg[L] || sizes[reg[U]!]! < opts.minRegion) continue;
      const h0 = g.top[L]!, h1 = g.top[U]!, rise = h1 - h0;
      if (rise < 0.3 || rise > opts.maxRise) continue;
      const k = Math.max(2, Math.ceil(rise / 0.45) - 1);
      const px = az !== 0 ? 1 : 0, pz = ax !== 0 ? 1 : 0;
      for (const w of opts.widths) {
        for (const kin of [Math.round(k * opts.cut), Math.min(k, Math.round(k * opts.cut) + 1)]) {
          const kout = k - kin;
          const cells: number[] = [], heights: number[] = [];
          let ok = true;
          for (let o = 0; o < w && ok; o++) {
            const lx = x + px * o, lz = z + pz * o;
            const col: number[] = [];
            // Jutting part: from the outermost (lowest) cell to L.
            for (let j = kout - 1; j >= 0; j--) {
              const cx = lx - ax * j, cz = lz - az * j;
              if (!g.inner(cx, cz, 2)) { ok = false; break; }
              const c = g.i(cx, cz);
              if (!g.walk[c] || reg[c] !== reg[L] || g.res[c]! & (RES.poi | RES.door | RES.landing) || nearBridge(g, c)) { ok = false; break; }
              col.push(c);
            }
            if (!ok) break;
            // Cut-in part: from U inward.
            for (let j = 0; j < kin; j++) {
              const cx = lx + ax * (1 + j), cz = lz + az * (1 + j);
              if (!g.inner(cx, cz, 2)) { ok = false; break; }
              const c = g.i(cx, cz);
              if (!g.walk[c] || reg[c] !== reg[U] || g.res[c]! & (RES.poi | RES.door | RES.landing) || nearBridge(g, c)) { ok = false; break; }
              col.push(c);
            }
            if (!ok) break;
            // Landings (+1 spare cell) at both ends.
            const bx = lx - ax * kout, bz = lz - az * kout, tx = lx + ax * (1 + kin), tz = lz + az * (1 + kin);
            for (const [qx, qz, want] of [[bx, bz, reg[L]], [bx - ax, bz - az, reg[L]], [tx, tz, reg[U]], [tx + ax, tz + az, reg[U]]] as const) {
              if (!g.inner(qx, qz, 1)) { ok = false; break; }
              const q = g.i(qx, qz);
              if (!g.walk[q] || reg[q] !== want) { ok = false; break; }
            }
            if (!ok) break;
            // When kout=0 the bottom landing is L itself; skip it from flight cells.
            const flight = kout === 0 ? col : col;
            flight.forEach((c, i) => { cells.push(c); heights.push(h0 + ((i + 1) * rise) / (k + 1)); });
          }
          if (!ok || cells.length !== w * k) continue;
          // The landing cell right at the bottom when kout === 0 is L; when kout > 0 it's L - a*kout.
          const mid = Math.floor(w / 2);
          const bottom = { x: x + px * mid - ax * kout, z: z + pz * mid - az * kout };
          const top = { x: x + px * mid + ax * (1 + kin), z: z + pz * mid + az * (1 + kin) };
          // Fix: when kout > 0 the cell L belongs to the flight, so the bottom landing is one step further out.
          if (kout > 0) { bottom.x -= 0; bottom.z -= 0; }
          let score = (dir === "n" ? 2.4 : dir === "s" ? 0.5 : 1.4) + (w - 1) * 0.5;
          // Walls should continue on both sides of the flight (reads as a built stair, not a gap).
          for (const o of [-1, w]) {
            const sx = x + px * o, sz = z + pz * o, su = g.i(sx + ax, sz + az), sl = g.i(sx, sz);
            if (g.in(sx, sz) && reg[su] === reg[U] && reg[sl] === reg[L]) score += 0.5;
          }
          out.push({ ra: reg[L]!, rb: reg[U]!, dir, w, cells, heights, bottom, top, h0, h1, score });
        }
      }
    }
  }
  return out;
}

function nearBridge(g: Grid, k: number) {
  const x = k % g.w, z = (k / g.w) | 0;
  for (const [dx, dz] of DIRS) { const nx = x + dx, nz = z + dz; if (g.in(nx, nz) && g.surf[g.i(nx, nz)] === CODE_B) return true; }
  return false;
}

/** Commit a stair flight into the grid. Returns false if the cells changed since the site was found. */
export function commitStair(d: Draft, s: StairSite, kind: Stair["kind"]) {
  const g = d.g;
  for (const c of s.cells) if (!g.walk[c] || isStairCode(g.surf[c]!) || g.res[c]! & (RES.poi | RES.door | RES.landing)) return false;
  s.cells.forEach((c, i) => {
    g.top[c] = s.heights[i]!;
    g.surf[c] = C(S.stair);
    g.walk[c] = 1;
    g.res[c] = g.res[c]! | RES.path;
  });
  for (const p of [s.bottom, s.top]) {
    const k = g.i(p.x, p.z);
    g.res[k] = g.res[k]! | RES.landing;
  }
  const xs = s.cells.map((c) => c % g.w), zs = s.cells.map((c) => (c / g.w) | 0);
  const x = Math.min(...xs), z = Math.min(...zs);
  d.stairs.push({
    id: `st${d.stairs.length}`, x, z, w: Math.max(...xs) - x + 1, d: Math.max(...zs) - z + 1, dir: s.dir,
    h0: Math.round(s.h0 * 1000) / 1000, h1: Math.round(s.h1 * 1000) / 1000, kind,
  });
  d.roads.push({ id: `stair${d.stairs.length - 1}`, kind: "stair", width: s.w, points: [s.bottom, s.top] });
  return true;
}

/** Connect all sizeable terrace regions with flights (spanning tree + a few loop flights). */
export function connectTerraces(d: Draft, opts: { widths: number[]; maxRise: number; minRegion: number; cut: number; extra: number; kind: Stair["kind"] }) {
  const g = d.g, r = d.stream("stairs");
  for (let round = 0; round < 3; round++) {
    const { lab, sizes } = heightRegions(g);
    if (sizes.length <= 1) return;
    const sites = stairSites(d, lab, sizes, opts);
    for (const s of sites) s.score += r.next() * 1.2 + Math.min(sizes[s.ra]!, sizes[s.rb]!) / 400;
    sites.sort((a, b) => b.score - a.score);
    const dsu = new DSU(sizes.length);
    // Stairs already built join regions through their flights: seed the DSU from current connectivity.
    const comp = label(g, (k) => g.walk[k] === 1, (a, b) => legalStep(g, a, b)).lab;
    const rep = new Map<number, number>();
    for (let k = 0; k < g.n; k++) if (lab[k]! >= 0) { const c = comp[k]!; if (rep.has(c)) dsu.union(rep.get(c)!, lab[k]!); else rep.set(c, lab[k]!); }
    const built: StairSite[] = [];
    const far = (s: StairSite) => built.every((b) => Math.abs(b.bottom.x - s.bottom.x) + Math.abs(b.bottom.z - s.bottom.z) > 7);
    const nearOld = (s: StairSite) => d.stairs.some((t) => Math.abs(t.x - s.bottom.x) + Math.abs(t.z - s.bottom.z) < 6);
    let progress = false;
    for (const s of sites) {
      if (dsu.find(s.ra) === dsu.find(s.rb) || !far(s) || nearOld(s)) continue;
      if (!commitStair(d, s, opts.kind)) continue;
      dsu.union(s.ra, s.rb); built.push(s); progress = true;
    }
    let extra = opts.extra;
    for (const s of sites) {
      if (extra <= 0) break;
      if (built.includes(s) || !far(s) || nearOld(s)) continue;
      if (s.w < 2 && r.next() < 0.5) continue;
      if (!commitStair(d, s, opts.kind)) continue;
      built.push(s); extra--; d.loops++;
    }
    legalize(d);
    if (!progress) return;
  }
}

/** 3×3 flat & walkable neighbourhood test: blocking the centre cannot disconnect anything. */
/**
 * Indoor descent door. The door is a camera-facing sprite about 2.1 m tall; at the interior camera pitch (50°)
 * its top leans about 1.6 cells north, so a wall (or tall furniture) in the two rows behind it swallows the top
 * half, a ledge right in front hides its foot, and side walls clip its edges. The box is the 3 × 4 cells that must
 * stay open floor at the door's own height: two rows behind, one in front, one to each side.
 */
export const DOOR_BOX: readonly (readonly [number, number])[] = [-2, -1, 0, 1].flatMap((dz) => [-1, 0, 1].map((dx) => [dx, dz] as const)).filter(([dx, dz]) => dx !== 0 || dz !== 0);
/** Penalty for a door at cell k: 0 when its whole box is open; walls behind the door weigh double. */
export function doorBoxPenalty(g: Grid, k: number) {
  const x = k % g.w, z = (k / g.w) | 0, h = g.top[k]!;
  let p = 0;
  for (const [dx, dz] of DOOR_BOX) {
    const nx = x + dx, nz = z + dz;
    const open = g.in(nx, nz) && g.walk[g.i(nx, nz)] === 1 && Math.abs(g.top[g.i(nx, nz)]! - h) < 0.05 && !isStairCode(g.surf[g.i(nx, nz)]!);
    if (!open) p += dz < 0 ? 2 : 1;
  }
  return p;
}
/** Keep the door's box free of blocking props and anomaly intrusions placed later. */
export function reserveDoorBox(g: Grid, p: Point) {
  for (const [dx, dz] of DOOR_BOX) {
    const nx = p.x + dx, nz = p.z + dz;
    if (g.in(nx, nz) && g.walk[g.i(nx, nz)]) g.res[g.i(nx, nz)] = g.res[g.i(nx, nz)]! | RES.poi;
  }
}

export function safeToBlock(g: Grid, k: number) {
  const x = k % g.w, z = (k / g.w) | 0;
  if (!g.inner(x, z, 1) || !g.walk[k] || g.res[k]! & PROTECT) return false;
  const h = g.top[k]!;
  // Ring order: N, NE, E, SE, S, SW, W, NW
  const ring = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const walk: boolean[] = ring.map(([dx, dz]) => {
    const q = g.i(x + dx!, z + dz!);
    return g.walk[q] === 1 && Math.abs(g.top[q]! - h) < 0.01 && !isStairCode(g.surf[q]!);
  });
  // Any walkable orthogonal neighbour that is a stair/ramp or differs in height => not safe.
  for (const i of [0, 2, 4, 6]) {
    const [dx, dz] = ring[i]!;
    const q = g.i(x + dx!, z + dz!);
    if (g.walk[q] && !walk[i]) return false;
  }
  // Count runs of walkable cells around the ring (diagonals only bridge between orthogonals).
  const orth = [0, 2, 4, 6].filter((i) => walk[i]);
  if (orth.length <= 1) return true;
  // Walk the ring; orthogonal neighbours must be linked via walkable diagonals.
  let groups = 0;
  for (let i = 0; i < 8; i += 2) {
    if (!walk[i]) continue;
    const prev = (i + 6) % 8, diag = (i + 7) % 8;
    if (walk[prev] && walk[diag]) continue; // connected to previous orthogonal
    groups++;
  }
  if (groups === 0) groups = 1;
  return groups === 1;
}

export function facingToward(from: Point, to: Point): Facing {
  const dx = to.x - from.x, dz = to.z - from.z;
  return Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? "e" : "w") : dz >= 0 ? "s" : "n";
}
export { OPPOSITE };
