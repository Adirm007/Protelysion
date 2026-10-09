// Outdoor floors: terrain → bridges → stairs → streets & plazas → buildings → vegetation.
import { SURFACE, RES, FACING_VEC, flood, legalStep, type Grid } from "./grid";
import {
  legalize, connectTerraces, prune, routeCells, reservePath, toRoad, clearance, safeToBlock, isStairCode, type Draft,
} from "./draft";
import { outdoorTerrain, bridges } from "./terrain";
import { placeBuildings, STYLE_ROOFS } from "./buildings";
import { kitFor } from "./kits";
import type { Point } from "./types";

const S = SURFACE;
const C = (c: string) => c.charCodeAt(0);

/** Nearest walkable cell to (x,z) inside the given band of rows (fraction of height), preferring open space. */
export function pickNear(g: Grid, want: Point, reach: Int32Array | null, clear: Int16Array | null, minClear = 1) {
  let best = -1, bs = Infinity;
  for (let k = 0; k < g.n; k++) {
    if (!g.walk[k] || isStairCode(g.surf[k]!) || (reach && reach[k]! < 0)) continue;
    if (clear && clear[k]! < minClear) continue;
    const x = k % g.w, z = (k / g.w) | 0;
    const s = Math.abs(x - want.x) + Math.abs(z - want.z) * 1.1 - (clear ? Math.min(clear[k]!, 4) * 0.6 : 0);
    if (s < bs) { bs = s; best = k; }
  }
  return best < 0 ? null : { x: best % g.w, z: (best / g.w) | 0 };
}

function markPlaza(d: Draft, c: Point, radius: number, kind: "entry" | "civic" | "junction" | "landing", paint: string) {
  const g = d.g, h = g.top[g.i(c.x, c.z)]!;
  let cells = 0;
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
    if (dx * dx + dz * dz > radius * radius + 0.6) continue;
    const x = c.x + dx, z = c.z + dz;
    if (!g.in(x, z)) continue;
    const k = g.i(x, z);
    if (!g.walk[k] || Math.abs(g.top[k]! - h) > 0.01 || isStairCode(g.surf[k]!)) continue;
    g.res[k] = g.res[k]! | RES.plaza;
    g.surf[k] = C(paint);
    cells++;
  }
  d.plazas.push({ id: `s${d.plazas.length}`, center: { x: c.x, z: c.z }, radius, kind });
  return cells;
}

/** Streets: spawn → civic → down, plus branch streets to far corners, forming at least one loop. */
function streets(d: Draft, pave: string, clear: Int16Array) {
  const g = d.g, r = d.stream("streets");
  const reach = flood(g, d.spawn).seen;
  const bias = new Float32Array(g.n);
  const mainA = routeCells(d, d.spawn, d.down, undefined, clear);
  if (!mainA) return false;
  d.route = mainA;
  reservePath(d, mainA, 1, pave);
  d.roads.push(toRoad("r0", "main", 3, mainA));
  for (const p of mainA) bias[g.i(p.x, p.z)] = 2.5;
  // A civic plaza on the route, in the most open spot of its middle third.
  let civic: Point | null = null, bestOpen = -1;
  for (let i = Math.floor(mainA.length * 0.3); i < Math.floor(mainA.length * 0.7); i++) {
    const p = mainA[i]!, k = g.i(p.x, p.z);
    if (clear[k]! > bestOpen && !isStairCode(g.surf[k]!)) { bestOpen = clear[k]!; civic = p; }
  }
  if (civic && bestOpen >= 3) markPlaza(d, civic, Math.min(4, bestOpen), "civic", S.plaza);
  // Branches: to points spread across the map; routed with a bias away from the main street → loops.
  const targets: Point[] = [];
  const cols = 3;
  for (let i = 0; i < cols; i++) for (const zf of [0.3, 0.7]) targets.push({ x: Math.round(((i + 0.5) / cols) * g.w), z: Math.round(zf * g.h) });
  r.shuffle(targets).slice(0, 4).forEach((t, n) => {
    const p = pickNear(g, t, reach, clear, 2);
    if (!p) return;
    const from = n % 2 === 0 ? d.spawn : d.down;
    const path = routeCells(d, from, p, bias, clear);
    if (!path || path.length < 6) return;
    reservePath(d, path, n === 0 ? 1 : 0, pave);
    d.roads.push(toRoad(`r${d.roads.length}`, n < 2 ? "branch" : "loop", n === 0 ? 3 : 2, path));
    for (const q of path) bias[g.i(q.x, q.z)] = Math.max(bias[g.i(q.x, q.z)]!, 1.5);
    const end = path[path.length - 1]!;
    if (clear[g.i(end.x, end.z)]! >= 3 && r.next() < 0.6) markPlaza(d, end, 2, "junction", S.plaza);
    d.loops++;
  });
  return true;
}

/** Paint natural ground variation (worn earth patches, grass) on unreserved walkable cells. */
function groundVariation(d: Draft, earth: string) {
  const g = d.g, r = d.stream("groundvar");
  const ox = r.range(0, 100), oz = r.range(0, 100);
  for (let k = 0; k < g.n; k++) {
    if (!g.walk[k] || g.res[k]! & (RES.path | RES.plaza) || isStairCode(g.surf[k]!)) continue;
    const c = g.code(k);
    if (c !== S.ground && c !== S.grate) continue;
    const x = k % g.w, z = (k / g.w) | 0;
    const v = Math.sin((x + ox) * 0.37) * Math.cos((z + oz) * 0.29) + Math.sin((x - z) * 0.21 + ox);
    if (v > 1.05) g.surf[k] = C(earth);
  }
}

/** Trees, bushes, rocks on open unreserved ground (blocking single cells, connectivity-safe). */
function vegetation(d: Draft, density: number) {
  const g = d.g, r = d.stream("flora");
  const flora = d.design.flora.filter((f) => f !== "none");
  if (!flora.length) return 0;
  let n = 0;
  const cand: number[] = [];
  for (let k = 0; k < g.n; k++) {
    if (!g.walk[k] || g.res[k]! & (RES.path | RES.corridor | RES.plaza | RES.landing | RES.door | RES.poi)) continue;
    const c = g.code(k);
    if (c !== S.ground && c !== S.worn) continue;
    cand.push(k);
  }
  for (const k of r.shuffle(cand)) {
    if (r.next() > density) continue;
    const x = k % g.w, z = (k / g.w) | 0;
    // Keep trees apart.
    let crowd = false;
    for (let dz = -1; dz <= 1 && !crowd; dz++) for (let dx = -1; dx <= 1; dx++) if (g.code(g.i(x + dx, z + dz)) === S.prop) { crowd = true; break; }
    if (crowd || !safeToBlock(g, k)) continue;
    const kind = r.next() < 0.72 ? "tree" : r.next() < 0.6 ? "bush" : "rock";
    const flavor = r.pick(flora);
    g.block(k, S.prop);
    d.props.push([kind === "tree" ? `tree:${flavor}` : kind, x, z, round2(g.top[k]!), r.int(0, 359), r.int(0, 3), round2(r.range(0.8, 1.25))]);
    n++;
  }
  return n;
}
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Choose spawn at the front (south) and the descent at the back (north), both on open ground. */
function keyPoints(d: Draft) {
  const g = d.g, r = d.stream("keys");
  const clear = clearance(g);
  const reach0 = null;
  const sx = Math.round(g.w * r.range(0.3, 0.7));
  const spawn = pickNear(g, { x: sx, z: g.h - 5 }, reach0, clear, 2) ?? pickNear(g, { x: sx, z: g.h - 5 }, null, null);
  if (!spawn) return false;
  d.spawn = spawn;
  const reach = flood(g, spawn).seen;
  const dx = Math.round(g.w * (spawn.x < g.w / 2 ? r.range(0.55, 0.85) : r.range(0.15, 0.45)));
  const down = pickNear(g, { x: dx, z: 4 }, reach, clear, 2) ?? pickNear(g, { x: dx, z: 4 }, reach, null);
  if (!down) return false;
  d.down = down;
  for (const p of [spawn, down]) g.res[g.i(p.x, p.z)] = g.res[g.i(p.x, p.z)]! | RES.poi | RES.path;
  return true;
}

export function generateOutdoor(d: Draft): boolean {
  const g = d.g, arch = d.archetype, design = d.design;
  const plan = outdoorTerrain(d);
  // Water / chasm / void crossings.
  if (arch === "canal") bridges(d, 6, 4, [2, 3]);
  else if (arch === "canyon") bridges(d, 5, 3, [2, 1]);
  else if (arch === "isles") bridges(d, 9, 9, [2, 1]);
  else if (arch === "cliff" || arch === "grove") bridges(d, 5, 2, [2]);
  // Flights between terraces before edges are legalised (both sides still walkable).
  connectTerraces(d, {
    widths: arch === "town" || arch === "works" ? [3, 2, 4] : arch === "isles" ? [2, 1] : [2, 3, 1],
    maxRise: 2.6, minRegion: 10, cut: arch === "town" ? 0.5 : 0.35, extra: arch === "town" ? 2 : 1,
    kind: arch === "town" || arch === "canal" ? "masonry" : arch === "works" ? "metal" : arch === "isles" ? "wood" : "rock",
  });
  legalize(d);
  if (!keyPoints(d)) return false;
  prune(d);
  if (!g.walk[g.i(d.down.x, d.down.z)]) return false;
  const clear = clearance(g);
  const pave = S.street;
  if (!streets(d, pave, clear)) return false;
  // Buildings along streets. Denser in towns, sparse in groves / isles.
  const town = arch === "town" || arch === "canal" || arch === "works";
  const sizes: [number, number][] = town ? [[5, 4], [6, 4], [4, 4], [6, 5], [7, 5], [5, 5], [4, 3]] : [[4, 4], [5, 4], [4, 3], [5, 5]];
  const enterSizes: [number, number][] = [[7, 6], [6, 6], [8, 6], [7, 5], [6, 5], [5, 5]];
  placeBuildings(d, {
    count: town ? 14 : arch === "isles" ? 6 : 9,
    enterable: arch === "isles" ? 1 : town ? 3 : 2,
    sizes, enterSizes, margin: 3, styleRoofs: STYLE_ROOFS[design.style], floors: town ? [1, 3] : [1, 2],
    kit: kitFor(d.theme), sigChance: town ? 0.9 : arch === "isles" ? 0.6 : 0.8,
  });
  if (!d.buildings.some((b) => b.enterable)) return false; // every outdoor floor has an interior to enter
  groundVariation(d, S.worn);
  vegetation(d, arch === "grove" ? 0.34 : arch === "canyon" || arch === "cliff" ? 0.14 : arch === "isles" ? 0.16 : 0.07);
  void plan; void FACING_VEC; void legalStep; void reservePath;
  d.districts = 1 + d.plazas.length;
  return true;
}
