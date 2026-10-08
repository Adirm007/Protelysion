import type {Region} from './region';

/** The saved/inspected state stays complete. Only the presentation wire is delta
 * encoded: a floor's immutable layout/tiles cross the JS/Godot bridge once.
 * A reattached renderer receives the full floor again. No old-map fallback.
 */
export class RendererFrameCodec {
  private sentRegion: string | null = null;
  private readyRegion: string | null = null;
  reset(){this.sentRegion=null;this.readyRegion=null;}
  encode(frame:{mode:string;region?:Region}):string{
    if(!frame.region)return JSON.stringify(frame);
    const region=frame.region;
    if(region.id!==this.sentRegion){
      this.sentRegion=region.id;this.readyRegion=null;
      return JSON.stringify(frame);
    }
    const {layout:_layout,tiles:_tiles,...dynamic}=region;
    return JSON.stringify({...frame,region:dynamic});
  }
  acknowledge(regionId:string){if(regionId===this.sentRegion)this.readyRegion=regionId;}
  readyFor(regionId:string){return this.sentRegion===regionId&&this.readyRegion===regionId;}
}
