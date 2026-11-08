import type {Region, Thing} from './region';

/** The saved/inspected state stays complete. Only the presentation wire is delta
 * encoded: a floor's immutable layout/tiles cross the JS/Godot bridge once.
 * A reattached renderer receives the full floor again. No old-map fallback.
 *
 * The wire carries only what godot/game.gd reads: mode, paused, position,
 * graphics quality / animation speed, party status and colour, the floor
 * (id, theme, things, first-frame layout) and battle art ids. Ability text,
 * battle logs, menus and enemy AI state are for the HTML overlay only, so they
 * are no longer serialized and re-parsed in WASM every 50 ms. Keep this list in
 * step with game.gd when it starts reading a new field.
 */
type WireThing = Pick<Thing, 'id' | 'kind' | 'x' | 'z' | 'used' | 'foes'>;
const wireThing = (t: Thing): WireThing => ({id: t.id, kind: t.kind, x: t.x, z: t.z, used: t.used, foes: t.foes});
export type RendererFrameInput = {
  mode: string; region?: Region; paused?: boolean; x?: number; z?: number;
  settings?: {graphicsQuality?: string; animationSpeed?: number};
  party?: {status?: string; color?: string}[];
  battle?: {units?: {artId?: string}[]};
};

export class RendererFrameCodec {
  private sentRegion: string | null = null;
  private readyRegion: string | null = null;
  reset(){this.sentRegion=null;this.readyRegion=null;}
  encode(frame:RendererFrameInput):string{
    if(!frame.region)return JSON.stringify(frame);
    const region=frame.region,full=region.id!==this.sentRegion;
    if(full){this.sentRegion=region.id;this.readyRegion=null;}
    return JSON.stringify({
      mode:frame.mode,paused:!!frame.paused,x:frame.x,z:frame.z,
      settings:{graphicsQuality:frame.settings?.graphicsQuality,animationSpeed:frame.settings?.animationSpeed},
      party:(frame.party??[]).map(p=>({status:p.status,color:p.color})),
      battle:{units:frame.mode==='battle'?(frame.battle?.units??[]).map(u=>({artId:u.artId??''})):[]},
      region:{id:region.id,theme:region.theme,things:region.things.map(wireThing),...(full?{layout:region.layout,tiles:region.tiles}:{})},
    });
  }
  acknowledge(regionId:string){if(regionId===this.sentRegion)this.readyRegion=regionId;}
  readyFor(regionId:string){return this.sentRegion===regionId&&this.readyRegion===regionId;}
}
