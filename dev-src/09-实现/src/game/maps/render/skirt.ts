// Outer terrain skirt (render only): fills the frame beyond the playable map so the camera never sees
// the void. North rises into hills (backdrop), sides roll, south dips toward the camera with foreground
// foliage that the near depth-of-field blurs — the classic HD-2D diorama framing.
import { hash3 } from "./mesh";
import { bushCluster, blendAt, type Ctx } from "./ground";

export function buildSkirt(ctx: Ctx, margin = 16) {
  const { L, W, H, mb } = ctx;
  if (L.interior || L.archetype === "isles") return;
  const M = margin, EW = W + 2 * M, EH = H + 2 * M;
  const hgt = new Float32Array(EW * EH), known = new Uint8Array(EW * EH);
  const ix = (x: number, z: number) => (z + M) * EW + (x + M);
  // Seed from the boundary ring (map cells coded Z) with their rendered tops.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (x > 1 && z > 1 && x < W - 2 && z < H - 2) continue;
    hgt[ix(x, z)] = ctx.boundTop[z * W + x]!; known[ix(x, z)] = 1;
  }
  // Diffuse outward, then add per-side trend + rolling noise.
  for (let it = 0; it < 40; it++) {
    for (let z = -M; z < H + M; z++) for (let x = -M; x < W + M; x++) {
      const k = ix(x, z);
      if (known[k] || (x >= 0 && z >= 0 && x < W && z < H)) continue;
      let s = 0, n = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz;
        if (nx < -M || nz < -M || nx >= W + M || nz >= H + M) continue;
        const q = ix(nx, nz);
        if (it === 0 && !known[q] && !(nx >= 0 && nz >= 0 && nx < W && nz < H)) continue;
        s += hgt[q]!; n++;
      }
      if (n) hgt[k] = s / n;
    }
  }
  const noise = (x: number, z: number) => {
    const f = (a: number, b: number) => hash3(((Math.floor(a) * 73856093) ^ (Math.floor(b) * 19349663)) | 0);
    const sm = (a: number, b: number, sc: number) => {
      const ax = a / sc, bz = b / sc, x0 = Math.floor(ax), z0 = Math.floor(bz), tx = ax - x0, tz = bz - z0;
      const u = tx * tx * (3 - 2 * tx), v = tz * tz * (3 - 2 * tz);
      return f(x0, z0) * (1 - u) * (1 - v) + f(x0 + 1, z0) * u * (1 - v) + f(x0, z0 + 1) * (1 - u) * v + f(x0 + 1, z0 + 1) * u * v;
    };
    return sm(x, z, 7) * 0.7 + sm(x + 50, z - 30, 3) * 0.3;
  };
  const outside = (x: number, z: number) => Math.max(-x, x - (W - 1), -z, z - (H - 1), 0);
  const finalH = (x: number, z: number) => {
    // Clamp into the skirt grid (2 m far quads may reach one cell past it on odd-sized maps).
    x = Math.max(-M, Math.min(W + M - 1, x)); z = Math.max(-M, Math.min(H + M - 1, z));
    const k = ix(x, z), d = outside(x, z);
    if (d === 0) return hgt[k]!;
    const north = z < 0 ? -z : 0, south = z > H - 1 ? z - (H - 1) : 0;
    let h = hgt[k]! + (noise(x, z) - 0.5) * Math.min(1, d / 4) * 2.2;
    h += north * 0.55 + (south ? -south * 0.12 : 0) + (x < 0 || x > W - 1 ? d * 0.2 : 0);
    return h;
  };
  const corner = (cx: number, cz: number) => {
    // corner between cells (cx-1..cx, cz-1..cz); average existing
    let s = 0, n = 0, ringMin = Infinity;
    for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
      const x = cx + dx, z = cz + dz;
      if (x < -M || z < -M || x >= W + M || z >= H + M) continue;
      if (x >= 0 && z >= 0 && x < W && z < H) { ringMin = Math.min(ringMin, ctx.boundTop[z * W + x]!); continue; }
      s += finalH(x, z); n++;
    }
    if (ringMin < Infinity) return ringMin - 0.03;
    return n ? s / n : 0;
  };
  const ground = ctx.layer("ground"), ground2 = ctx.layer("ground2"), cliff = ctx.layer("cliff");
  const prev = mb.group;
  mb.group = "skirt";
  // Near band (≤ 4 m from the map): 1 m quads. Beyond: 2 m quads with no AO (it is blurred by DOF anyway).
  const quadAt = (x0: number, z0: number, sz: number, far: boolean) => {
    const a = far ? finalH(x0, z0 + sz - 1) : corner(x0, z0 + 1), b = far ? finalH(x0 + sz - 1, z0 + sz - 1) : corner(x0 + 1, z0 + 1);
    const c = far ? finalH(x0 + sz - 1, z0) : corner(x0 + 1, z0), d = far ? finalH(x0, z0) : corner(x0, z0);
    const slope = Math.max(a, b, c, d) - Math.min(a, b, c, d);
    const mat = slope > 1.1 * sz ? cliff : ground;
    const X0 = x0 - 0.5, X1 = x0 - 0.5 + sz, Z0 = z0 - 0.5, Z1 = z0 - 0.5 + sz;
    mb.quad([X0, a, Z1], [X1, b, Z1], [X1, c, Z0], [X0, d, Z0], { layer: mat, layerB: mat === cliff ? cliff : ground2, blend: [blendAt(X0, Z1), blendAt(X1, Z1), blendAt(X1, Z0), blendAt(X0, Z0)], noAO: far });
  };
  const NEAR = 4;
  for (let z = -M; z < H + M; z++) for (let x = -M; x < W + M; x++) {
    if (x >= 0 && z >= 0 && x < W && z < H) continue;
    const d = outside(x, z);
    if (d <= NEAR) quadAt(x, z, 1, false);
    else if ((x + M) % 2 === 0 && (z + M) % 2 === 0) {
      // Only emit a 2 m quad when all four covered cells are beyond the near band.
      if (outside(x + 1, z) > NEAR && outside(x, z + 1) > NEAR && outside(x + 1, z + 1) > NEAR) quadAt(x, z, 2, true);
      else { for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) if (outside(x + dx, z + dz) > NEAR && !(x + dx >= 0 && z + dz >= 0 && x + dx < W && z + dz < H)) quadAt(x + dx, z + dz, 1, true); }
    }
  }
  // Ring outer curtains (cover seams where the skirt dips below the ring's outer edge).
  const retain = ctx.layer(ctx.wild ? "cliff" : "retain");
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const y = ctx.boundTop[z * W + x]!;
    if (z === 0) mb.quad([x + 0.5, y - 3, z - 0.5], [x - 0.5, y - 3, z - 0.5], [x - 0.5, y, z - 0.5], [x + 0.5, y, z - 0.5], { layer: retain });
    if (z === H - 1) mb.quad([x - 0.5, y - 3, z + 0.5], [x + 0.5, y - 3, z + 0.5], [x + 0.5, y, z + 0.5], [x - 0.5, y, z + 0.5], { layer: retain });
    if (x === 0) mb.quad([x - 0.5, y - 3, z - 0.5], [x - 0.5, y - 3, z + 0.5], [x - 0.5, y, z + 0.5], [x - 0.5, y, z - 0.5], { layer: retain });
    if (x === W - 1) mb.quad([x + 0.5, y - 3, z + 0.5], [x + 0.5, y - 3, z - 0.5], [x + 0.5, y, z - 0.5], [x + 0.5, y, z + 0.5], { layer: retain });
  }
  // Vegetation: a tree wall behind (north / sides), sparse bushes, and a few big foreground plants to the
  // south (blurred by the near depth of field). Distant trees use cheap crowns.
  const flora = ctx.L.interior ? [] : ctx.flora;
  const treeKinds = flora && flora.length ? flora : ["broadleaf"];
  let trees = 0;
  const maxTrees = ctx.quality === "desktop" ? 150 : 70;
  for (let z = -M; z < H + M; z++) for (let x = -M; x < W + M; x++) {
    if (x >= -1 && z >= -1 && x <= W && z <= H) continue;
    const d = outside(x, z), r = hash3(x * 131 + z * 71 + 5);
    const south = z > H - 1;
    const density = south ? (d < 5 ? 0.05 : 0.012) : d < 3 ? 0.2 : d < 8 ? 0.09 : 0.04;
    if (r > density || trees >= maxTrees) continue;
    const y = finalH(x, z);
    const kindR = hash3(x * 17 + z * 29);
    if (treeKinds[0] !== "none" && kindR < (south ? 0.45 : 0.8)) {
      const k = treeKinds[Math.floor(hash3(x * 3 + z * 5) * treeKinds.length)]!;
      const cheap = d > 6;
      if (cheap && (k === "broadleaf" || k === "maple" || k === "birch" || k === "willow" || k === "paper")) {
        const sc = 1 + hash3(x * 7 + z) * 0.6, hh = 2.4 * sc;
        mb.cyl(x, y, z, 0.18 * sc, 0.12 * sc, hh * 0.6, 5, { layer: ctx.layer("bark"), noAO: true }, false);
        mb.blob(x, y + hh * 0.95, z, 1.2 * sc, 1.0 * sc, 1.2 * sc, { layer: ctx.layer("leaves"), noAO: true }, 1, 0.5, x * 13 + z);
      } else ctx.tree?.(x + (hash3(x * 7919 + z) - 0.5) * 0.6, y, z + (hash3(z * 7919 + x + 3) - 0.5) * 0.6, k, 1 + hash3(x * 7 + z) * 0.6);
      trees++;
    } else if (!(treeKinds[0] === "none" && !south) && d < 8) bushCluster(ctx, x, z, y, 0.7 + hash3(x + z * 3) * 0.5);
  }
  mb.group = prev;
}
