// Low-probability anomaly floors ("back-rooms"-like wrong floors). Always connected, POI-complete.
// Varieties: backrooms (yellow rooms), poolrooms (tiled water halls), collage (another theme's town cut in),
// misregistered (tilted / floating architecture, stairs to nowhere). Every variety adds ≥ 8 intrusions:
// objects that do not belong here, placed only on connectivity-safe cells.
import { SURFACE, RES, flood, label, type Grid } from "./grid";
import { legalize, prune, clearance, routeCells, reservePath, toRoad, safeToBlock, isStairCode, DSU, doorBoxPenalty, reserveDoorBox, type Draft } from "./draft";
import { generateOutdoor } from "./outdoor";
import { addProp } from "./dressing";
import { THEME_DESIGN } from "./themes";
import { STYLE_ROOFS, pickRoof, kindForFootprint } from "./buildings";
import { kitFor } from "./kits";
import type { Point } from "./types";

const S = SURFACE;
export const ANOMALY_LABEL: Record<string, string> = {
  backrooms: "黄色回廊（后室）",
  poolrooms: "无尽泳池房",
  collage: "错页拼贴街区",
  misregistered: "错轴回廊与悬置构筑",
};
const INTRUSIONS = ["busstop", "phonebooth", "bathtub", "car", "swing", "lonedoor", "tv", "grandclock", "tree:broadleaf", "fountain", "bed", "vending", "piano", "streetlamp", "statue", "clockface"];

function solid(g: Grid) { for (let k = 0; k < g.n; k++) { g.block(k, S.wall, 0); g.lvl[k] = -1; } }

/** Place ≥ min intrusions on safe cells away from the main route. */
export function intrude(d: Draft, min: number, source: string) {
  const g = d.g, r = d.stream("intrude");
  const cand: number[] = [];
  for (let k = 0; k < g.n; k++) if (g.walk[k] && !(g.res[k]! & (RES.path | RES.landing | RES.door | RES.poi)) && !isStairCode(g.surf[k]!)) cand.push(k);
  let n = 0;
  const order = r.shuffle(cand);
  for (const spacing of [4, 2, 1]) {
    for (const k of order) {
      if (n >= min + 4 || (spacing < 4 && n >= min)) break;
      const x = k % g.w, z = (k / g.w) | 0;
      if (d.intrusions.some((p) => Math.abs(p.x - x) + Math.abs(p.z - z) < spacing)) continue;
      const kind = r.pick(INTRUSIONS);
      if (addProp(d, kind, x, z, r.int(0, 359), r.int(0, 3), r.range(0.9, 1.15))) {
        d.intrusions.push({ kind, x, z, source });
        n++;
      }
    }
    if (n >= min) break;
  }
  return n;
}

function pickPoints(d: Draft) {
  const g = d.g, clear = clearance(g), r = d.stream("apts");
  const pick = (want: Point, reach: Int32Array | null, door = false) => {
    let best = -1, bs = Infinity;
    for (let k = 0; k < g.n; k++) {
      if (!g.walk[k] || isStairCode(g.surf[k]!) || clear[k]! < 1 || (reach && reach[k]! < 0)) continue;
      // Indoor anomalies: the descent door must be fully visible (see doorBoxPenalty).
      const s = Math.abs((k % g.w) - want.x) + Math.abs(((k / g.w) | 0) - want.z) * 1.2 + (door ? doorBoxPenalty(g, k) * 1000 : 0);
      if (s < bs) { bs = s; best = k; }
    }
    return best < 0 ? null : { x: best % g.w, z: (best / g.w) | 0 };
  };
  const spawn = pick({ x: Math.round(g.w * r.range(0.3, 0.7)), z: g.h - 3 }, null);
  if (!spawn) return false;
  d.spawn = spawn;
  const down = pick({ x: Math.round(g.w * r.range(0.2, 0.8)), z: 2 }, flood(g, spawn).seen, d.interior);
  if (!down) return false;
  d.down = down;
  if (d.interior) reserveDoorBox(g, down);
  for (const p of [spawn, down]) g.res[g.i(p.x, p.z)] = g.res[g.i(p.x, p.z)]! | RES.poi | RES.path;
  return true;
}

/** Irregular room maze on a jittered lattice of wall segments with many openings (the classic yellow rooms). */
function backrooms(d: Draft, pool: boolean) {
  const g = d.g, r = d.stream("backrooms");
  solid(g);
  const M = 2;
  for (let z = M; z < g.h - M; z++) for (let x = M; x < g.w - M; x++) g.ground(g.i(x, z), pool ? S.tile : S.floor, 0);
  // Wall lattice: segments on a 5–7 cell grid, each with random gaps; some pillars.
  const step = pool ? 7 : 5;
  for (let z = M + step; z < g.h - M - 1; z += step + r.int(-1, 1)) for (let x = M; x < g.w - M; x++) if (r.next() < 0.68) g.block(g.i(x, z), S.wall, 0);
  for (let x = M + step; x < g.w - M - 1; x += step + r.int(-1, 1)) for (let z = M; z < g.h - M; z++) if (r.next() < 0.68) g.block(g.i(x, z), S.wall, 0);
  // Pillars and pools.
  for (let i = 0; i < (g.w * g.h) / 55; i++) {
    const x = r.int(M + 1, g.w - M - 2), z = r.int(M + 1, g.h - M - 2), k = g.i(x, z);
    if (!g.walk[k]) continue;
    if (pool && r.next() < 0.55) {
      const w = r.int(2, 5), dd = r.int(2, 4);
      for (let zz = z; zz < Math.min(g.h - M - 1, z + dd); zz++) for (let xx = x; xx < Math.min(g.w - M - 1, x + w); xx++) g.block(g.i(xx, zz), S.pool, -0.5);
    } else g.block(k, S.wall, 0);
  }
  // Ensure one connected space: open walls between components.
  for (let pass = 0; pass < 6; pass++) {
    const { lab, sizes } = label(g, (k) => g.walk[k] === 1);
    if (sizes.length <= 1) break;
    const dsu = new DSU(sizes.length);
    for (let z = M; z < g.h - M; z++) for (let x = M; x < g.w - M; x++) {
      const k = g.i(x, z);
      if (g.walk[k] || g.code(k) === S.pool) continue;
      for (const [a, b] of [[g.i(x - 1, z), g.i(x + 1, z)], [g.i(x, z - 1), g.i(x, z + 1)]] as const) {
        const la = lab[a]!, lb = lab[b]!;
        if (la >= 0 && lb >= 0 && la !== lb && dsu.union(la, lb)) g.ground(k, pool ? S.tile : S.floor, 0);
      }
    }
  }
  // A few steps up/down (split level) for disorientation.
  if (!pool) {
    for (let i = 0; i < 3; i++) {
      const x = r.int(M + 3, g.w - M - 8), z = r.int(M + 3, g.h - M - 8);
      for (let zz = z; zz < z + 5; zz++) for (let xx = x; xx < x + 6; xx++) { const k = g.i(xx, zz); if (g.walk[k]) g.top[k] = 0.4; }
    }
  }
  d.levels = pool ? [0] : [0, 0.4];
  d.rooms.push({ id: "rm0", kind: pool ? "poolrooms" : "backrooms", x: M, z: M, w: g.w - 2 * M, d: g.h - 2 * M, y: 0, building: null });
  // Ramps between the raised patches: legalise will cut edges; add ramp cells (bridge code) where needed.
  for (let z = M; z < g.h - M; z++) for (let x = M; x < g.w - M; x++) {
    const k = g.i(x, z);
    if (!g.walk[k] || g.top[k]! !== 0.4) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const q = g.i(x + dx, z + dz);
      if (g.walk[q] && g.top[q] === 0 && r.next() < 0.25) { g.ground(q, S.bridge, 0.2); }
    }
  }
  legalize(d);
  if (!pickPoints(d)) return false;
  prune(d);
  const path = routeCells(d, d.spawn, d.down);
  if (!path) return false;
  d.route = path;
  reservePath(d, path, 0);
  d.roads.push(toRoad("r0", "corridor", 1, path));
  // Fluorescent panels everywhere (lights), sparse furniture.
  for (let z = M + 2; z < g.h - M; z += 4) for (let x = M + 2; x < g.w - M; x += 4) {
    const k = g.i(x, z);
    if (g.walk[k]) d.props.push(["fluoro", x, z, Math.round(g.top[k]! * 100) / 100, 0, 0, 1]);
  }
  for (let i = 0; i < 18; i++) {
    const x = r.int(M, g.w - M - 1), z = r.int(M, g.h - M - 1);
    addProp(d, pool ? "lounger" : r.pick(["chair", "cabinet", "desk", "plant"]), x, z, r.int(0, 3) * 90, r.int(0, 3), 1);
  }
  return true;
}

export function generateAnomaly(d: Draft, collageTheme: string | null): boolean {
  const kind = d.anomaly!;
  let ok: boolean;
  if (kind === "backrooms" || kind === "poolrooms") {
    ok = backrooms(d, kind === "poolrooms");
    if (ok) intrude(d, 8, "outside");
  } else {
    // Collage and misregistered reuse the outdoor pipeline with a town archetype, then disturb it.
    ok = generateOutdoor(d);
    if (ok) {
      const r = d.stream("disturb");
      if (kind === "misregistered") {
        for (const b of d.buildings) {
          if (r.next() < 0.6) b.yaw = Math.round(r.pick([-24, -16, 14, 22, 31]) * 10) / 10;
          if (r.next() < 0.3) b.lift = Math.round(r.range(1.8, 4.5) * 100) / 100;
        }
        // Stairs to nowhere: freestanding flights on open ground (decor; blocking cells, connectivity-safe).
        const g = d.g;
        let n = 0;
        for (let k = 0; k < g.n && n < 4; k += 37) {
          if (!safeToBlock(g, k) || g.res[k]! & (RES.plaza | RES.corridor)) continue;
          const x = k % g.w, z = (k / g.w) | 0;
          if (addProp(d, "lonedoor", x, z, r.int(0, 3) * 90, 1, 1)) { d.intrusions.push({ kind: "stair-to-nowhere", x, z, source: "misregistered" }); n++; }
        }
      } else {
        // Pages from another book: most houses belong to a different theme (style, roof, materials).
        const other = collageTheme ? THEME_DESIGN[collageTheme] : undefined;
        if (other) for (const b of d.buildings) if (r.next() < 0.7) {
          b.theme = other.id; b.style = other.style; b.roof = pickRoof(r.pick(STYLE_ROOFS[other.style]), b.w, b.d);
          const along = b.facing === "n" || b.facing === "s" ? b.w : b.d, deep = b.facing === "n" || b.facing === "s" ? b.d : b.w;
          b.kind = kindForFootprint(kitFor(other.id), along, deep, b.enterable, r.next());
        }
      }
      intrude(d, 8, kind === "collage" ? collageTheme ?? "elsewhere" : "misregistered");
    }
  }
  void S;
  return ok;
}
