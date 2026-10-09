// Prop geometry for the P5 kernel. Every prop kind from props.ts has a compact low-poly model.
import { baseKind } from "../props";
import type { PropTuple } from "../types";
import { hash3, type FaceOpts } from "./mesh";
import { bushCluster, type Ctx } from "./ground";

export function buildProp(ctx: Ctx, p: PropTuple, i: number) {
  const [rawKind, x, z, y, rot, variant, scale] = p;
  const head = rawKind.split(":")[0]!;
  const kind = head === "theme" ? baseKind(rawKind.split(":")[1]!) : head === "tree" ? "tree" : baseKind(rawKind);
  const flavor = rawKind.split(":")[1] ?? "";
  const mb = ctx.mb, L = (id: string) => ctx.layer(id);
  const h = (k: number) => hash3(i * 131 + k * 17 + x * 7 + z * 3);
  const o = (id: string, extra: Partial<FaceOpts> = {}): FaceOpts => ({ layer: L(id), ...extra });
  const light = (lx: number, ly: number, lz: number, radius: number, intensity: number, color = ctx.lampColor, k = "lamp") => {
    const w = mb.apply(lx, ly, lz);
    ctx.lights.push({ x: w[0], y: w[1], z: w[2], color, radius, intensity, kind: k });
  };
  mb.push(rot, x, y, z, scale);
  switch (kind) {
    case "tree": treeModel(ctx, flavor || "broadleaf", i); break;
    case "bush": bushCluster(ctx, 0, 0, 0, 0.6); break;
    case "rock": mb.blob(0, 0.18, 0, 0.45, 0.32, 0.4, o("cliff"), 1, 0.5, i); mb.blob(0.3, 0.1, 0.2, 0.2, 0.16, 0.2, o("cliff"), 1, 0.5, i + 3); break;
    case "stump": mb.cyl(0, 0, 0, 0.3, 0.26, 0.35, 8, o("bark"), true, o("wood")); break;
    case "barrel": for (let k = 0; k < (variant % 2 ? 2 : 1); k++) { const ox = k * 0.5 - (variant % 2 ? 0.25 : 0); mb.cyl(ox, 0, 0, 0.26, 0.3, 0.42, 10, o("wood"), false); mb.cyl(ox, 0.42, 0, 0.3, 0.26, 0.42, 10, o("wood"), true, o("darkwood")); mb.cyl(ox, 0.2, 0, 0.29, 0.29, 0.05, 10, o("metal"), false); mb.cyl(ox, 0.62, 0, 0.29, 0.29, 0.05, 10, o("metal"), false); } break;
    case "crates": case "crate": mb.bevelBox(0, 0, 0, 0.62, 0.55, 0.62, 0.03, o("wood")); if (variant % 3 !== 0) mb.bevelBox(0.08, 0.55, -0.05, 0.46, 0.4, 0.46, 0.03, o("wood")); if (variant === 2) mb.bevelBox(0.45, 0, 0.3, 0.4, 0.36, 0.4, 0.02, o("wood")); break;
    case "sacks": for (let k = 0; k < 3; k++) mb.blob(-0.2 + k * 0.22, 0.2, (k % 2) * 0.15, 0.2, 0.22, 0.18, o("cloth2"), 1, 0.2, i + k); break;
    case "pot": mb.cyl(0, 0, 0, 0.18, 0.26, 0.42, 10, o("roof"), false); mb.cyl(0, 0.42, 0, 0.26, 0.2, 0.06, 10, o("roof")); mb.card(0, 0.4, 0, 0.6, 0.5, 30, o("flowers", { wind: true })); mb.card(0, 0.4, 0, 0.6, 0.5, 120, o("flowers", { wind: true })); break;
    case "planterbox": mb.bevelBox(0, 0, 0, 0.9, 0.4, 0.5, 0.03, o("wood")); bushCluster(ctx, 0, 0, 0.35, 0.4); break;
    case "bench": mb.box(0, 0.4, 0, 1.3, 0.07, 0.42, o("wood")); mb.box(0, 0.62, -0.2, 1.3, 0.3, 0.06, o("wood")); for (const sx of [-0.55, 0.55]) mb.box(sx, 0, 0, 0.07, 0.4, 0.4, o("metal")); break;
    case "cart": mb.bevelBox(0, 0.45, 0, 1.2, 0.35, 0.8, 0.03, o("wood")); for (const sz of [-0.45, 0.45]) { mb.push(90, 0.1, 0.32, sz); mb.cyl(0, -0.03, 0, 0.32, 0.32, 0.06, 10, o("darkwood")); mb.pop(); } mb.beam([-0.6, 0.55, 0.2], [-1.3, 0.2, 0.2], 0.06, o("wood")); mb.beam([-0.6, 0.55, -0.2], [-1.3, 0.2, -0.2], 0.06, o("wood")); mb.blob(0, 0.9, 0, 0.45, 0.2, 0.3, o("cloth2"), 1, 0.3, i); break;
    case "stall": {
      const c = variant % 2 ? "cloth" : "cloth2";
      mb.bevelBox(0, 0, 0, 1.5, 0.85, 0.7, 0.03, o("wood"));
      for (const [sx, sz] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.4], [0.7, 0.4]] as const) mb.box(sx, 0, sz, 0.07, 2.1, 0.07, o("darkwood"));
      mb.quad([-0.85, 1.85, 0.7], [0.85, 1.85, 0.7], [0.85, 2.25, -0.4], [-0.85, 2.25, -0.4], o(c, { doubleSided: true, uvScale: 1 }));
      for (let k = 0; k < 4; k++) mb.blob(-0.5 + k * 0.33, 0.95, 0.05, 0.14, 0.1, 0.14, o(k % 2 ? "leaves" : "roof"), 0, 0.2, i + k);
      mb.box(-0.3, 0.85, -0.15, 0.4, 0.25, 0.3, o("wood"));
      break;
    }
    case "well": mb.cyl(0, 0, 0, 0.55, 0.55, 0.7, 12, o("stone"), true, o("water")); for (const sx of [-0.5, 0.5]) mb.box(sx, 0.7, 0, 0.08, 1.2, 0.08, o("darkwood")); mb.beam([-0.6, 1.9, 0], [0, 2.3, 0], 0.07, o("roof")); mb.beam([0.6, 1.9, 0], [0, 2.3, 0], 0.07, o("roof")); mb.quad([-0.7, 1.85, 0.45], [0.7, 1.85, 0.45], [0.7, 2.3, 0], [-0.7, 2.3, 0], o("roof", { doubleSided: true })); mb.quad([0.7, 1.85, -0.45], [-0.7, 1.85, -0.45], [-0.7, 2.3, 0], [0.7, 2.3, 0], o("roof", { doubleSided: true })); mb.cyl(0, 1.1, 0, 0.12, 0.1, 0.2, 8, o("wood")); break;
    case "fountain": {
      mb.cyl(0, 0, 0, 0.95, 0.95, 0.45, 16, o("stone"), true, o("water"));
      mb.cyl(0, 0.45, 0, 0.18, 0.14, 0.9, 8, o("stone"));
      mb.cyl(0, 1.3, 0, 0.45, 0.15, 0.18, 12, o("stone"), true, o("water"));
      mb.cyl(0, 1.48, 0, 0.08, 0.05, 0.35, 6, o("stone"));
      break;
    }
    case "statue": mb.bevelBox(0, 0, 0, 0.8, 0.9, 0.8, 0.05, o("stone")); mb.cyl(0, 0.9, 0, 0.22, 0.2, 0.9, 8, o("stone")); mb.blob(0, 2.0, 0, 0.2, 0.24, 0.2, o("stone"), 1, 0.1, i); mb.beam([0, 1.6, 0], [0.35, 1.95, 0.1], 0.1, o("stone")); break;
    case "noticeboard": for (const sx of [-0.55, 0.55]) mb.box(sx, 0, 0, 0.09, 1.9, 0.09, o("darkwood")); mb.box(0, 0.9, 0, 1.2, 0.8, 0.06, o("wood")); for (let k = 0; k < 4; k++) mb.box(-0.35 + k * 0.23, 1.0 + (k % 2) * 0.28, 0.04, 0.18, 0.22, 0.01, o("paper")); mb.quad([-0.7, 1.75, 0.25], [0.7, 1.75, 0.25], [0.7, 1.95, -0.1], [-0.7, 1.95, -0.1], o("roof", { doubleSided: true })); break;
    case "signpost": mb.box(0, 0, 0, 0.1, 2.0, 0.1, o("darkwood")); mb.box(0.3, 1.6, 0, 0.7, 0.2, 0.05, o("wood")); mb.box(-0.25, 1.3, 0, 0.6, 0.2, 0.05, o("wood")); break;
    case "streetlamp": {
      const metal = o("metal");
      mb.cyl(0, 0, 0, 0.12, 0.1, 0.25, 8, metal);
      mb.cyl(0, 0.25, 0, 0.05, 0.04, 2.35, 6, metal, false);
      mb.beam([0, 2.5, 0], [0.35, 2.65, 0], 0.04, metal);
      mb.box(0.35, 2.28, 0, 0.26, 0.34, 0.26, o("window", { emissive: 1 }));
      mb.cyl(0.35, 2.62, 0, 0.2, 0.02, 0.16, 4, metal);
      light(0.35, 2.4, 0, 7, 1.15);
      break;
    }
    case "lantern": mb.box(0, 0, 0, 0.3, 0.05, 0.3, o("darkwood")); mb.box(0, 0.05, 0, 0.26, 0.42, 0.26, o("window", { emissive: 1 })); mb.cyl(0, 0.47, 0, 0.2, 0.02, 0.18, 4, o("darkwood")); light(0, 0.35, 0, 4.5, 0.9); break;
    case "brazier": mb.cyl(0, 0, 0, 0.12, 0.3, 0.8, 8, o("metal")); mb.blob(0, 0.9, 0, 0.22, 0.25, 0.22, o("window", { emissive: 1 }), 1, 0.4, i); light(0, 1.1, 0, 6, 1.3, [255, 160, 90], "fire"); break;
    case "woodpile": for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) { mb.push(90, -0.25 + k * 0.25 + r * 0.12, 0.13 + r * 0.22, 0); mb.cyl(0, -0.4, 0, 0.12, 0.12, 0.8, 7, o("bark"), true, o("wood")); mb.pop(); } break;
    case "haybale": mb.bevelBox(0, 0, 0, 0.9, 0.55, 0.6, 0.08, o("ground2", { tint: [1.2, 1.1, 0.7] })); break;
    case "fence": for (let k = 0; k < 3; k++) mb.box(-0.4 + k * 0.4, 0, 0, 0.08, 0.95, 0.08, o("darkwood")); mb.box(0, 0.7, 0, 1.0, 0.08, 0.05, o("wood")); mb.box(0, 0.35, 0, 1.0, 0.08, 0.05, o("wood")); break;
    case "cone": mb.cyl(0, 0, 0, 0.18, 0.03, 0.55, 8, o("cloth")); mb.box(0, 0, 0, 0.42, 0.04, 0.42, o("cloth")); break;
    case "bollard": mb.cyl(0, 0, 0, 0.12, 0.1, 0.8, 8, o("metal")); break;
    case "mailboxes": for (let k = 0; k < 2; k++) mb.bevelBox(-0.22 + k * 0.44, 0.9, 0, 0.36, 0.5, 0.4, 0.04, o(k ? "cloth" : "metal")); mb.box(0, 0, 0, 0.1, 0.9, 0.1, o("darkwood")); break;
    case "vending": mb.bevelBox(0, 0, 0, 0.9, 1.9, 0.75, 0.04, o("metal")); mb.box(0, 0.9, 0.38, 0.7, 0.8, 0.02, o("window", { emissive: 1 })); light(0, 1.2, 0.6, 3.5, 0.8, [170, 220, 255], "neon"); break;
    case "pump": mb.cyl(0, 0, 0, 0.14, 0.12, 1.0, 8, o("metal")); mb.beam([0, 0.95, 0], [0.45, 1.15, 0], 0.05, o("metal")); mb.beam([0, 0.7, 0], [0, 0.6, 0.3], 0.07, o("metal")); mb.box(0, 0, 0.35, 0.5, 0.25, 0.4, o("stone")); break;
    case "trough": mb.box(0, 0, 0, 1.1, 0.45, 0.5, o("stone"), "tnsew", o("water")); break;
    case "laundry": {
      // Line strung between facing walls across a lane: rendered as a catenary with cloth cards.
      const span = 4.5;
      for (let k = 0; k < 8; k++) {
        const t0 = k / 8, t1 = (k + 1) / 8;
        const sag = (t: number) => 3.6 - Math.sin(Math.PI * t) * 0.45;
        mb.beam([-span / 2 + span * t0, sag(t0), 0], [-span / 2 + span * t1, sag(t1), 0], 0.02, o("darkwood"));
        if (k % 2 === 1) mb.card(-span / 2 + span * (t0 + t1) / 2, sag((t0 + t1) / 2) - 0.55, 0, 0.45, 0.55, 0, o(k % 4 === 1 ? "cloth" : "cloth2", { wind: true }));
      }
      break;
    }
    case "awning": case "hangsign": case "doormat": case "sconce": break; // facade details are baked with the building
    case "puddle": mb.quad([-0.4, 0.015, 0.3], [0.4, 0.015, 0.3], [0.4, 0.015, -0.3], [-0.4, 0.015, -0.3], { layer: L("water"), noAO: true, tint: [0.7, 0.75, 0.85] }); break;
    case "leaves": mb.card(0, 0.01, 0, 0.8, 0.2, h(1) * 180, o("leafcard")); break;
    case "tuft": { const k = h(2) < 0.2 ? "flowers" : "grass"; mb.card(0, 0, 0, 0.7, 0.42, h(3) * 180, o(k, { wind: true })); mb.card(0, 0, 0, 0.7, 0.42, h(3) * 180 + 90, o(k, { wind: true })); break; }
    case "flowers": mb.card(0, 0, 0, 0.8, 0.5, h(4) * 180, o("flowers", { wind: true })); mb.card(0, 0, 0, 0.8, 0.5, h(4) * 180 + 90, o("flowers", { wind: true })); break;
    case "vine": mb.card(0, 0, 0.45, 1.0, 1.4, 0, o("leafcard", { wind: true })); break;
    case "reeds": mb.card(0, 0, 0, 0.8, 0.9, 0, o("grass", { wind: true })); break;
    // ----- interior -----
    case "bed": mb.box(0, 0, 0, 0.95, 0.35, 1.9, o("darkwood")); mb.bevelBox(0, 0.35, 0.05, 0.9, 0.18, 1.8, 0.06, o("cloth2")); mb.bevelBox(0, 0.35, 0.6, 0.92, 0.2, 0.7, 0.06, o("cloth")); mb.bevelBox(0, 0.5, -0.72, 0.7, 0.14, 0.3, 0.06, o("paper")); mb.box(0, 0, -0.92, 0.95, 0.9, 0.08, o("darkwood")); break;
    case "wardrobe": mb.bevelBox(0, 0, 0, 1.0, 2.0, 0.55, 0.04, o("darkwood")); mb.box(0, 0.1, 0.28, 0.02, 1.8, 0.01, o("wood")); break;
    case "shelf": mb.box(0, 0, 0, 1.0, 1.9, 0.45, o("darkwood"), "tnsew"); for (let s = 0; s < 4; s++) { mb.box(0, 0.08 + s * 0.46, 0.02, 0.92, 0.04, 0.42, o("wood")); if (h(5 + s) < 0.85) mb.box(-0.15 + (h(9 + s) - 0.5) * 0.3, 0.12 + s * 0.46, 0.05, 0.55, 0.3, 0.3, o(s % 2 ? "cloth2" : "book")); } break;
    case "bookcase": mb.box(0, 0, 0, 1.0, 2.1, 0.4, o("darkwood")); mb.box(0, 0.1, 0.205, 0.9, 1.9, 0.01, o("book")); break;
    case "desk": mb.bevelBox(0, 0.7, 0, 1.2, 0.07, 0.6, 0.02, o("wood")); for (const [sx, sz] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]] as const) mb.box(sx, 0, sz, 0.06, 0.7, 0.06, o("darkwood")); mb.box(0.3, 0.77, -0.1, 0.3, 0.05, 0.22, o("paper")); break;
    case "table": mb.cyl(0, 0.7, 0, 0.55, 0.55, 0.06, 12, o("wood")); mb.cyl(0, 0, 0, 0.08, 0.06, 0.7, 6, o("darkwood")); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; mb.box(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8, 0.35, 0.45, 0.35, o("darkwood")); } break;
    case "chair": mb.box(0, 0.42, 0, 0.42, 0.05, 0.42, o("wood")); mb.box(0, 0.47, -0.19, 0.42, 0.5, 0.05, o("wood")); for (const [sx, sz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const) mb.box(sx, 0, sz, 0.04, 0.42, 0.04, o("darkwood")); break;
    case "sofa": mb.bevelBox(0, 0, 0, 1.7, 0.45, 0.8, 0.08, o("cloth")); mb.bevelBox(0, 0.45, -0.3, 1.7, 0.45, 0.2, 0.06, o("cloth")); for (const sx of [-0.8, 0.8]) mb.bevelBox(sx, 0.35, 0, 0.18, 0.3, 0.8, 0.06, o("cloth")); break;
    case "counter": mb.bevelBox(0, 0, 0, 1.0, 1.0, 0.6, 0.03, o("wood"), o("darkwood")); break;
    case "piano": mb.bevelBox(0, 0, 0, 1.4, 1.2, 0.6, 0.04, o("darkwood")); mb.box(0, 0.72, 0.31, 1.2, 0.08, 0.1, o("paper")); break;
    case "plant": mb.cyl(0, 0, 0, 0.2, 0.25, 0.45, 8, o("roof")); bushCluster(ctx, 0, 0, 0.45, 0.45); break;
    case "lamp": mb.cyl(0, 0, 0, 0.18, 0.12, 0.05, 8, o("brass")); mb.cyl(0, 0.05, 0, 0.03, 0.03, 1.3, 5, o("brass"), false); mb.cyl(0, 1.3, 0, 0.3, 0.16, 0.3, 8, o("window", { emissive: 1 })); light(0, 1.45, 0, 4.5, 1.0); break;
    case "chandelier": case "pendant": {
      const ch = kind === "chandelier";
      const top = 3.0;
      mb.beam([0, top + 0.6, 0], [0, top, 0], 0.03, o("brass"));
      if (ch) { mb.cyl(0, top - 0.1, 0, 0.7, 0.7, 0.08, 10, o("brass")); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; mb.cyl(Math.cos(a) * 0.62, top - 0.02, Math.sin(a) * 0.62, 0.05, 0.03, 0.18, 4, o("window", { emissive: 1 })); } }
      else mb.cyl(0, top - 0.25, 0, 0.3, 0.1, 0.25, 8, o("window", { emissive: 1 }));
      light(0, top - 0.2, 0, ch ? 8 : 5.5, ch ? 1.4 : 1.0);
      break;
    }
    case "rug": { const s = Math.max(1, scale); mb.pop(); mb.push(rot, x, y, z, 1); mb.quad([-s, 0.02, s * 0.7], [s, 0.02, s * 0.7], [s, 0.02, -s * 0.7], [-s, 0.02, -s * 0.7], o("rug", { uvScale: 0.35 })); break; }
    case "column": case "pillar": mb.bevelBox(0, 0, 0, 0.6, 0.25, 0.6, 0.04, o("stone")); mb.cyl(0, 0.25, 0, 0.22, 0.2, 2.6, 10, o("stone"), false); mb.bevelBox(0, 2.85, 0, 0.62, 0.22, 0.62, 0.04, o("stone")); break;
    case "machine": mb.bevelBox(0, 0, 0, 0.9, 1.3, 0.9, 0.05, o("metal")); mb.cyl(0.2, 1.3, 0, 0.18, 0.18, 0.5, 8, o("brass")); mb.box(0, 0.6, 0.46, 0.3, 0.2, 0.02, o("window", { emissive: 1 })); mb.beam([-0.3, 1.3, 0.2], [-0.3, 2.6, 0.2], 0.12, o("metal")); break;
    case "boiler": mb.cyl(0, 0, 0, 0.45, 0.45, 1.5, 10, o("brass")); mb.cyl(0, 1.5, 0, 0.45, 0.1, 0.3, 10, o("brass")); mb.beam([0, 1.8, 0], [0, 3.2, 0], 0.14, o("metal")); mb.box(0, 0.3, 0.44, 0.3, 0.3, 0.04, o("window", { emissive: 1 })); light(0, 0.45, 0.6, 4, 0.9, [255, 150, 80], "fire"); break;
    case "tank": mb.cyl(0, 0, 0, 0.42, 0.42, 0.2, 10, o("metal")); mb.cyl(0, 0.2, 0, 0.38, 0.38, 1.4, 10, o("glass", { emissive: 0.4 }), false); mb.cyl(0, 1.6, 0, 0.42, 0.42, 0.2, 10, o("metal")); light(0, 1.0, 0, 3.5, 0.7, [140, 220, 200], "neon"); break;
    case "locker": mb.bevelBox(0, 0, 0, 0.9, 1.9, 0.5, 0.03, o("metal")); for (let k = 0; k < 3; k++) mb.box(-0.3 + k * 0.3, 1.5, 0.26, 0.2, 0.05, 0.01, o("darkwood")); break;
    case "fridge": mb.bevelBox(0, 0, 0, 0.9, 1.95, 0.7, 0.04, o("metal")); mb.box(0, 0.3, 0.36, 0.75, 1.5, 0.02, o("glass", { emissive: 0.5 })); light(0, 1.0, 0.5, 3, 0.6, [200, 235, 255], "neon"); break;
    case "cabinet": mb.bevelBox(0, 0, 0, 1.0, 1.0, 0.5, 0.03, o("wood")); mb.box(0, 0.5, 0.26, 0.9, 0.02, 0.01, o("darkwood")); break;
    case "console": mb.bevelBox(0, 0, 0, 1.1, 0.9, 0.6, 0.04, o("metal")); mb.quad([-0.5, 0.9, 0.3], [0.5, 0.9, 0.3], [0.5, 1.1, -0.1], [-0.5, 1.1, -0.1], o("window", { emissive: 1 })); light(0, 1.2, 0.3, 3, 0.6, [150, 220, 255], "neon"); break;
    case "seats": for (let k = 0; k < 2; k++) { mb.box(-0.25 + k * 0.5, 0, 0, 0.44, 0.42, 0.4, o("cloth")); mb.box(-0.25 + k * 0.5, 0.42, -0.18, 0.44, 0.45, 0.08, o("cloth")); } break;
    case "lounger": mb.box(0, 0.3, 0, 0.6, 0.08, 1.6, o("cloth2")); mb.quad([-0.3, 0.38, -0.8], [0.3, 0.38, -0.8], [0.3, 0.8, -0.5], [-0.3, 0.8, -0.5], o("cloth2", { doubleSided: true })); for (const sz of [-0.7, 0.7]) mb.box(0, 0, sz, 0.6, 0.3, 0.05, o("metal")); break;
    case "altar": mb.bevelBox(0, 0, 0, 1.4, 0.9, 0.7, 0.04, o("stone")); mb.box(0, 0.9, 0, 1.2, 0.04, 0.5, o("cloth")); for (let k = 0; k < 3; k++) { mb.cyl(-0.4 + k * 0.4, 0.94, 0, 0.04, 0.04, 0.22, 5, o("paper")); mb.box(-0.4 + k * 0.4, 1.16, 0, 0.04, 0.06, 0.04, o("window", { emissive: 1 })); } light(0, 1.3, 0, 3.5, 0.8, [255, 170, 100], "fire"); break;
    case "candles": for (let k = 0; k < 4; k++) { const a = h(k) * 6.28; mb.cyl(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, 0.04, 0.04, 0.2 + h(k + 4) * 0.25, 5, o("paper")); } light(0, 0.5, 0, 2.5, 0.6, [255, 170, 100], "fire"); break;
    case "fluoro": mb.box(0, 2.75, 0, 0.9, 0.05, 0.22, o("window", { emissive: 1, tint: [1.1, 1.1, 1.0] })); light(0, 2.6, 0, 6, 0.8, [250, 250, 225], "fluoro"); break;
    // ----- anomaly intrusions -----
    case "busstop": mb.box(-0.9, 0, 0, 0.08, 2.3, 0.08, o("metal")); mb.box(0.9, 0, 0, 0.08, 2.3, 0.08, o("metal")); mb.box(0, 2.3, 0, 2.0, 0.08, 1.0, o("metal")); mb.box(0, 0.45, -0.3, 1.6, 0.06, 0.35, o("wood")); mb.box(0, 0.9, -0.48, 1.8, 1.3, 0.04, o("glass")); mb.box(1.25, 0, 0, 0.06, 2.6, 0.06, o("metal")); mb.cyl(1.25, 2.3, 0, 0.3, 0.3, 0.06, 12, o("cloth")); break;
    case "phonebooth": mb.bevelBox(0, 0, 0, 0.9, 2.3, 0.9, 0.05, o("cloth")); mb.box(0, 0.6, 0.46, 0.7, 1.4, 0.02, o("window", { emissive: 1 })); light(0, 2.0, 0.4, 3, 0.7, [255, 245, 220], "neon"); break;
    case "bathtub": mb.bevelBox(0, 0.1, 0, 0.8, 0.5, 1.6, 0.18, o("tile"), o("water")); for (const [sx, sz] of [[-0.3, -0.7], [0.3, -0.7], [-0.3, 0.7], [0.3, 0.7]] as const) mb.cyl(sx, 0, sz, 0.05, 0.05, 0.12, 5, o("brass")); break;
    case "car": mb.bevelBox(0, 0.25, 0, 1.7, 0.6, 3.6, 0.12, o("cloth")); mb.bevelBox(0, 0.85, -0.2, 1.5, 0.5, 1.9, 0.18, o("glass")); for (const [sx, sz] of [[-0.8, -1.1], [0.8, -1.1], [-0.8, 1.1], [0.8, 1.1]] as const) { mb.push(90, sx, 0.32, sz); mb.cyl(0, -0.12, 0, 0.32, 0.32, 0.24, 10, o("darkwood")); mb.pop(); } break;
    case "swing": for (const sx of [-0.8, 0.8]) { mb.beam([sx, 0, -0.5], [sx, 2.2, 0], 0.07, o("metal")); mb.beam([sx, 0, 0.5], [sx, 2.2, 0], 0.07, o("metal")); } mb.beam([-0.8, 2.2, 0], [0.8, 2.2, 0], 0.08, o("metal")); mb.beam([-0.2, 2.2, 0], [-0.2, 0.5, 0], 0.02, o("metal")); mb.beam([0.2, 2.2, 0], [0.2, 0.5, 0], 0.02, o("metal")); mb.box(0, 0.45, 0, 0.5, 0.05, 0.3, o("wood")); break;
    case "lonedoor": mb.box(0, 0, 0, 1.2, 2.4, 0.2, o("stone")); mb.box(0, 0, 0.02, 0.9, 2.1, 0.2, o("darkwood")); mb.box(0.3, 1.0, 0.13, 0.08, 0.08, 0.06, o("brass")); if (variant === 1) for (let k = 0; k < 4; k++) mb.box(0, k * 0.3, 0.5 + k * 0.3, 1.0, 0.3, 0.3, o("stone")); break;
    case "tv": mb.bevelBox(0, 0, 0, 0.8, 0.55, 0.6, 0.06, o("darkwood")); mb.box(0, 0.08, 0.31, 0.6, 0.4, 0.02, o("window", { emissive: 1, tint: [0.7, 0.9, 1.1] })); light(0, 0.4, 0.5, 3, 0.7, [180, 210, 255], "neon"); break;
    case "grandclock": case "clockface": mb.bevelBox(0, 0, 0, 0.6, 2.1, 0.4, 0.04, o("darkwood")); mb.cyl(0, 1.65, 0.21, 0.24, 0.24, 0.02, 12, o("paper")); mb.box(0, 0.4, 0.21, 0.3, 0.8, 0.01, o("brass")); break;
    case "doorway": case "hatch": case "elevator": break;
    default: mb.bevelBox(0, 0, 0, 0.7, 0.7, 0.7, 0.04, o("wood")); break;
  }
  mb.pop();
}

export function treeModel(ctx: Ctx, flavor: string, i: number) {
  const mb = ctx.mb, L = (id: string) => ctx.layer(id);
  const h = (k: number) => hash3(i * 97 + k * 13);
  const bark = { layer: L("bark") }, leaves = { layer: L("leaves"), wind: true };
  if (flavor === "pine" || flavor === "snowpine") {
    mb.cyl(0, 0, 0, 0.16, 0.1, 1.2, 6, bark, false);
    const tiers = 4, H = 3.6 + h(1) * 1.2;
    for (let t = 0; t < tiers; t++) {
      const y0 = 0.7 + (t * (H - 0.9)) / tiers, r = 1.25 * (1 - t / (tiers + 0.5));
      mb.cyl(0, y0, 0, r, 0.05, (H - 0.6) / tiers + 0.5, 8, leaves, false);
      if (flavor === "snowpine") mb.cyl(0, y0 + ((H - 0.6) / tiers) * 0.55, 0, r * 0.5, 0.05, 0.3, 8, { layer: L("paper"), tint: [1.05, 1.08, 1.12] }, false);
    }
    return;
  }
  if (flavor === "bamboo") {
    for (let k = 0; k < 5; k++) {
      const ox = (h(k) - 0.5) * 0.7, oz = (h(k + 7) - 0.5) * 0.7, hh = 3.5 + h(k + 3) * 2;
      mb.cyl(ox, 0, oz, 0.07, 0.06, hh, 5, { layer: L("leaves"), tint: [1.1, 1.15, 0.8] }, false);
      mb.card(ox, hh - 1.4, oz, 1.2, 1.6, h(k + 9) * 180, { layer: L("foliage"), wind: true });
    }
    return;
  }
  if (flavor === "dead") {
    mb.cyl(0, 0, 0, 0.18, 0.1, 2.4, 6, bark, false);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + h(k); mb.beam([0, 1.4 + k * 0.25, 0], [Math.cos(a) * 1.0, 2.3 + k * 0.2, Math.sin(a) * 1.0], 0.07, bark); }
    return;
  }
  if (flavor === "cactus") {
    const skin = { layer: L("bark"), tint: [0.62, 1.12, 0.6] as [number, number, number] };
    mb.cyl(0, 0, 0, 0.22, 0.2, 2.0, 8, skin, true);
    mb.beam([0, 0.9, 0], [0.5, 1.0, 0], 0.18, skin); mb.cyl(0.5, 0.95, 0, 0.12, 0.1, 0.8, 6, skin);
    return;
  }
  if (flavor === "crystal") {
    for (let k = 0; k < 4; k++) mb.cyl((h(k) - 0.5) * 0.6, 0, (h(k + 4) - 0.5) * 0.6, 0.22, 0.02, 1.2 + h(k + 8) * 1.6, 5, { layer: L("glass"), emissive: 0.5 }, false);
    return;
  }
  if (flavor === "palm") {
    const H = 3.6 + h(1);
    for (let k = 0; k < 6; k++) mb.beam([0.12 * k * 0.1, (H * k) / 6, 0], [0.14 * (k + 1) * 0.1, (H * (k + 1)) / 6, 0], 0.2 - k * 0.015, bark);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; mb.quad([0.1, H, 0], [0.1, H, 0], [Math.cos(a + 0.3) * 1.6, H - 0.7, Math.sin(a + 0.3) * 1.6], [Math.cos(a - 0.3) * 1.6, H - 0.7, Math.sin(a - 0.3) * 1.6], { ...leaves, doubleSided: true }); }
    return;
  }
  if (flavor === "pencil") {
    mb.cyl(0, 0, 0, 0.35, 0.35, 3.2, 6, { layer: L("bark") }, false);
    mb.cyl(0, 3.2, 0, 0.35, 0.02, 1.0, 6, { layer: L("wood"), tint: [1.3, 1.2, 1.0] }, false);
    return;
  }
  if (flavor === "coral" || flavor === "fleshy") {
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; mb.beam([0, 0, 0], [Math.cos(a) * 0.8, 1.2 + h(k) * 1.5, Math.sin(a) * 0.8], 0.16, { layer: L("cloth") }); mb.blob(Math.cos(a) * 0.8, 1.3 + h(k) * 1.5, Math.sin(a) * 0.8, 0.25, 0.25, 0.25, { layer: L("cloth"), emissive: flavor === "fleshy" ? 0.3 : 0 }, 1, 0.3, i + k); }
    return;
  }
  // Broadleaf / willow / birch / maple / paper: branched trunk + dense round crown made of many small,
  // lumpy leaf clumps (reads like painted foliage rather than a few big polyhedra) + a soft fringe card.
  const H = 2.4 + h(2) * 1.3;
  const trunkTint: [number, number, number] = flavor === "birch" ? [1.1, 1.1, 1.1] : [1, 1, 1];
  mb.cyl(0, 0, 0, 0.19, 0.12, H * 0.66, 7, { ...bark, tint: trunkTint }, false);
  const leafLayer = flavor === "maple" ? { layer: L("cloth"), wind: true } : { ...leaves, uvScale: 0.85 };
  const crownR = 1.05 + h(3) * 0.35, cy = H * 0.66 + crownR * 0.72;
  // branches toward the crown
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + h(k + 50); mb.beam([0, H * 0.45, 0], [Math.cos(a) * crownR * 0.5, cy - 0.2, Math.sin(a) * crownR * 0.5], 0.06, bark); }
  const clumps = ctx.quality === "desktop" ? 11 : 6;
  for (let k = 0; k < clumps; k++) {
    // Fibonacci-ish distribution over an upper hemisphere, flattened at the bottom.
    const t = (k + 0.5) / clumps, phi = k * 2.39996 + h(k + 10), el = Math.asin(1 - t * 1.25);
    const rr = crownR * (0.55 + h(k + 20) * 0.3);
    const cx = Math.cos(phi) * Math.cos(el) * rr, cz = Math.sin(phi) * Math.cos(el) * rr, yy = cy + Math.sin(el) * rr * 0.75;
    const s = crownR * (0.42 + h(k + 40) * 0.2);
    mb.blob(cx, yy, cz, s, s * 0.82, s, leafLayer, 1, 0.55, i * 11 + k, true);
  }
  mb.blob(0, cy, 0, crownR * 0.8, crownR * 0.7, crownR * 0.8, leafLayer, 1, 0.3, i * 7, true);
  // Leafy fringe: alpha leaf cards standing out of the crown surface break the silhouette into sprigs.
  if (flavor !== "paper") {
    const cards = ctx.quality === "desktop" ? 9 : 4, card = { layer: L("leafcard"), wind: true, tint: flavor === "maple" ? [1.25, 0.7, 0.45] as [number, number, number] : undefined };
    for (let k = 0; k < cards; k++) {
      const phi = (k / cards) * Math.PI * 2 + h(k + 60) * 0.7, el = (h(k + 70) - 0.35) * 0.9;
      const rr = crownR * 0.92, px = Math.cos(phi) * Math.cos(el) * rr, pz = Math.sin(phi) * Math.cos(el) * rr;
      const w = 0.8 + h(k + 80) * 0.5, hh = 0.7 + h(k + 90) * 0.45;
      mb.card(px, cy + Math.sin(el) * rr * 0.8 - hh * 0.5, pz, w, hh, 90 - (phi * 180) / Math.PI, card);
    }
  }
  if (flavor === "willow") for (let k = 0; k < 4; k++) { const a = k * 1.57; mb.card(Math.cos(a) * crownR * 0.6, cy - 1.9, Math.sin(a) * crownR * 0.6, 1.1, 1.9, a * 57, { layer: L("foliage"), wind: true }); }
}
