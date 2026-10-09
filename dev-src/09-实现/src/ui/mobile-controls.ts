import type {SendGameInput} from './game-dom';
export function joystickDirection(x:number,y:number,radius:number,deadzone=.23):{dx:number;dz:number}{
  if(radius<=0||Math.hypot(x,y)<radius*deadzone)return {dx:0,dz:0};
  return Math.abs(x)>Math.abs(y)?{dx:Math.sign(x),dz:0}:{dx:0,dz:Math.sign(y)};
}
/** CSS-transformed thumb, pointer capture and a grid-step timer; no canvas or animation loop. */
export function mountJoystick(root:HTMLElement,send:SendGameInput){
  const doc=root.ownerDocument,win=doc.defaultView!,thumb=doc.createElement('span');root.className='rpg-joystick';root.setAttribute('role','group');root.setAttribute('aria-label','移动摇杆');
  root.innerHTML='<svg class="rpg-stick-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45"/><path d="m44 16 6-5 6 5m28 28 5 6-5 6M44 84l6 5 6-5M16 44l-5 6 5 6"/></svg>';
  thumb.className='rpg-stick-thumb';root.append(thumb);
  let enabled=false,active:number|undefined,repeat=0,dx=0,dz=0,rect:DOMRect|undefined;
  const stop=()=>{if(repeat)win.clearInterval(repeat);repeat=0;active=undefined;dx=dz=0;thumb.style.transform='translate(0,0)';root.classList.remove('is-active');};
  const step=()=>{if(enabled&&(dx||dz))send('move',{dx,dz});};
  const move=(e:PointerEvent)=>{
    if(active!==e.pointerId||!rect)return;e.preventDefault();
    const x=e.clientX-(rect.left+rect.width/2),y=e.clientY-(rect.top+rect.height/2),radius=rect.width*.34,length=Math.hypot(x,y),scale=Math.min(1,radius/Math.max(length,1));
    thumb.style.transform=`translate(${x*scale}px,${y*scale}px)`;const next=joystickDirection(x,y,radius);
    if(next.dx!==dx||next.dz!==dz){dx=next.dx;dz=next.dz;step();}
  };
  root.onpointerdown=e=>{if(!enabled||active!==undefined)return;e.preventDefault();active=e.pointerId;rect=root.getBoundingClientRect();root.setPointerCapture(e.pointerId);root.classList.add('is-active');move(e);repeat=win.setInterval(step,160);};
  root.onpointermove=move;root.onpointerup=root.onpointercancel=root.onlostpointercapture=e=>{if(e.pointerId===active)stop();};
  root.oncontextmenu=e=>e.preventDefault();root.ondragstart=e=>e.preventDefault();
  return {setEnabled(value:boolean){enabled=value;if(!value)stop();},stop,dispose(){stop();root.replaceChildren();}};
}
export const INTERACT_ICON='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 16V6a3 3 0 0 1 6 0v7l3-1 7 5-3 11H13l-9-9a3 3 0 0 1 4-4l4 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
