/** One alpha-bounds measurement per packed portrait, never a per-frame GPU readback. */
const opaqueBounds = new Map<string, {x:number;y:number;width:number;height:number}>();
export function mountTargetArrow(node: HTMLElement, image?: HTMLImageElement, ally = false) {
  const doc = node.ownerDocument, arrow = doc.createElement('span'); arrow.className = 'rpg-target-arrow'; arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = '<svg viewBox="0 0 30 36" focusable="false"><path d="M8 2h14v16h7L15 34 1 18h7z" fill="currentColor" stroke="#281d19" stroke-width="2"/></svg>';
  node.append(arrow);
  const update = () => {
    if (ally || !image?.naturalWidth || !image.clientHeight) {arrow.style.left = '50%'; arrow.style.top = '0px'; return;}
    let bounds = opaqueBounds.get(image.src);
    if (!bounds) {
      bounds = {x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
      try {
        const canvas = doc.createElement('canvas'); canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let x0=canvas.width,y0=canvas.height,x1=0,y1=0;
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]!>24){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
        if(x1>=x0&&y1>=y0)bounds={x:x0,y:y0,width:x1-x0+1,height:y1-y0+1};
      } catch { /* A placeholder still gets a usable cursor; no external pixel access is required. */ }
      opaqueBounds.set(image.src,bounds);
    }
    const r=image.getBoundingClientRect(),n=node.getBoundingClientRect(),scale=Math.min(r.width/image.naturalWidth,r.height/image.naturalHeight);
    arrow.style.left=(r.left-n.left+(r.width-image.naturalWidth*scale)/2+(bounds.x+bounds.width/2)*scale)+'px';
    arrow.style.top=(r.top-n.top+r.height-image.naturalHeight*scale+bounds.y*scale-7)+'px';
  };
  image?.addEventListener('load',update);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):undefined;observer?.observe(node);if(image)observer?.observe(image);
  update();
  return ()=>{observer?.disconnect();image?.removeEventListener('load',update);arrow.remove();};
}
