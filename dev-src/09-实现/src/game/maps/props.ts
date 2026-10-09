// Prop vocabulary shared by generation (blocking / light semantics) and the render kernel (shape).
export type PropInfo = { block: boolean; light?: "warm" | "cool" | "fire" | "neon" | "fluoro"; tall?: boolean };
const B = (light?: PropInfo["light"], tall = false): PropInfo => ({ block: true, light, tall });
const N = (light?: PropInfo["light"]): PropInfo => ({ block: false, light });

export const PROP_INFO: Record<string, PropInfo> = {
  // vegetation
  "tree": B(undefined, true), bush: B(), rock: B(), stump: B(), tuft: N(), flowers: N(), leaves: N(), vine: N(), reeds: N(),
  // street furniture / life
  barrel: B(), crates: B(), sacks: B(), pot: B(), bench: B(), cart: B(), stall: B(undefined, true), well: B(), fountain: B(undefined, true),
  noticeboard: B(), signpost: B(), streetlamp: B("warm", true), lantern: B("warm"), brazier: B("fire"), woodpile: B(), haybale: B(),
  fence: B(), cone: B(), bollard: B(), mailboxes: B(), vending: B("cool"), laundry: N(), awning: N(), hangsign: N(),
  broom: N(), doormat: N(), puddle: N(), bucket: N(), planterbox: B(), statue: B(undefined, true), pump: B(), trough: B(),
  // interior furniture
  bed: B(), wardrobe: B(undefined, true), shelf: B(undefined, true), bookcase: B(undefined, true), desk: B(), chair: N(), table: B(),
  sofa: B(), counter: B(), piano: B(), plant: B(), lamp: B("warm"), chandelier: N("warm"), pendant: N("warm"), sconce: N("warm"), rug: N(),
  column: B(undefined, true), machine: B(undefined, true), tank: B("cool", true), locker: B(undefined, true), fridge: B("cool", true),
  cabinet: B(), console: B("cool"), boiler: B("fire", true), pipes: N(), crate: B(), seats: B(), stagelight: N("warm"),
  fluoro: N("fluoro"), lounger: B(), altar: B("fire"), candles: N("fire"), pillar: B(undefined, true), railing: N(),
  // down exit / markers
  doorway: N(), hatch: N(), elevator: N("cool"),
  // anomaly intrusions
  busstop: B(undefined, true), phonebooth: B("cool", true), bathtub: B(), car: B(), swing: B(undefined, true), lonedoor: B(undefined, true),
  tv: B("cool"), clockface: B(undefined, true), grandclock: B(undefined, true),
};

/** Theme-specific kinds from the design table resolve to a base shape + blocking semantics. */
export const THEME_PROP_BASE: Record<string, string> = {
  fence: "fence", pump: "pump", crates: "crates", barrel: "barrel", cone: "cone", rubble: "rock",
  altar: "altar", basin: "trough", bell: "statue", lantern: "lantern", incense: "altar",
  totem: "statue", loom: "cabinet", well: "well", brazier: "brazier", hide: "stall",
  cart: "cart", rack: "shelf", banner: "signpost",
  console: "console", pipes: "boiler", antenna: "statue", locker: "locker",
  mailboxes: "mailboxes", signpost: "signpost", paperdoll: "statue",
  kiln: "boiler", telescope: "statue", globe: "statue", books: "bookcase",
  vending: "vending", bench: "bench", bollard: "bollard", luggage: "crates", clock: "grandclock", chair: "chair",
  plant: "plant", lamp: "lamp", gearpress: "machine", sarcophagus: "altar", woodpile: "woodpile", candles: "candles",
  vat: "tank", pod: "tank", shell: "rock", boat: "cart", crystal: "rock", lectern: "desk", scroll: "cabinet",
  obelisk: "statue", counter: "counter", turnstile: "bollard", container: "crates", hook: "statue", sled: "cart",
  laundry: "laundry", swing: "swing", eraser: "crates", desk: "desk", files: "cabinet", ticket: "counter",
  seats: "seats", poster: "noticeboard", organ: "piano", orrery: "statue", table: "table", honeypot: "pot",
  fridge: "fridge", saltpile: "rock", bottle: "pot", balloon: "stall", haybale: "haybale", scarecrow: "statue",
  stall: "stall", sacks: "sacks", teatable: "table", bamboo: "bush", cube: "crates", stage: "counter",
  flowers: "flowers", buoy: "barrel", scrap: "crates", curtain: "wardrobe", tank: "tank", gravestone: "statue",
};

export const baseKind = (kind: string) => {
  const head = kind.split(":")[0]!;
  return PROP_INFO[head] ? head : THEME_PROP_BASE[head] ?? head;
};
export const propInfo = (kind: string): PropInfo => PROP_INFO[baseKind(kind)] ?? { block: true };
export const isLightProp = (kind: string) => !!propInfo(kind).light;
