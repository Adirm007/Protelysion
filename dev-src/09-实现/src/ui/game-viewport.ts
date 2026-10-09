/** Fullscreen the actual stage. The CSS fallback also fills its same-origin host iframe(s),
 * without moving/reloading an iframe or touching host messages. Every style is restored. */
export function mountGameViewport(stage: HTMLElement, win: Window = window) {
  const doc=stage.ownerDocument,canvas=stage.querySelector('canvas');stage.classList.add('rpg-stage');
  let disposed=false,soft=false,queued=0,busy=false;
  type StyleUndo={before:string;priority:string;ours:string};
  const saved=new Map<HTMLElement,Map<string,StyleUndo>>(),listeners:(()=>void)[]=[];
  const chain: {frame:HTMLElement;parent:Window}[]=[];
  let outer=win;
  for(let depth=0;depth<8;depth++){
    try {if(outer.parent===outer)break;const frame=outer.frameElement as HTMLElement|null,parent=outer.parent;if(!frame||!parent.document)break;chain.push({frame,parent});outer=parent;}
    catch {break;}
  }
  function remember(node:HTMLElement,property:string,value:string){
    let fields=saved.get(node);if(!fields){fields=new Map();saved.set(node,fields);}
    let item=fields.get(property);if(!item){item={before:node.style.getPropertyValue(property),priority:node.style.getPropertyPriority(property),ours:value};fields.set(property,item);}item.ours=value;
    if(node.style.getPropertyValue(property)!==value||node.style.getPropertyPriority(property)!=='important')node.style.setProperty(property,value,'important');
    item.ours=node.style.getPropertyValue(property);
  }
  function restore(){
    for(const [node,fields]of saved)for(const [key,v]of fields){if(node.style.getPropertyValue(key)===v.ours){if(v.before)node.style.setProperty(key,v.before,v.priority);else node.style.removeProperty(key);}}
    saved.clear();soft=false;stage.classList.remove('is-fullscreen');
  }
  const nativeElement=()=>doc.fullscreenElement??(doc as Document&{webkitFullscreenElement?:Element}).webkitFullscreenElement;
  const visible=(w:Window)=>({width:w.visualViewport?.width||w.innerWidth,height:w.visualViewport?.height||w.innerHeight,left:w.visualViewport?.offsetLeft||0,top:w.visualViewport?.offsetTop||0});
  function fitHostFrames(){
    if(!soft)return;
    // Each frame fills its parent viewport; outermost first, then inner frame coordinates.
    for(const {frame,parent}of [...chain].reverse()){
      const v=visible(parent);
      for(const [key,value]of Object.entries({position:'fixed',left:v.left+'px',top:v.top+'px',right:'auto',bottom:'auto',width:v.width+'px',height:v.height+'px','max-width':'none','max-height':'none','min-width':'0','min-height':'0',margin:'0',padding:'0',border:'0','border-radius':'0','box-sizing':'border-box','z-index':'2147483000',transform:'none'}))remember(frame,key,value);
      for(let parentNode=frame.parentElement;parentNode;parentNode=parentNode.parentElement){
        const computed=parent.getComputedStyle(parentNode);
        for(const key of ['transform','perspective','filter','backdrop-filter','contain'])if(computed.getPropertyValue(key)&&!['none','normal'].includes(computed.getPropertyValue(key)))remember(parentNode,key,'none');
        if(computed.getPropertyValue('content-visibility')==='auto')remember(parentNode,'content-visibility','visible');
        remember(parentNode,'overflow','visible');remember(parentNode,'isolation','auto');remember(parentNode,'z-index','2147482999');
      }
      remember(parent.document.documentElement,'overflow','hidden');if(parent.document.body)remember(parent.document.body,'overflow','hidden');
    }
    remember(doc.documentElement,'overflow','hidden');if(doc.body)remember(doc.body,'overflow','hidden');
  }
  const resize=()=>{
    if(disposed)return;fitHostFrames();
    const local=visible(win),height=nativeElement()===stage||soft?local.height:Math.min(local.height,visible(outer).height);
    stage.style.setProperty('--rpg-viewport-height',Math.max(1,Math.round(height))+'px');stage.style.setProperty('--rpg-viewport-width',Math.max(1,Math.round(local.width))+'px');
    if(!canvas)return;
    const {width,height:h}=stage.getBoundingClientRect();if(width<2||h<2)return;
    const ratio=Math.min(Math.max(win.devicePixelRatio||1,1),2),w=Math.round(width*ratio),pixels=Math.round(h*ratio);
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==pixels)canvas.height=pixels;
    stage.dataset.pixelRatio=String(ratio);stage.dataset.fullscreenMode=nativeElement()===stage?'native':soft?'host-css':'inline';
  };
  const schedule=()=>{if(disposed||queued)return;queued=win.requestAnimationFrame(()=>{queued=0;resize();});};
  const observe=(target:EventTarget,name:string)=>{target.addEventListener(name,schedule);listeners.push(()=>target.removeEventListener(name,schedule));};
  for(const w of new Set([win,...chain.map(c=>c.parent)])){observe(w,'resize');observe(w,'orientationchange');if(w.visualViewport){observe(w.visualViewport,'resize');observe(w.visualViewport,'scroll');}}
  observe(doc,'fullscreenchange');observe(doc,'webkitfullscreenchange');
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):undefined;observer?.observe(stage);
  const pixelsObserver=canvas&&typeof MutationObserver==='function'?new MutationObserver(schedule):undefined;
  if(canvas)pixelsObserver?.observe(canvas,{attributes:true,attributeFilter:['width','height']});
  async function toggleFullscreen(){
    if(disposed||busy)return;busy=true;
    try{
      if(nativeElement()===stage){const exit=doc.exitFullscreen??(doc as Document&{webkitExitFullscreen?:()=>Promise<void>}).webkitExitFullscreen;await exit?.call(doc);if(soft)restore();resize();return;}
      if(soft){restore();resize();return;}
      const request=stage.requestFullscreen??(stage as HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>}).webkitRequestFullscreen;
      let timer:number|undefined;
      try{
        if(!request)throw Error('Native fullscreen unavailable');
        await Promise.race([Promise.resolve(request.call(stage)),new Promise<never>((_,reject)=>{timer=win.setTimeout(()=>reject(Error('Fullscreen did not respond')),1200);})]);
        if(nativeElement()!==stage)throw Error('Fullscreen was not entered');
      }catch{soft=true;stage.classList.add('is-fullscreen');fitHostFrames();}
      finally{if(timer!==undefined)win.clearTimeout(timer);}
      resize();schedule();canvas?.focus({preventScroll:true});
    }finally{busy=false;}
  }
  resize();
  return {toggleFullscreen,resize,isFullscreen:()=>nativeElement()===stage||soft,dispose(){
    if(disposed)return;disposed=true;if(queued)win.cancelAnimationFrame(queued);observer?.disconnect();pixelsObserver?.disconnect();listeners.forEach(fn=>fn());
    if(nativeElement()===stage)void doc.exitFullscreen?.().catch(()=>{});
    restore();stage.classList.remove('rpg-stage','is-battle');stage.style.removeProperty('--rpg-viewport-height');stage.style.removeProperty('--rpg-viewport-width');
  }};
}
