// Building plans (hd2d-architecture-3): resolve a Building (rules layer) into a concrete architectural
// plan — language style sheet, kind preset, massing blocks, porch, and the solid volumes used for baked
// AO — before any geometry is emitted. Deterministic from the building seed.
import type { Building } from "../../types";
import { hash3 } from "../mesh";
import { kitFor, type Lang, type ThemeKit } from "../../kits";

export type WinKind = "rect" | "arch" | "pointed" | "segment" | "lattice" | "round" | "slit" | "strip" | "sash";
export type DoorKind = "plank" | "double" | "sliding" | "glass" | "rollup" | "saloon" | "hide";
export type RoofKind = "gable" | "hip" | "halfhip" | "mansard" | "gambrel" | "irimoya" | "pyramid" | "shed" | "flat" | "barrel" | "saw" | "dome" | "cone" | "none";
export type MatRole = "G" | "U" | "P" | "T" | "F" | "R" | "S" | "D" | "X";

export type Style = {
  lang: Lang;
  fh: number; plinth: number;
  mat: Record<MatRole, string>;
  roof: RoofKind; pitch: number; eave: number; rafters: boolean; brackets: boolean;
  ridge: "none" | "finial" | "shachi" | "cresting";
  win: WinKind; winU: WinKind; winW: number; winH: number; sill: number;
  mull: "cross" | "grid" | "vert" | "none" | "lead";
  shutters: number; flowers: number; surround: "none" | "frame" | "stone" | "keystone";
  door: DoorKind; doorArch: boolean;
  cornice: "none" | "band" | "dentil" | "bracket" | "timber";
  quoins: boolean; course: boolean; jetty: number; frame: "none" | "post" | "half";
  gallery: number; balcony: number; porch: number; arcade: number; bay: number;
  chimney: number; dormer: number; crossGable: number; wing: number;
  lamp: "sconce" | "lantern" | "paper" | "neon" | "torch" | "none";
  sign: "shield" | "board" | "banner" | "noren" | "neon" | "plaque" | "none";
  awning: number; falseFront: number; shopfront: boolean;
  clutter: string[];
  bayW: number;
  snow: boolean; ruin: number;
};

const BASE: Style = {
  lang: "medieval", fh: 2.7, plinth: 0.35,
  mat: { G: "stone", U: "a_plaster", P: "stone", T: "a_wood", F: "darkwood", R: "roof", S: "a_shutter", D: "darkwood", X: "cloth" },
  roof: "gable", pitch: 0.9, eave: 0.35, rafters: false, brackets: false, ridge: "none",
  win: "rect", winU: "rect", winW: 0.72, winH: 1.1, sill: 0.85, mull: "cross",
  shutters: 0.4, flowers: 0.4, surround: "frame", door: "plank", doorArch: false,
  cornice: "band", quoins: false, course: false, jetty: 0, frame: "none",
  gallery: 0, balcony: 0.1, porch: 0, arcade: 0, bay: 0, chimney: 0.5, dormer: 0.3, crossGable: 0.2, wing: 0.25,
  lamp: "lantern", sign: "shield", awning: 0.25, falseFront: 0, shopfront: false,
  clutter: ["barrel", "crate"], bayW: 1.5, snow: false, ruin: 0,
};

const M = (G: string, U: string, P: string, T: string, F: string, R: string, S: string, D: string, X: string): Record<MatRole, string> => ({ G, U, P, T, F, R, S, D, X });

const LANG: Record<Lang, Partial<Style>> = {
  medieval: {
    mat: M("stone", "a_plaster", "stone", "a_wood", "a_timber", "roof", "a_timber", "a_timber", "cloth"),
    roof: "gable", pitch: 1.05, eave: 0.32, win: "rect", winU: "rect", winW: 0.66, winH: 1.0, mull: "lead", shutters: 0.45, flowers: 0.5,
    door: "plank", doorArch: true, cornice: "timber", jetty: 0.3, frame: "half", chimney: 0.75, dormer: 0.55, crossGable: 0.4, wing: 0.4,
    lamp: "lantern", sign: "shield", awning: 0.25, clutter: ["barrel", "crate", "sack", "bench"], bayW: 1.45,
  },
  mediterranean: {
    fh: 2.85, plinth: 0.3, mat: M("a_plaster", "a_plaster", "stone", "stone", "a_wood", "a_roof2", "a_shutter", "a_wood", "a_awning"),
    roof: "hip", pitch: 0.46, eave: 0.55, rafters: true, brackets: true, win: "rect", winU: "arch", winW: 0.72, winH: 1.35, mull: "cross",
    shutters: 0.8, flowers: 0.65, surround: "stone", door: "double", doorArch: true, cornice: "dentil", quoins: true, course: true,
    balcony: 0.5, arcade: 0.3, chimney: 0.35, dormer: 0, crossGable: 0, wing: 0.35, lamp: "lantern", sign: "shield", awning: 0.5,
    clutter: ["pot", "pot", "barrel", "crate"], bayW: 1.6,
  },
  frontier: {
    fh: 2.9, plinth: 0.42, mat: M("a_siding", "a_siding", "a_wood", "a_paint", "a_wood", "a_roof2", "a_shutter", "a_wood", "cloth"),
    roof: "gable", pitch: 0.55, eave: 0.3, win: "sash", winU: "sash", winW: 0.74, winH: 1.35, mull: "vert", shutters: 0.25, flowers: 0.1,
    surround: "frame", door: "double", cornice: "bracket", falseFront: 0.9, porch: 0.85, gallery: 0.55, chimney: 0.3, dormer: 0, crossGable: 0, wing: 0.2,
    lamp: "lantern", sign: "board", awning: 0.1, clutter: ["barrel", "crate", "trough", "rail", "sack"], bayW: 1.6,
  },
  eastern: {
    fh: 2.75, plinth: 0.55, mat: M("a_plaster", "a_plaster", "stone", "darkwood", "a_lacquer", "roof", "darkwood", "a_lattice", "cloth"),
    roof: "irimoya", pitch: 0.62, eave: 0.85, rafters: true, brackets: true, ridge: "shachi", win: "lattice", winU: "lattice", winW: 1.05, winH: 1.05, sill: 0.8, mull: "none",
    shutters: 0, flowers: 0, surround: "frame", door: "sliding", cornice: "none", frame: "post", gallery: 0.55, balcony: 0, porch: 0.35,
    chimney: 0, dormer: 0, crossGable: 0, wing: 0.3, lamp: "paper", sign: "plaque", awning: 0, clutter: ["pot", "barrel", "crate"], bayW: 1.7,
  },
  victorian: {
    fh: 3.0, plinth: 0.45, mat: M("a_brick", "a_brick", "stone", "stone", "darkwood", "roof", "a_shutter", "darkwood", "a_awning"),
    roof: "mansard", pitch: 0.95, eave: 0.3, win: "sash", winU: "segment", winW: 0.72, winH: 1.5, mull: "vert", shutters: 0.15, flowers: 0.35,
    surround: "keystone", door: "double", cornice: "bracket", quoins: true, course: true, bay: 0.45, balcony: 0.3, chimney: 0.9, dormer: 0.75,
    crossGable: 0.3, wing: 0.3, lamp: "lantern", sign: "board", awning: 0.55, clutter: ["crate", "barrel", "sack"], bayW: 1.5,
  },
  industrial: {
    fh: 3.2, plinth: 0.22, mat: M("a_concrete", "a_corr", "a_concrete", "metal", "metal", "a_roof2", "metal", "metal", "a_corr"),
    roof: "gable", pitch: 0.28, eave: 0.25, win: "strip", winU: "strip", winW: 1.3, winH: 0.9, sill: 1.3, mull: "grid", shutters: 0, flowers: 0,
    surround: "none", door: "rollup", cornice: "none", chimney: 0.25, dormer: 0, crossGable: 0, wing: 0.35, lamp: "sconce", sign: "board", awning: 0.15,
    clutter: ["crate", "drum", "drum", "pallet"], bayW: 2.0,
  },
  urban: {
    fh: 3.0, plinth: 0.18, mat: M("a_concrete", "a_concrete", "a_concrete", "metal", "metal", "a_concrete", "metal", "glass", "a_neon"),
    roof: "flat", win: "rect", winU: "rect", winW: 1.1, winH: 1.25, sill: 0.9, mull: "vert", shutters: 0, flowers: 0.1, surround: "frame",
    door: "glass", cornice: "band", balcony: 0.55, chimney: 0, dormer: 0, crossGable: 0, wing: 0.2, lamp: "neon", sign: "neon", awning: 0.4,
    clutter: ["ac", "crate", "bin", "bin"], bayW: 1.9,
  },
  tribal: {
    fh: 2.4, plinth: 0.15, mat: M("a_batten", "a_batten", "stone", "a_wood", "a_wood", "a_roof2", "a_wood", "cloth2", "cloth"),
    roof: "gable", pitch: 1.2, eave: 0.6, win: "slit", winU: "slit", winW: 0.4, winH: 0.5, sill: 1.1, mull: "none", shutters: 0, flowers: 0,
    surround: "none", door: "hide", cornice: "none", chimney: 0, dormer: 0, crossGable: 0, wing: 0, lamp: "torch", sign: "banner", awning: 0,
    clutter: ["pot", "pot", "sack"], bayW: 2.0,
  },
  nordic: {
    fh: 2.6, plinth: 0.42, mat: M("a_log", "a_siding", "stone", "a_paint", "darkwood", "roof", "a_shutter", "darkwood", "cloth"),
    roof: "gable", pitch: 1.2, eave: 0.4, win: "rect", winU: "rect", winW: 0.66, winH: 0.95, mull: "cross", shutters: 0.3, flowers: 0.25,
    surround: "frame", door: "plank", cornice: "none", chimney: 0.85, dormer: 0.3, crossGable: 0.25, porch: 0.35, wing: 0.3,
    lamp: "lantern", sign: "shield", awning: 0, clutter: ["woodpile", "barrel", "crate"], bayW: 1.4,
  },
  organic: {
    mat: M("wall", "wall", "wall2", "wall2", "wall2", "wall", "wall2", "wall2", "cloth"),
    roof: "dome", win: "round", winU: "round", winW: 0.8, winH: 0.8, mull: "none", shutters: 0, flowers: 0, surround: "frame", door: "hide",
    cornice: "none", chimney: 0, dormer: 0, crossGable: 0, lamp: "none", sign: "none", awning: 0, clutter: ["pot"], bayW: 1.8,
  },
  arcane: {
    mat: M("stone", "stone", "stone", "wall2", "wall2", "roof", "wall2", "wall2", "cloth"),
    roof: "pyramid", pitch: 1.3, win: "pointed", winU: "pointed", winW: 0.6, winH: 1.5, mull: "none", shutters: 0, flowers: 0, surround: "stone",
    door: "double", doorArch: true, cornice: "band", chimney: 0, dormer: 0, crossGable: 0, lamp: "sconce", sign: "none", awning: 0, clutter: [], bayW: 1.8,
  },
  classical: {
    fh: 3.1, plinth: 0.55, mat: M("stone", "a_plaster", "stone", "stone", "stone", "roof", "a_shutter", "darkwood", "cloth"),
    roof: "hip", pitch: 0.4, eave: 0.4, win: "arch", winU: "arch", winW: 0.8, winH: 1.7, mull: "cross", shutters: 0, flowers: 0.2, surround: "keystone",
    door: "double", doorArch: true, cornice: "dentil", quoins: true, course: true, arcade: 0.45, balcony: 0.2, chimney: 0, dormer: 0, crossGable: 0,
    lamp: "lantern", sign: "none", awning: 0, clutter: ["pot"], bayW: 1.8,
  },
  whimsy: {
    mat: M("a_plaster", "a_plaster", "stone", "a_wood", "a_timber", "roof", "a_shutter", "a_timber", "cloth"),
    roof: "gable", pitch: 1.25, eave: 0.4, win: "round", winU: "arch", winW: 0.7, winH: 0.9, mull: "cross", shutters: 0.3, flowers: 0.5, frame: "half",
    door: "plank", doorArch: true, cornice: "timber", jetty: 0.2, chimney: 0.7, dormer: 0.4, crossGable: 0.2, lamp: "lantern", sign: "shield", awning: 0.3,
    clutter: ["barrel", "pot"], bayW: 1.5,
  },
};

/** Per-theme style adjustments (materials / roof / accents) layered over the language. */
const THEME_STYLE: Record<string, Partial<Style>> = {
  T01: { ruin: 0.7, mat: M("a_concrete", "a_brick", "a_concrete", "metal", "metal", "a_corr", "metal", "metal", "a_corr"), roof: "flat", win: "rect", winU: "rect", winW: 0.9, winH: 1.2, door: "rollup" },
  T04: { roof: "gable" },
  T06: { ruin: 0.35 },
  T08: { roof: "gable", mat: M("stone", "stone", "stone", "stone", "darkwood", "roof", "a_shutter", "darkwood", "a_awning") },
  T09: { mat: M("a_concrete", "wall", "a_concrete", "metal", "metal", "a_concrete", "metal", "glass", "a_neon") },
  T11: { roof: "gable", mat: M("a_brick", "a_brick", "stone", "stone", "darkwood", "roof", "a_shutter", "darkwood", "a_awning") },
  T12: { mat: M("stone", "a_siding", "stone", "a_paint", "darkwood", "roof", "a_shutter", "darkwood", "cloth") },
  T14: { mat: M("a_plaster", "a_plaster", "stone", "stone", "a_wood", "roof", "a_shutter", "a_wood", "a_awning"), roof: "flat" },
  T15: { mat: M("a_plaster", "a_plaster", "book", "a_wood", "darkwood", "roof", "a_shutter", "a_wood", "paper") },
  T17: { mat: M("a_concrete", "glass", "a_concrete", "metal", "metal", "a_concrete", "metal", "glass", "a_neon") },
  T18: { mat: M("a_siding", "a_siding", "a_concrete", "a_paint", "a_wood", "a_roof2", "a_shutter", "glass", "a_neon"), sign: "neon", lamp: "neon" },
  T20: { mat: M("a_log", "a_log", "stone", "a_paint", "darkwood", "roof", "a_shutter", "darkwood", "cloth") },
  T21: { roof: "hip" },
  T22: { mat: M("wall", "a_plaster", "stone", "a_wood", "darkwood", "roof", "a_shutter", "a_wood", "cloth") },
  T29: { mat: M("a_plaster", "a_plaster", "stone", "a_paint", "a_wood", "roof", "a_shutter", "a_wood", "cloth") },
  T31: { mat: M("wall", "wall", "wall", "a_wood", "a_wood", "wall", "a_shutter", "a_wood", "a_awning"), roof: "flat", falseFront: 0, porch: 0.4, gallery: 0 },
  T33: { sign: "neon", lamp: "paper" },
  T36: { mat: M("a_siding", "a_siding", "stone", "a_paint", "a_wood", "a_roof2", "a_shutter", "a_wood", "cloth"), falseFront: 0.2, porch: 0.9 },
  T38: { jetty: 0.36 },
  T41: { mat: M("a_brick", "a_brick", "stone", "stone", "darkwood", "roof", "a_shutter", "darkwood", "a_awning"), roof: "gable" },
  T43: { mat: M("a_plaster", "a_plaster", "stone", "darkwood", "a_wood", "roof", "darkwood", "a_lattice", "cloth") },
};

/** Kind presets for the generic house builder. */
type Preset = Partial<Style> & { floorsMin?: number; floorsMax?: number; long?: boolean; tall?: boolean };
const KIND: Record<string, Preset> = {
  townhouse: { floorsMin: 2 },
  cottage: { floorsMax: 2, pitch: 1.15, chimney: 0.95, flowers: 0.75, dormer: 0.7, balcony: 0, gallery: 0 },
  house: {},
  shop: { shopfront: true, awning: 0.85 },
  inn: { floorsMin: 2, gallery: 0.7, balcony: 0.6, awning: 0.3 },
  hall: { long: true, arcade: 0.5, crossGable: 0.5 },
  workshop: { floorsMax: 1, chimney: 1, wing: 0.7, door: "double", shopfront: false },
  tower: { tall: true, floorsMin: 3, wing: 0, porch: 0, gallery: 0, crossGable: 0, dormer: 0, balcony: 0.2, shutters: 0.2 },
  lodge: { porch: 0.8, chimney: 1, crossGable: 0.6 },
  teahouse: { floorsMin: 2, gallery: 0.85, porch: 0.6, sign: "noren" },
  paperhouse: { mat: M("a_lattice", "a_lattice", "stone", "a_lacquer", "a_lacquer", "roof", "darkwood", "a_lattice", "paper"), gallery: 0.3 },
  adobe: { roof: "flat", win: "rect", winU: "rect", winW: 0.55, winH: 0.75, mull: "none", surround: "none", cornice: "none", porch: 0.5, falseFront: 0, gallery: 0, chimney: 0.3 },
  chapel: { long: true, win: "pointed", winU: "pointed", winW: 0.6, winH: 1.9, sill: 1.0, roof: "gable", pitch: 1.1, chimney: 0, dormer: 0, crossGable: 0, wing: 0, shutters: 0, flowers: 0, sign: "none", awning: 0, porch: 0.3 },
  motel: { long: true, floorsMin: 2, floorsMax: 2, gallery: 1, porch: 1, roof: "flat", falseFront: 0, sign: "neon", awning: 0 },
  diner: { floorsMax: 1, roof: "flat", win: "strip", winU: "strip", winW: 1.5, winH: 1.1, sill: 0.8, mull: "vert", falseFront: 0, porch: 0, sign: "neon", awning: 0.6, shopfront: true },
  konbini: { floorsMax: 1, roof: "flat", shopfront: true, sign: "neon", awning: 0, mat: M("a_concrete", "a_concrete", "a_concrete", "metal", "metal", "a_concrete", "metal", "glass", "a_neon") },
  mixeduse: { floorsMin: 2, roof: "flat", shopfront: true, awning: 0.7, balcony: 0.7 },
  terminal: { floorsMax: 1, roof: "flat", win: "strip", winU: "strip", winW: 2.2, winH: 2.0, sill: 0.3, mull: "grid", door: "glass", shopfront: true },
  shelter: { roof: "flat", win: "rect", winU: "rect", shutters: 0, flowers: 0, balcony: 0, chimney: 0.3, ruin: 0.5 },
  postoffice: { floorsMin: 2, crossGable: 1, awning: 0.6, sign: "board" },
  longhouse: { long: true, pitch: 1.25, eave: 0.55 },
  shed: { floorsMax: 1, door: "rollup", win: "strip", winU: "strip", winW: 1.4, shopfront: false, porch: 0, gallery: 0, chimney: 0.15, dormer: 0, wing: 0.5, balcony: 0, awning: 0.1 },
  watermill: { floorsMax: 2, chimney: 0.6, wing: 0, porch: 0 },
};

export type Rect = { x0: number; x1: number; z0: number; z1: number };
export type Block = Rect & { y0: number; floors: number; fh: number; roof: RoofKind; pitch: number; role: "main" | "wing" | "tower"; jetty: number; alongX: boolean };
export type Vol = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
export type Plan = {
  b: Building; kind: string; lang: Lang; kit: ThemeKit; st: Style;
  W: number; D: number; lotH: number;
  blocks: Block[];
  porch: null | { depth: number; x0: number; x1: number; gallery: boolean };
  /** Projecting bay window stack on the front (bay index, storeys). */
  bay: null | { i: number; floors: number };
  vols: Vol[]; height: number;
  tint: [number, number, number];
  special: boolean;
  r: (i: number) => number;
};

export const SPECIAL = new Set([
  "watertower", "windmill", "silo", "barn", "container", "gasstation", "pagoda", "pavilion", "stilthut", "roundhut", "hidetent", "watchtower",
  "circustent", "booth", "aframe", "stavechurch", "clocktower", "observatory", "lighthouse", "minehead", "domehouse", "shellhouse", "wreckhouse",
  "bookhouse", "origami", "bookstack", "penciltower", "shavingpavilion", "eraserhut", "umbrellahouse", "corkhouse", "bottledome", "driftshack",
  "inverted", "saltblock", "obelisk", "ringtemple", "shardhouse", "hexhive", "ribhouse", "podtower", "crttower", "scrapstilt", "stage", "shrine",
  "controltower", "stationhall", "gantry", "prismchapel", "colonnade", "rotunda", "flytower", "tesseract", "subwaycar",
  "theater", "puppetbooth", "scenerystore", "carousel",
]);

const cache = new WeakMap<Building, Plan>();

/** Lot size in the building's local frame (across the front × depth). */
export function lotSize(b: Building) {
  const across = b.facing === "s" || b.facing === "n" ? b.w : b.d, deep = b.facing === "s" || b.facing === "n" ? b.d : b.w;
  return { W: across - 0.08, D: deep - 0.08 };
}

export function planBuilding(b: Building): Plan {
  const hit = cache.get(b);
  if (hit) return hit;
  const kit = kitFor(b.theme);
  const kind = b.kind && (SPECIAL.has(b.kind) || KIND[b.kind]) ? b.kind : "house";
  const r = (i: number) => hash3(b.seed + i * 7919);
  const { W, D } = lotSize(b);
  const lp = LANG[kit.lang] ?? {};
  const tp = THEME_STYLE[b.theme] ?? {};
  const kp = KIND[kind] ?? {};
  const st: Style = { ...BASE, ...lp, ...tp, ...kp, mat: { ...BASE.mat, ...(lp.mat ?? {}), ...(tp.mat ?? {}), ...(kp.mat ?? {}) }, lang: kit.lang };
  st.snow = kit.deco.includes("snowcap");
  if (kit.deco.includes("ruin")) st.ruin = Math.max(st.ruin, 0.4);
  const tints = kit.tints ?? [[1, 1, 1]];
  const tint = tints[Math.floor(r(3) * tints.length) % tints.length]!;
  const plan: Plan = { b, kind, lang: kit.lang, kit, st, W, D, lotH: st.plinth, blocks: [], porch: null, bay: null, vols: [], height: 0, tint, special: SPECIAL.has(kind), r };
  if (plan.special) specialPlan(plan);
  else housePlan(plan, kp);
  cache.set(b, plan);
  return plan;
}

/** Massing for the generic house: main block, optional wing / tower, front porch. */
function housePlan(p: Plan, kp: Preset) {
  const { b, st, W, D, r } = p;
  let floors = Math.max(kp.floorsMin ?? 1, Math.min(kp.floorsMax ?? 3, b.floors));
  if (kp.tall) floors = Math.max(3, Math.min(4, b.floors + 1));
  const enter = b.enterable;
  if (enter) floors = Math.min(floors, 2);
  // Porch / gallery depth (front) — only on deep lots so the house keeps ≥3 m of depth.
  let porchD = 0;
  if (!kp.tall && D >= 4.4 && r(11) < st.porch) porchD = st.lang === "eastern" ? 0.9 : 1.2;
  const bodyZ1 = D / 2 - porchD, bodyZ0 = -D / 2;
  // Roof choice.
  const alongX = W >= D - porchD - 0.01;
  let roof: RoofKind = st.roof;
  if (st.lang === "mediterranean" && r(12) < 0.3) roof = "gable";
  if (st.lang === "medieval" && r(12) < 0.25) roof = "halfhip";
  if (st.lang === "victorian" && r(12) < 0.45) roof = "gable";
  if (st.lang === "nordic" && r(12) < 0.15) roof = "halfhip";
  if (st.lang === "industrial" && !kp.tall) roof = r(12) < 0.35 ? "saw" : r(12) < 0.6 ? "barrel" : r(12) < 0.85 ? "gable" : "flat";
  if (st.lang === "frontier" && st.falseFront > 0 && r(13) < st.falseFront) roof = "gable";
  if (kp.tall) roof = st.lang === "eastern" ? "irimoya" : st.lang === "urban" || st.lang === "industrial" ? "flat" : st.lang === "mediterranean" || st.lang === "classical" ? "pyramid" : r(12) < 0.5 ? "pyramid" : "cone";
  if (p.kind === "shed") roof = st.lang === "industrial" || st.lang === "urban" ? (r(12) < 0.5 ? "saw" : "barrel") : st.lang === "eastern" ? "irimoya" : "gable";
  if (kp.roof) roof = kp.roof;
  // Wing: a lower side block (cross-gable look) on wide lots.
  const wantWing = !kp.tall && !enter && W >= 5.2 && (floors >= 2 || p.kind === "shed" || p.kind === "workshop") && r(14) < st.wing && p.kind !== "watermill";
  const main: Block = { x0: -W / 2, x1: p.kind === "watermill" ? W / 2 - 1.05 : W / 2, z0: bodyZ0, z1: bodyZ1, y0: st.plinth, floors, fh: st.fh, roof, pitch: st.pitch, role: "main", jetty: st.frame === "half" ? st.jetty : 0, alongX };
  if (p.kind === "watermill") main.alongX = main.x1 - main.x0 >= main.z1 - main.z0;
  if (p.kind === "shed" && (st.lang === "industrial" || st.lang === "urban")) main.pitch = 0.3;
  p.blocks.push(main);
  if (wantWing) {
    const ww = Math.min(2.6, Math.max(1.8, W * 0.38)), left = r(15) < 0.5;
    const wing: Block = { ...main, floors: Math.max(1, floors - 1), fh: floors === 1 ? st.fh * 0.8 : st.fh, role: "wing", jetty: 0, roof: st.lang === "eastern" ? "irimoya" : roof === "flat" ? "flat" : "gable", alongX: false, z1: bodyZ1 + (st.lang === "urban" ? 0 : 0.0), z0: bodyZ0 + 0.4 };
    if (left) { wing.x0 = -W / 2; wing.x1 = -W / 2 + ww; main.x0 = -W / 2 + ww; }
    else { wing.x1 = W / 2; wing.x0 = W / 2 - ww; main.x1 = W / 2 - ww; }
    main.alongX = main.x1 - main.x0 >= main.z1 - main.z0 - 0.01;
    p.blocks.push(wing);
  }
  if (porchD > 0) p.porch = { depth: porchD, x0: -W / 2, x1: W / 2, gallery: floors >= 2 && r(16) < st.gallery };
  if (p.kind === "chapel" || p.kind === "longhouse" || (st.lang === "tribal" && !kp.tall)) main.alongX = false;
  // Bay window stack (victorian / whimsy) on a front bay that is not the door bay.
  const mw = main.x1 - main.x0, nb = Math.max(1, Math.floor((mw - 0.3) / st.bayW));
  if (!porchD && !kp.tall && nb >= 2 && r(17) < st.bay && p.kind !== "shop" && D - porchD >= 3.6) p.bay = { i: r(18) < 0.5 ? 0 : nb - 1, floors: Math.max(1, Math.min(floors, 1 + Math.floor(r(19) * floors))) };
  // Volumes for AO (walls only for enterable interiors).
  for (const bl of p.blocks) {
    const top = bl.y0 + bl.floors * bl.fh;
    if (enter && bl.role === "main") {
      const t = 0.35;
      p.vols.push({ x0: bl.x0, x1: bl.x1, z0: bl.z0, z1: bl.z0 + t, y0: 0, y1: top });
      p.vols.push({ x0: bl.x0, x1: bl.x0 + t, z0: bl.z0, z1: bl.z1, y0: 0, y1: top });
      p.vols.push({ x0: bl.x1 - t, x1: bl.x1, z0: bl.z0, z1: bl.z1, y0: 0, y1: top });
      p.vols.push({ x0: bl.x0, x1: bl.x1, z0: bl.z1 - t, z1: bl.z1, y0: 0, y1: top });
    } else p.vols.push({ x0: bl.x0, x1: bl.x1, z0: bl.z0, z1: bl.z1, y0: 0, y1: top });
    const span = bl.alongX ? bl.z1 - bl.z0 : bl.x1 - bl.x0;
    const rise = bl.roof === "flat" ? 0.6 : bl.roof === "cone" || bl.roof === "pyramid" ? span * 0.5 * st.pitch * 1.5 : span * 0.5 * bl.pitch;
    if (bl.roof !== "flat") p.vols.push({ x0: bl.x0 + span * 0.18, x1: bl.x1 - span * 0.18, z0: bl.z0 + span * 0.18, z1: bl.z1 - span * 0.18, y0: top, y1: top + rise * 0.45 });
    p.height = Math.max(p.height, top + rise + 0.6);
  }
  p.vols.push({ x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2, y0: -0.3, y1: Math.min(st.plinth, 0.3) });
}

/** Special kinds: rough massing for AO + height (their builders produce the geometry). */
function specialPlan(p: Plan) {
  const { W, D, kind, b } = p;
  const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) => p.vols.push({ x0, x1, z0, z1, y0, y1 });
  const hw = W / 2, hd = D / 2;
  p.lotH = 0.25;
  switch (kind) {
    case "watertower": box(-0.9, 0.9, -0.9, 0.9, 4.2, 6.6); p.height = 8.4; break;
    case "windmill": box(-1.0, 1.0, -1.0, 1.0, 0, 6.5); p.height = 10; break;
    case "silo": box(-1.0, 1.0, -1.0, 1.0, 0, 7.5); p.height = 9; break;
    case "lighthouse": box(-0.9, 0.9, -0.9, 0.9, 0, 8.5); p.height = 11.5; break;
    case "clocktower": box(-hw + 0.5, hw - 0.5, -hd + 0.5, hd - 0.5, 0, 10.5); p.height = 15; break;
    case "pagoda": box(-hw + 0.7, hw - 0.7, -hd + 0.7, hd - 0.7, 0, 8); p.height = 13; break;
    case "stavechurch": box(-hw + 0.6, hw - 0.6, -hd + 0.6, hd - 0.6, 0, 5); p.height = 12; break;
    case "observatory": box(-hw + 0.6, hw - 0.6, -hd + 0.6, hd - 0.6, 0, 3.6); p.height = 7.5; break;
    case "minehead": box(-hw + 0.8, hw - 0.8, -hd + 1.2, hd - 1.4, 0, 2.8); p.height = 10; break;
    case "watchtower": box(-0.9, 0.9, -0.9, 0.9, 5.2, 7.0); p.height = 9.5; break;
    case "controltower": box(-0.9, 0.9, -0.9, 0.9, 0, 8.5); p.height = 12; break;
    case "crttower": box(-1.0, 1.0, -1.0, 1.0, 0, 7.5); p.height = 10; break;
    case "gasstation": box(hw - 2.6, hw - 0.4, -hd + 0.4, -hd + 2.4, 0, 2.8); p.height = 5.4; break;
    case "circustent": box(-hw + 1.3, hw - 1.3, -hd + 1.3, hd - 1.3, 0, 3.2); p.height = 8.5; break;
    case "pavilion": case "stage": case "colonnade": box(-hw + 0.8, hw - 0.8, -hd + 0.8, hd - 0.8, 3.0, 3.6); p.height = 6; break;
    case "gantry": box(-hw + 0.5, hw - 0.5, -hd + 0.5, -hd + 1.5, 0, 7); p.height = 10; break;
    case "penciltower": box(-0.9, 0.9, -0.9, 0.9, 0, 3 + b.floors * 2.2); p.height = 6 + b.floors * 2.2; break;
    case "hexhive": box(-hw + 0.6, hw - 0.6, -hd + 0.6, hd - 0.6, 0, b.floors * 2.4); p.height = b.floors * 2.4 + 2; break;
    case "bookstack": box(-hw + 0.5, hw - 0.5, -hd + 0.5, hd - 0.5, 0, 7.5); p.height = 10; break;
    case "prismchapel": case "obelisk": case "ringtemple": case "shardhouse": case "tesseract": box(-hw * 0.5, hw * 0.5, -hd * 0.5, hd * 0.5, 0, 4); p.height = 9; break;
    case "stilthut": case "scrapstilt": box(-hw + 0.5, hw - 0.5, -hd + 0.5, hd - 0.5, 2.0, 4.6); p.height = 7.5; break;
    case "flytower": box(-hw + 0.5, hw - 0.5, -hd + 0.5, hd - 0.5, 0, 9); p.height = 11; break;
    case "theater": box(-hw + 0.25, hw - 0.25, -hd + 1.25, hd - 0.45, 0, 5.8); box(-Math.min(hw - 0.6, 2.2), Math.min(hw - 0.6, 2.2), -hd + 0.3, -hd + 2.75, 0, 9.6); p.height = 11.4; break;
    case "puppetbooth": box(-1.4, 1.4, -hd + 0.5, -hd + 2.7, 2.3, 4.5); p.height = 6.2; break;
    case "scenerystore": box(-hw + 0.3, hw - 0.3, -hd + 0.3, -hd + 0.9, 0, 3.2); p.height = 5.3; break;
    case "carousel": box(-0.5, 0.5, -0.5, 0.5, 0, 3.3); box(-hw + 0.5, hw - 0.5, -hd + 0.5, hd - 0.5, 3.3, 3.7); p.height = 6.4; break;
    default: {
      const h = kind === "container" ? 2.6 * Math.max(1, b.floors) : kind === "inverted" ? 6 : kind === "shed" || kind === "barn" ? 4.2 : 3.2;
      box(-hw + 0.3, hw - 0.3, -hd + 0.3, hd - 0.3, 0, h);
      p.height = h + (kind === "barn" ? 3.4 : 2.5);
    }
  }
  p.vols.push({ x0: -hw, x1: hw, z0: -hd, z1: hd, y0: -0.3, y1: 0.2 });
}

/** World-space AO boxes for the kernel's occupancy field. */
export function buildingVolumes(b: Building) {
  const p = planBuilding(b);
  const yaw = ({ s: 0, e: 90, n: 180, w: 270 }[b.facing] + b.yaw) * Math.PI / 180;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const cx = b.x + (b.w - 1) / 2, cz = b.z + (b.d - 1) / 2, y = b.baseY + b.lift;
  return p.vols.map((v) => {
    const xs: number[] = [], zs: number[] = [];
    for (const [lx, lz] of [[v.x0, v.z0], [v.x1, v.z0], [v.x1, v.z1], [v.x0, v.z1]] as const) { xs.push(cx + c * lx + s * lz); zs.push(cz - s * lx + c * lz); }
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: y + v.y0, y1: y + v.y1 };
  });
}
export const buildingTop = (b: Building) => planBuilding(b).height;
