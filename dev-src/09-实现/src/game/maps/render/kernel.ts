// P5 render kernel: FloorLayout → packed meshes + texture layers + lights + lighting preset.
// Deterministic and engine-neutral. Consumed by the three.js preview and by Godot (via JavaScriptBridge).
import type { FloorLayout } from "../types";
import { THEME_DESIGN, ANOMALY_DESIGN } from "../themes";
import { buildSkirt } from "./skirt";
import { propInfo } from "../props";
import { MeshBuilder, type Batch, type Pass } from "./mesh";
import { Field, LightGrid, type PointLight } from "./field";
import { buildTextures, TEX, type Layer } from "./textures";
import { lightingFor, type LightingPreset } from "./lighting";
import { buildGround, computeBoundTops, type Ctx } from "./ground";
import { buildBuilding, buildingHeight, buildingVolumes } from "./architecture";
import { buildProp, treeModel } from "./props3d";
import { hex, type RGB } from "./color";

export const KERNEL_VERSION = "p5-kernel-1" as const;
export type Quality = "desktop" | "mobile";
export type MeshChunk = {
  key: string;
  pass: Pass;
  /** "b:<id>" building shell, "b:<id>:cut" parts hidden while inside, "b:<id>:in" interior, or chunk "x,z". */
  group: string;
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  color: Float32Array;
  layer: Float32Array;
  lamp: Float32Array;
  index: Uint32Array;
  bounds: [number, number, number, number, number, number];
};
export type KernelOutput = {
  version: typeof KERNEL_VERSION;
  fingerprint: string;
  quality: Quality;
  chunks: MeshChunk[];
  textures: { size: number; layers: Layer[]; index: Record<string, number> };
  lights: PointLight[];
  lighting: LightingPreset;
  enterable: { id: string; x: number; z: number; w: number; d: number; door: { x: number; z: number } }[];
  stats: { triangles: number; vertices: number; chunks: number; lights: number; buildMs: number; layers: number };
  camera: { fov: number; pitch: number; distance: number; yaw: number };
  sky: { top: RGB; bottom: RGB };
};

export function buildFloorMesh(L: FloorLayout, quality: Quality = "desktop"): KernelOutput {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const themeDesign = THEME_DESIGN[L.theme]!;
  const base = L.scheme === "backrooms" || L.scheme === "poolrooms" ? ANOMALY_DESIGN[L.scheme] : themeDesign;
  const design = base;
  const lighting = lightingFor(themeDesign, L.lighting);
  const foreign = [...new Set(L.buildings.map((b) => b.theme).filter((t) => t !== L.theme && THEME_DESIGN[t]))].map((t) => THEME_DESIGN[t]!);
  const tex = buildTextures(base, foreign);
  const FALLBACK: Record<string, string> = { a_crystal: "glass", a_salt: "a_plaster", a_cork: "wood", a_velvet: "cloth", a_poster: "a_sign", a_flat: "a_sign" };
  const baseLayer = (id: string) => tex.index[id] ?? tex.index[FALLBACK[id] ?? "wall"] ?? tex.index["wall"]!;
  const layer = baseLayer;
  const W = L.width, H = L.height;
  const top = (x: number, z: number) => (x < 0 || z < 0 || x >= W || z >= H ? 0 : L.heights[z * W + x]!);
  const s = (x: number, z: number) => (x < 0 || z < 0 || x >= W || z >= H ? "Z" : L.surface[z]![x]!);
  const walk = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < H && L.tiles[z]![x] === ".";
  const boundTop = computeBoundTops(L, top, s);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < W * H; i++) { minY = Math.min(minY, L.heights[i]!, boundTop[i]!); maxY = Math.max(maxY, L.heights[i]!, boundTop[i]!); }
  for (const b of L.buildings) maxY = Math.max(maxY, b.baseY + b.lift + buildingHeight(b) + 2);
  minY = Math.max(minY, -7);
  const field = new Field(L, minY, maxY + 1);
  const waterY = L.landMode === "canal" ? -0.2 : L.landMode === "coast" ? -0.4 : L.archetype === "grove" ? Math.min(...L.levels) - 0.55 : -1.1;
  // Terrain columns into the occupancy field.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = s(x, z);
    let yTop: number;
    if (c === "V") continue;
    if (c === "Z" || c === "R" || c === "X") yTop = boundTop[z * W + x]!;
    else if (c === "W") yTop = waterY - 1.1;
    else if (c === "K") yTop = -6.5;
    else if (c === "C" || c === "E" && !L.interior) yTop = top(x, z) + 0.4;
    else yTop = top(x, z);
    field.fillBox(x - 0.5, minY - 1, z - 0.5, x + 0.5, yTop, z + 0.5);
  }
  for (const b of L.buildings) for (const v of buildingVolumes(b)) field.fillBox(v.x0, v.y0, v.z0, v.x1, v.y1, v.z1);
  for (const p of L.decorations) {
    const info = propInfo(p[0]);
    if (!info.block) continue;
    const hgt = p[0].startsWith("tree") ? 1.4 : info.tall ? 1.8 : 0.7;
    field.fillBox(p[1] - 0.32, p[3], p[2] - 0.32, p[1] + 0.32, p[3] + hgt, p[2] + 0.32);
  }
  const mb = new MeshBuilder();
  tex.layers.forEach((l, i) => { if (l.course) mb.courses.set(i, l.course); });
  const ctx: Ctx = {
    L, mb, field, layer, W, H, top, s, walk, waterY,
    wild: ["cliff", "canyon", "grove", "isles"].includes(L.archetype) && !L.interior || L.archetype === "cave",
    quality, lights: [], glowColor: hex(design.pal.glow), lampColor: lighting.lampColor, boundTop,
  };
  mb.ao = (x, y, z, nx, ny, nz) => field.ao(x, y, z, nx, ny, nz);
  ctx.flora = design.flora.filter((f) => f !== "none");
  ctx.tree = (x: number, y: number, z: number, kind: string, k: number) => { mb.push(hash3i(x, z) * 360, x, y, z, k); treeModel(ctx, kind, Math.floor(x * 31 + z * 17)); mb.pop(); };
  buildGround(ctx);
  buildSkirt(ctx);
  for (const b of L.buildings) {
    // Collage floors: houses from another book use that theme's materials.
    if (b.theme !== L.theme && foreign.length) ctx.layer = (id: string) => tex.index[`${b.theme}:${id}`] ?? tex.index[`${b.theme}:${FALLBACK[id] ?? "wall"}`] ?? baseLayer(id);
    buildBuilding(ctx, b);
    ctx.layer = baseLayer;
  }
  L.decorations.forEach((p, i) => {
    const info = propInfo(p[0]);
    if (quality === "mobile" && !info.block && !info.light && i % 2 === 1) return;
    buildProp(ctx, p, i);
  });
  // Bake point lights into vertex colours (additive, stored as rgb > 1 allowed; alpha keeps blend).
  const lights = ctx.lights;
  const grid = new LightGrid(lights, 6);
  const lampK = lighting.lamp;
  for (const bt of mb.batches.values()) bakeLights(bt, grid, field, lampK);
  // Assemble chunks.
  const chunks: MeshChunk[] = [];
  let triangles = 0, vertices = 0;
  for (const [key, bt] of mb.batches) {
    if (!bt.vertices) continue;
    const pass = key.split(/[,|]/).pop() as Pass;
    const group = key.includes("|") ? key.split("|")[0]! : "terrain:" + key.split(",").slice(0, 2).join(",");
    const pos = bt.pos.view().slice();
    let bx0 = Infinity, by0 = Infinity, bz0 = Infinity, bx1 = -Infinity, by1 = -Infinity, bz1 = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      bx0 = Math.min(bx0, pos[i]!); by0 = Math.min(by0, pos[i + 1]!); bz0 = Math.min(bz0, pos[i + 2]!);
      bx1 = Math.max(bx1, pos[i]!); by1 = Math.max(by1, pos[i + 1]!); bz1 = Math.max(bz1, pos[i + 2]!);
    }
    chunks.push({
      key, pass, group, position: pos, normal: bt.nor.view().slice(), uv: bt.uv.view().slice(), color: bt.col.view().slice(),
      layer: bt.lay.view().slice(), lamp: bt.lamp.view().slice(), index: bt.idx.view().slice(), bounds: [bx0, by0, bz0, bx1, by1, bz1],
    });
    triangles += bt.triangles; vertices += bt.vertices;
  }
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    version: KERNEL_VERSION, fingerprint: L.fingerprint, quality, chunks,
    textures: { size: TEX, layers: tex.layers, index: tex.index },
    lights: lights.map((l) => ({ ...l, x: +l.x.toFixed(2), y: +l.y.toFixed(2), z: +l.z.toFixed(2) })),
    lighting,
    enterable: L.buildings.filter((b) => b.enterable).map((b) => ({ id: b.id, x: b.x, z: b.z, w: b.w, d: b.d, door: b.door })),
    stats: { triangles, vertices, chunks: chunks.length, lights: lights.length, buildMs: Math.round(t1 - t0), layers: tex.layers.length },
    camera: { fov: 24, pitch: L.interior ? 50 : 36, distance: L.interior ? 34 : 38, yaw: 0 },
    sky: { top: lighting.bgTop, bottom: lighting.bgBottom },
  };
}

const hash3i = (x: number, z: number) => { let h = Math.imul(Math.floor(x * 7) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.floor(z * 13), 0xc2b2ae35); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

/** Add baked point-light irradiance to vertex colours: warm pools under lamps with soft falloff + occlusion. */
function bakeLights(bt: Batch, grid: LightGrid, field: Field, k: number) {
  if (k <= 0.01) return;
  const P = bt.pos.a, N = bt.nor.a, C = bt.lamp.a;
  for (let v = 0, n = bt.vertices; v < n; v++) {
    if (bt.dark.has(v)) continue;
    const x = P[v * 3]!, y = P[v * 3 + 1]!, z = P[v * 3 + 2]!;
    const nx = N[v * 3]!, ny = N[v * 3 + 1]!, nz = N[v * 3 + 2]!;
    let r = 0, g = 0, b = 0;
    for (const l of grid.near(x, z)) {
      const dx = l.x - x, dy = l.y - y, dz = l.z - z, d = Math.hypot(dx, dy, dz);
      if (d > l.radius || d < 1e-3) continue;
      const lam = Math.max(0, (dx * nx + dy * ny + dz * nz) / d);
      if (lam <= 0) continue;
      const fall = Math.pow(1 - d / l.radius, 2) / (1 + d * 0.35);
      if (d > 1.2 && !field.visible(x + nx * 0.08, y + ny * 0.08, z + nz * 0.08, l.x, l.y, l.z)) continue;
      const e = lam * fall * l.intensity * k * 1.35;
      r += (l.color[0] / 255) * e; g += (l.color[1] / 255) * e; b += (l.color[2] / 255) * e;
    }
    if (r + g + b <= 0) continue;
    C[v * 3] = r; C[v * 3 + 1] = g; C[v * 3 + 2] = b;
  }
}
