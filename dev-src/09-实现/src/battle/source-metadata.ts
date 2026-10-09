import type {ActionSpec,SourceFilterSpec,SourceKindSpec,QualitySpec} from '../compiler/contract';
export type SourceMetadata={kind:SourceKindSpec;quality?:QualitySpec;tags?:string[];priority?:number};
const QUALITY:QualitySpec[]=['common','uncommon','rare','epic','legendary','mythic','unique'];
/** Unknown quality does not magically qualify as a low-quality source. */
export function matchesSource(meta:SourceMetadata|undefined,filter:SourceFilterSpec|undefined,area=false):boolean {
 if(!filter)return true;if(!meta)return false;
 return (!filter.qualities||!!meta.quality&&filter.qualities.includes(meta.quality))&&
  (!filter.excludeQualities||!!meta.quality&&!filter.excludeQualities.includes(meta.quality))&&
  (!filter.kinds||filter.kinds.includes(meta.kind))&&
  (!filter.tags||filter.tags.every(t=>meta.tags?.includes(t)))&&
  (!filter.excludeTags||filter.excludeTags.every(t=>!meta.tags?.includes(t)))&&
  (!filter.maxQuality||!!meta.quality&&QUALITY.indexOf(meta.quality)<=QUALITY.indexOf(filter.maxQuality))&&
  (!filter.delivery||filter.delivery==='any'||(filter.delivery==='area')===area);
}
export function actionMetadata(a:ActionSpec|undefined,fallback?:SourceMetadata):SourceMetadata|undefined {
 const m=a?.source??fallback;return m?{...m,tags:[...new Set([...(m.tags??[]),...(a?.tags??[])])]}:undefined;
}
