/** SillyTavern keeps displayed metadata in message.extra and in the selected swipe's
 * swipe_info[swipe_id].extra. Tavern Helper may return that swipe-info envelope. */
type Extra=Record<string,unknown>;
const record=(value:unknown):Extra=>value&&typeof value==='object'&&!Array.isArray(value)?value as Extra:{};
export function unwrapMessageExtra(value:unknown):Extra{
 const outer=record(value);
 return {...outer,...record(outer.extra)};
}
export function readMessageExtra(helperExtra:unknown,native?:{extra?:unknown}):Extra{
 return {...unwrapMessageExtra(helperExtra),...record(native?.extra)};
}
/** Update only our metadata; preserve host timestamps/reasoning and all other swipes.
 * The caller performs its message/context/swipe guard in this same synchronous turn. */
export function writeNativeMessageExtra(message:{extra?:Extra;swipe_id?:number;swipe_info?:Extra[]},patch:Extra):void{
 const next={...record(message.extra),...patch},index=message.swipe_id??0;
 message.extra=next;
 message.swipe_info??=[];
 message.swipe_info[index]={...record(message.swipe_info[index]),extra:structuredClone(next)};
}
