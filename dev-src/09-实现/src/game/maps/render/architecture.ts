// Building geometry entry point (hd2d-architecture-3). Each Building is resolved into a Plan (theme kit
// → architectural language, kind preset, massing, AO volumes) and dispatched either to the generic
// house grammar (townhouses, cottages, shops, inns, halls, workshops, towers in any of 13 languages) or
// to a signature-form builder (water tower, windmill, pagoda, circus tent, pencil tower, lighthouse …).
import type { Building } from "../types";
import type { Ctx } from "./ground";
import { planBuilding, buildingVolumes, buildingTop } from "./arch/plan";
import { buildHouse, houseMats } from "./arch/house";
import * as S1 from "./arch/special";
import * as S2 from "./arch/special2";
import * as S3 from "./arch/special3";
import type { SB } from "./arch/special";

export { buildingVolumes };
export const ARCH_VERSION = "hd2d-architecture-3" as const;

/** Upper bound of the building's height above its base (camera bounds / field sizing). */
export function buildingHeight(b: Building) { return buildingTop(b); }

const SPECIAL: Record<string, SB> = {
  watertower: S1.watertower, windmill: S1.windmill, silo: S1.silo, barn: S1.barn, container: S1.container, gasstation: S1.gasstation,
  pagoda: S1.pagoda, pavilion: S1.pavilion, stage: S1.stage, roundhut: S1.roundhut, hidetent: S1.hidetent, stilthut: S1.stilthut,
  watchtower: S1.watchtower, clocktower: S1.clocktower, observatory: S1.observatory, minehead: S1.minehead, stationhall: S1.stationhall,
  stavechurch: S1.stavechurch, gantry: S1.gantry,
  domehouse: S2.domehouse, shellhouse: S2.shellhouse, wreckhouse: S2.wreckhouse, colonnade: S2.colonnade, bookhouse: S2.bookhouse,
  origami: S2.origami, bookstack: S2.bookstack, obelisk: S2.obelisk, shardhouse: S2.shardhouse, ringtemple: S2.ringtemple, booth: S2.booth,
  controltower: S2.controltower, aframe: S2.aframe, inverted: S2.inverted, penciltower: S2.penciltower, shavingpavilion: S2.shavingpavilion,
  eraserhut: S2.eraserhut, saltblock: S2.saltblock, driftshack: S2.driftshack, umbrellahouse: S2.umbrellahouse, corkhouse: S2.corkhouse,
  bottledome: S2.bottledome, lighthouse: S2.lighthouse, shrine: S2.shrine, circustent: S2.circustent, prismchapel: S2.prismchapel,
  crttower: S2.crttower, scrapstilt: S2.scrapstilt, hexhive: S2.hexhive, ribhouse: S2.ribhouse, podtower: S2.podtower,
  subwaycar: S2.subwaycar, flytower: S2.flytower, tesseract: S2.tesseract, rotunda: S2.rotunda,
  theater: S3.theater, puppetbooth: S3.puppetbooth, scenerystore: S3.scenerystore, carousel: S3.carousel,
};

export function buildBuilding(ctx: Ctx, b: Building) {
  const mb = ctx.mb;
  const p = planBuilding(b);
  const yaw = { s: 0, e: 90, n: 180, w: 270 }[b.facing];
  const cx = b.x + (b.w - 1) / 2, cz = b.z + (b.d - 1) / 2;
  mb.push(yaw + b.yaw, cx, b.baseY + b.lift, cz);
  mb.group = `b:${b.id}`;
  const fn = p.special ? SPECIAL[p.kind] : undefined;
  if (fn) fn(ctx, p, houseMats(ctx, p));
  else if (p.kind === "watermill") { buildHouse(ctx, p); S1.watermillWheel(ctx, p, houseMats(ctx, p), p.W / 2 + 0.05 - 0.35, 0, Math.min(1.6, p.D / 2 - 0.2)); }
  else buildHouse(ctx, p);
  mb.group = null;
  mb.pop();
}
