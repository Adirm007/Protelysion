// P5 map generator (p5-hd2d-2). Deterministic, independent from the combat seed, and guaranteed to
// produce a connected floor: spawn → descent is always reachable and every gameplay point lies on the
// same walkable component. Structure per theme/scene comes from themes.ts.
import { supplierSpawns } from "../supplier";
import { MAP_THEMES } from "./catalog";
import { Random, hash32, inside, distanceSegment } from "./geometry";
import { Grid, SURFACE, RES, DIRS, flood, legalStep, streamOf } from "./grid";
import { newDraft, clearance, isStairCode, type Draft } from "./draft";
import { THEME_DESIGN, SCENE_NAMES, isInterior, sceneLighting } from "./themes";
import { generateOutdoor } from "./outdoor";
import { generateInterior } from "./interior";
import { generateAnomaly, ANOMALY_LABEL } from "./anomaly";
import { dressOutdoor, dressInterior } from "./dressing";
import { propInfo } from "./props";
import type { AnomalyKind, Archetype, FloorLayout, GenerateOptions, Point, POI } from "./types";

export const GENERATOR_VERSION = "p5-hd2d-2" as const;
export const DEFAULT_ANOMALY_CHANCE = 0.02;
const ANOMALY_KINDS: AnomalyKind[] = ["backrooms", "poolrooms", "collage", "misregistered"];
const S = SURFACE;

export function chooseFloorMode(options: GenerateOptions) {
  const { seed, depth, visit, theme } = options;
  const regionSeed = hash32(`${GENERATOR_VERSION}|${seed >>> 0}|${depth}|${visit}|${theme}`);
  const roll = new Random(hash32(`${regionSeed}|anomaly`)).next();
  const chance = options.anomalyChance ?? DEFAULT_ANOMALY_CHANCE;
  const mode = options.anomalyMode ?? "auto";
  return { regionSeed, roll, chance, mode, active: mode === "forced" || (mode === "auto" && roll < chance) };
}

/** Map sizes (cells) per structure. Kept modest: one floor is explored in a few minutes. */
function sizeFor(arch: Archetype | AnomalyKind, r: Random): [number, number] {
  switch (arch) {
    case "town": return [r.pick([46, 50, 54]), r.pick([40, 44])];
    case "canal": return [r.pick([48, 52]), r.pick([40, 44])];
    case "cliff": return [r.pick([48, 52]), r.pick([42, 46])];
    case "canyon": return [r.pick([46, 50]), r.pick([42, 46])];
    case "grove": return [r.pick([46, 50]), r.pick([40, 44])];
    case "isles": return [r.pick([50, 54]), r.pick([42, 46])];
    case "works": return [r.pick([48, 52]), r.pick([40, 44])];
    case "backrooms": case "poolrooms": return [r.pick([40, 44]), r.pick([34, 38])];
    case "collage": case "misregistered": return [r.pick([46, 50]), r.pick([40, 44])];
    case "corridor": return [r.pick([40, 44]), r.pick([30, 32])];
    case "tiered": return [r.pick([32, 36]), r.pick([32, 34])];
    case "platform": return [r.pick([40, 44]), r.pick([28, 30])];
    default: return [r.pick([36, 40]), r.pick([30, 34])];
  }
}

/** POIs on walkable cells: encounters spread along the route, supplier/chest in side spots. */
function placePOIs(d: Draft, seed: number, depth: number, visit: number): POI[] | null {
  const g = d.g;
  const reach = flood(g, d.spawn, d.down);
  if (reach.path.length < 2) return null;
  const route = reach.path;
  const clear = clearance(g);
  const taken: Point[] = [d.spawn, d.down];
  const pois: POI[] = [{ kind: "entry", id: "entry", ...d.spawn }, { kind: "down", id: "down", ...d.down }];
  const free = (x: number, z: number, gap: number) => taken.every((p) => Math.abs(p.x - x) + Math.abs(p.z - z) >= gap);
  const banned = new Set<number>();
  const snap = (want: Point, gap: number, preferOff: boolean) => {
    let best: Point | null = null, bs = Infinity;
    for (let k = 0; k < g.n; k++) {
      if (!g.walk[k] || reach.seen[k]! < 0 || isStairCode(g.surf[k]!) || g.surf[k] === S.door.charCodeAt(0) || banned.has(k)) continue;
      const x = k % g.w, z = (k / g.w) | 0;
      if (!free(x, z, gap)) continue;
      let s = Math.hypot(x - want.x, z - want.z);
      if (preferOff) s += g.res[k]! & RES.path ? 1.5 : 0;
      s -= Math.min(clear[k]!, 3) * 0.4;
      if (s < bs) { bs = s; best = { x, z }; }
    }
    return best;
  };
  const at = (f: number) => route[Math.max(0, Math.min(route.length - 1, Math.round((route.length - 1) * f)))]!;
  const add = (kind: POI["kind"], id: string, want: Point, gap: number, off = false) => {
    for (let tries = 0; tries < 32; tries++) {
      let q = snap(want, gap, off);
      for (let g2 = gap - 1; !q && g2 >= 2; g2--) q = snap(want, g2, off);
      if (!q) return false;
      // An encounter pad must never be the only way through: reject chokepoint cells.
      if (kind === "encounter" && !encountersBypassable(g, d.spawn, [...pois, { kind, id, ...q }])) { banned.add(g.i(q.x, q.z)); continue; }
      taken.push(q);
      pois.push({ kind, id, ...q });
      g.res[g.i(q.x, q.z)] = g.res[g.i(q.x, q.z)]! | RES.poi;
      return true;
    }
    return false;
  };
  if (supplierSpawns(depth, visit, seed)) add("supplier", "supplier", at(0.33), 5, true);
  // Chest: a side room / civic plaza / an enterable house when available (discoverable, off the main line).
  const house = d.rooms.find((rm) => rm.building);
  const civic = d.plazas.find((p) => p.kind === "civic");
  const chestWant = house ? { x: house.x + (house.w >> 1), z: house.z + (house.d >> 1) } : civic?.center ?? at(0.58);
  if (!add("chest", "chest", chestWant, 5, true)) return null;
  for (let i = 0; i < 4; i++) if (!add("encounter", `encounter-${i}`, at(0.3 + i * 0.16), 5)) return null;
  return pois;
}

/** With every encounter pad occupied, the spawn still reaches every other POI and each pad keeps a free
 * neighbour: roaming encounters can be fought or walked around, never seal a corridor shut. */
export function encountersBypassable(g: Grid, spawn: Point, pois: { kind: string; x: number; z: number }[]) {
  const blocked = new Uint8Array(g.n);
  for (const p of pois) if (p.kind === "encounter") blocked[g.i(p.x, p.z)] = 1;
  const s = g.i(spawn.x, spawn.z);
  if (blocked[s] || !g.walk[s]) return false;
  const seen = new Uint8Array(g.n), queue = new Int32Array(g.n);
  seen[s] = 1; queue[0] = s;
  let n = 1;
  for (let k = 0; k < n; k++) {
    const p = queue[k]!, x = p % g.w, z = (p / g.w) | 0;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
      const q = nz * g.w + nx;
      if (seen[q] || blocked[q] || !g.walk[q] || !legalStep(g, p, q)) continue;
      seen[q] = 1; queue[n++] = q;
    }
  }
  for (const p of pois) {
    const k = g.i(p.x, p.z);
    if (p.kind !== "encounter") { if (!seen[k]) return false; continue; }
    let open = false;
    for (const [dx, dz] of DIRS) {
      const nx = p.x + dx, nz = p.z + dz;
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
      const q = nz * g.w + nx;
      if (seen[q] && legalStep(g, q, k)) { open = true; break; }
    }
    if (!open) return false;
  }
  return true;
}

function fingerprintOf(layout: Omit<FloorLayout, "fingerprint" | "id">) {
  return hash32(JSON.stringify({
    t: layout.tiles, s: layout.surface, h: layout.heights, b: layout.buildings, st: layout.stairs, rm: layout.rooms,
    pr: layout.decorations, p: layout.pois, a: layout.anomaly, l: layout.levels,
  })).toString(16).padStart(8, "0");
}

function attempt(options: GenerateOptions, regionSeed: number, active: boolean, tryIndex: number): FloorLayout | null {
  const { seed, depth, visit, theme } = options;
  const profile = MAP_THEMES.find((p) => p.id === theme);
  if (!profile) throw Error(`Unknown map theme ${theme}`);
  const design = THEME_DESIGN[theme]!;
  const scene = ((depth - 1) % 3 + 3) % 3;
  const stream = streamOf(hash32(`${regionSeed}|try${tryIndex}`));
  const pick = stream("structure");
  let archetype: Archetype = options.scheme ?? design.scenes[scene]!;
  let anomaly: AnomalyKind | null = null;
  if (active) {
    anomaly = options.anomalyKind ?? ANOMALY_KINDS[Math.floor(new Random(hash32(`${regionSeed}|anomaly-kind`)).next() * ANOMALY_KINDS.length)]!;
    archetype = anomaly === "collage" || anomaly === "misregistered" ? "town" : anomaly === "poolrooms" ? "pool" : "hall";
  }
  const [w, h] = sizeFor(anomaly ?? archetype, pick);
  const g = new Grid(w, h);
  const interior = !anomaly ? isInterior(archetype) : anomaly === "backrooms" || anomaly === "poolrooms";
  const d = newDraft(g, {
    stream, theme, design, archetype, scheme: anomaly ?? archetype, anomaly, interior,
    lighting: anomaly === "backrooms" || anomaly === "poolrooms" ? "fluorescent" : sceneLighting(design, archetype),
    landMode: interior ? "interior" : "solid",
  });
  let ok: boolean;
  let collage: string | null = null;
  if (anomaly) {
    const others = MAP_THEMES.filter((p) => p.id !== theme);
    collage = others[Math.floor(new Random(hash32(`${regionSeed}|collage`)).next() * others.length)]!.id;
    ok = generateAnomaly(d, collage);
  } else ok = interior ? generateInterior(d) : generateOutdoor(d);
  if (!ok) return null;
  const pois = placePOIs(d, seed, depth, visit);
  if (!pois) return null;
  const lights = interior ? dressInterior(d) : dressOutdoor(d);
  void lights;
  // Final hard guarantee: everything reachable (dressing cannot break it, but verify).
  const reach = flood(g, d.spawn);
  for (const p of pois) if (reach.seen[g.i(p.x, p.z)]! < 0) return null;
  if (!encountersBypassable(g, d.spawn, pois)) return null;
  let walkable = 0;
  for (let k = 0; k < g.n; k++) if (g.walk[k]) { walkable++; if (reach.seen[k]! < 0) return null; }
  const heights: number[] = new Array(g.n);
  let hmin = Infinity, hmax = -Infinity;
  for (let k = 0; k < g.n; k++) {
    heights[k] = Math.round(g.top[k]! * 1000) / 1000;
    if (g.walk[k]) { hmin = Math.min(hmin, g.top[k]!); hmax = Math.max(hmax, g.top[k]!); }
  }
  const surface = g.rows(), tiles = g.tiles();
  const terrain = surface.map((row) => [...row].map((c) => (c === S.water || c === S.pool ? "W" : c === S.void || c === S.pit ? "V" : "L")).join(""));
  const roadMask = surface.map((row, z) => [...row].map((c, x) => {
    const k = z * g.w + x;
    return g.walk[k] && (g.res[k]! & (RES.path | RES.corridor | RES.plaza) || c === S.stair || c === S.bridge) ? (c === S.bridge ? "B" : c === S.stair ? "S" : "R") : " ";
  }).join(""));
  let wallLength = 0;
  for (let z = 0; z < g.h - 1; z++) for (let x = 0; x < g.w - 1; x++) {
    const k = g.i(x, z);
    if (Math.abs(g.top[k]! - g.top[k + 1]!) > 0.6 && g.surf[k] !== S.void.charCodeAt(0) && g.surf[k + 1] !== S.void.charCodeAt(0)) wallLength++;
    if (Math.abs(g.top[k]! - g.top[k + g.w]!) > 0.6 && g.surf[k] !== S.void.charCodeAt(0) && g.surf[k + g.w] !== S.void.charCodeAt(0)) wallLength++;
  }
  const walkLevels = new Set<number>();
  for (let k = 0; k < g.n; k++) if (g.walk[k] && !isStairCode(g.surf[k]!)) walkLevels.add(Math.round(g.top[k]! * 4) / 4);
  const lightCount = d.props.filter((p) => propInfo(p[0]).light).length;
  const roadLength = d.roads.reduce((n, r) => n + r.points.slice(1).reduce((m, p, i) => m + Math.abs(p.x - r.points[i]!.x) + Math.abs(p.z - r.points[i]!.z), 0), 0);
  const themeName = profile.name;
  const base: Omit<FloorLayout, "fingerprint" | "id"> = {
    version: GENERATOR_VERSION,
    seed: seed >>> 0, regionSeed, depth, visit, theme, themeName,
    sceneName: "",
    scheme: d.scheme, archetype: d.archetype, interior, width: w, height: h, landMode: d.landMode, lighting: d.lighting,
    anomaly: {
      active, chance: 0, roll: 0, forced: false,
      kind: anomaly ? ANOMALY_LABEL[anomaly]! : interior ? "室内子场景" : "立体街区",
      intrusions: d.intrusions,
    },
    levels: [...new Set(d.levels.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b),
    roads: d.roads, plazas: d.plazas, landmasses: d.landmasses, buildings: d.buildings, rooms: d.rooms, stairs: d.stairs,
    decorations: d.props, surface, terrain, tiles, roadMask, heights, spawn: d.spawn, down: d.down, pois,
    stats: {
      buildings: d.buildings.length, enterable: d.buildings.filter((b) => b.enterable).length, rooms: d.rooms.length,
      stairs: d.stairs.length, props: d.props.length, blockingProps: d.props.filter((p) => propInfo(p[0]).block).length,
      lights: lightCount, levels: walkLevels.size, heightRange: Math.round((hmax - hmin) * 100) / 100, wallLength,
      walkableCells: walkable, reachableCells: reach.count, entryExitSteps: flood(g, d.spawn, d.down).path.length - 1,
      attempts: tryIndex + 1, loops: d.loops, roadLength, districts: d.districts,
    },
  };
  return base as FloorLayout;
}

export function generateFloor(options: GenerateOptions): FloorLayout {
  const { seed, depth, theme } = options;
  const profile = MAP_THEMES.find((p) => p.id === theme);
  if (!profile) throw Error(`Unknown map theme ${theme}`);
  const { regionSeed, roll, chance, mode, active } = chooseFloorMode(options);
  let layout: FloorLayout | null = null;
  for (let t = 0; t < 8 && !layout; t++) layout = attempt(options, regionSeed, active, t);
  if (!layout) {
    // Deterministic structural fallback: the same theme's sturdiest structure (a hall interior).
    for (let t = 0; t < 8 && !layout; t++) layout = attempt({ ...options, scheme: "hall", anomalyMode: "normal" }, regionSeed, false, 20 + t);
  }
  if (!layout) throw Error(`P5 generator could not build ${theme} depth ${depth} seed ${seed}`);
  layout.anomaly.chance = chance;
  layout.anomaly.roll = roll;
  layout.anomaly.forced = mode !== "auto";
  layout.sceneName = sceneNameFor(theme, depth);
  layout.fingerprint = fingerprintOf(layout);
  layout.id = `floor-${regionSeed.toString(16)}-${layout.fingerprint}`;
  return layout;
}

/** Kept for preview compatibility; scene names now ship in themes.ts. */
export function registerSceneNames(_names: Record<string, string[]>) {}
function sceneNameFor(theme: string, depth: number) {
  const list = SCENE_NAMES[theme];
  return list ? list[((depth - 1) % 3 + 3) % 3] ?? "" : "";
}

/** Kept for compatibility with P4 callers: distance from a point to a polygon (0 inside). */
export function distanceToPolygon(p: Point, poly: Point[]) {
  if (inside(p, poly)) return 0;
  return Math.min(...poly.map((a, i) => distanceSegment(p, a, poly[(i + 1) % poly.length]!)));
}
export { MAP_THEMES, ASSETS } from "./catalog";
export type { FloorLayout, GenerateOptions } from "./types";
