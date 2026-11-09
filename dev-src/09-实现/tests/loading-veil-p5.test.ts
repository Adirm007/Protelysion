// P5 map-load veil and the renderer floor-pack bridge.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountLoadingVeil,veilVariantFor,veilVariantForTheme,VEIL_THEME_AFFINITY,VEIL_VARIANTS,VEIL_MIN_MS,VEIL_FADE_MS,VEIL_CSS} from '../src/ui/loading-veil';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {startExpedition} from '../src/game/expedition';
import {playtestParty,THEME_ORDER} from '../src/game/content';

/** Just enough DOM for the veil: elements, class lists, datasets, selectors by class and a manual clock. */
class FakeElement{
 children:FakeElement[]=[];parent:FakeElement|null=null;attrs:Record<string,string>={};dataset:Record<string,string>={};
 hidden=false;id='';textContent='';private html='';private found=new Map<string,FakeElement>();private classes=new Set<string>();
 constructor(readonly tag:string){}
 get className(){return [...this.classes].join(' ');}
 set className(v:string){this.classes=new Set(v.split(/\s+/).filter(Boolean));}
 classList={add:(c:string)=>{this.classes.add(c);},remove:(c:string)=>{this.classes.delete(c);},contains:(c:string)=>this.classes.has(c)};
 get innerHTML(){return this.html;}
 set innerHTML(v:string){this.html=v;this.found.clear();}
 setAttribute(k:string,v:string){this.attrs[k]=v;}
 querySelector(selector:string){
  const cls=selector.replace(/^\./,'');
  if(!new RegExp(`class="[^"]*\\b${cls}\\b`).test(this.html))return null;
  if(!this.found.has(cls)){const child=new FakeElement('div');child.className=cls;this.found.set(cls,child);}
  return this.found.get(cls)!;
 }
 append(...nodes:FakeElement[]){for(const n of nodes){n.parent=this;this.children.push(n);}}
 remove(){if(this.parent){this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}}
}
function fakePage(){
 let now=0,seq=0;const timers=new Map<number,{at:number;fn:()=>void}>();
 const head=new FakeElement('head');
 const doc={head,createElement:(tag:string)=>new FakeElement(tag),getElementById:(id:string)=>head.children.find(c=>c.id===id)??null};
 const win={performance:{now:()=>now},setTimeout:(fn:()=>void,ms:number)=>{timers.set(++seq,{at:now+ms,fn});return seq;},clearTimeout:(id:number)=>{timers.delete(id);}};
 const stage=Object.assign(new FakeElement('main'),{ownerDocument:doc});
 const advance=(ms:number)=>{const end=now+ms;for(;;){const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn();}now=end;};
 return {stage,head,win,advance};
}
const mount=(page:ReturnType<typeof fakePage>)=>mountLoadingVeil(page.stage as unknown as HTMLElement,page.win as unknown as Window);

test('Three themed veils: library, fairy-tale and marionette theatre with stable per-floor choice',()=>{
 assert.deepEqual([...VEIL_VARIANTS],['library','fairytale','marionette']);
 const seen=new Set(Array.from({length:60},(_,i)=>veilVariantFor('floor-'+i)));assert.equal(seen.size,3);
 assert.equal(veilVariantFor('region-1-2-3'),veilVariantFor('region-1-2-3'));
 assert.equal(veilVariantForTheme('T48','x'),'marionette');assert.equal(veilVariantForTheme('T15','x'),'library');assert.equal(veilVariantForTheme('T04','x'),'fairytale');
 assert.equal(veilVariantForTheme('T09','region-9'),veilVariantFor('region-9'));
 for(const theme of Object.keys(VEIL_THEME_AFFINITY))assert.ok(THEME_ORDER.includes(theme as never),theme);
 const page=fakePage(),veil=mount(page);
 const markers={library:'bsv-lib',fairytale:'bsv-fairy',marionette:'bsv-thea'} as const;
 for(const variant of VEIL_VARIANTS){
  veil.update({key:'k-'+variant,variant,subtitle:'第 3 层'});
  const root=page.stage.children[0]!;
  assert.equal(root.dataset.variant,variant);assert.match(root.querySelector('.bsv-scene')!.innerHTML,new RegExp(markers[variant]));
  assert.equal(root.querySelector('.bsv-sub')!.textContent,'第 3 层');assert.ok(root.querySelector('.bsv-title')!.textContent.length>3);
 }
 veil.dispose();assert.equal(page.stage.children.length,0);
});

test('Veil stays for the minimum time, fades out, re-shows on the next floor and warns when slow',()=>{
 const page=fakePage(),veil=mount(page);const root=page.stage.children[0]!;
 assert.equal(root.hidden,true);assert.equal(root.attrs.role,'status');
 assert.equal(page.head.children.filter(c=>c.id==='booksea-veil-style').length,1);
 mount(page).dispose();assert.equal(page.head.children.filter(c=>c.id==='booksea-veil-style').length,1,'style injected once');
 veil.update({key:'floor-a',variant:'library'});assert.equal(veil.visible,true);assert.equal(root.hidden,false);
 page.advance(300);veil.update(null);assert.equal(veil.visible,true,'no flash: minimum display time');
 page.advance(VEIL_MIN_MS-300-1);assert.equal(root.classList.contains('is-leaving'),false);
 page.advance(1);assert.equal(root.classList.contains('is-leaving'),true);
 page.advance(VEIL_FADE_MS);assert.equal(veil.visible,false);assert.equal(root.hidden,true);
 veil.update({key:'floor-b',variant:'marionette'});page.advance(VEIL_MIN_MS);veil.update(null);page.advance(VEIL_FADE_MS/2);
 veil.update({key:'floor-c',variant:'fairytale'});assert.equal(root.classList.contains('is-leaving'),false,'a new floor cancels the fade');
 page.advance(VEIL_FADE_MS);assert.equal(veil.visible,true);assert.equal(veil.variant,'fairytale');
 page.advance(20000);assert.match(root.querySelector('.bsv-hint')!.textContent,/请再稍候/);
 veil.update(null);page.advance(VEIL_MIN_MS+VEIL_FADE_MS);assert.equal(veil.visible,false);
});

test('Veil animations only touch transform and opacity and honour reduced motion',()=>{
 const page=fakePage();mount(page);
 const css=page.head.children.find(c=>c.id==='booksea-veil-style')!.textContent;
 const frames=[...css.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
 assert.ok(frames.length>=12,String(frames.length));
 const props=new Set<string>();
 for(const f of frames)for(const block of f[1]!.matchAll(/\{([^{}]*)\}/g))for(const decl of block[1]!.split(';'))if(decl.includes(':'))props.add(decl.split(':')[0]!.trim());
 assert.deepEqual([...props].sort(),['opacity','transform']);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/\.bsv\{position:absolute;inset:0;z-index:60/);
});

function environment(){
 const storage=new Map<string,string>();
 const win={localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},setInterval:()=>1,clearInterval:()=>{},document:{hidden:false,addEventListener:()=>{},removeEventListener:()=>{}},addEventListener:()=>{},removeEventListener:()=>{}} as unknown as Window;
 return win;
}

test('Runtime serves the current floor pack to the renderer only, cached per quality, never saved',()=>{
 const win=environment(),state=startExpedition(playtestParty(),9101);
 const runtime=mountExpeditionRuntime({storageKey:'p5-pack',initial:state,audio:false},win);
 const api=(win as unknown as {BookseaPlay:typeof runtime}).BookseaPlay;
 assert.equal(api.floorPack('floor-other','desktop'),null);
 assert.deepEqual(api.loading(),{visible:false,variant:null});
 const id=state.region.layout.id,pack=api.floorPack(id,'mobile')!;
 assert.ok(pack.glb instanceof Uint8Array&&pack.tex instanceof Uint8Array&&typeof pack.meta==='string');
 assert.equal(new DataView(pack.glb.buffer,pack.glb.byteOffset).getUint32(0,true),0x46546c67);
 const meta=JSON.parse(pack.meta);assert.equal(meta.quality,'mobile');assert.equal(meta.fingerprint.length>0,true);
 assert.equal(api.floorPack(id,'mobile'),pack,'cached');
 assert.doesNotMatch(JSON.stringify(api.inspect()),/glbBytes|"glb"/);
 runtime.dispose();assert.equal(api.floorPack(id,'mobile'),null);
});

// 9.2 (前端重置): the veil art moved out of the bundle into release files (site/ui/veil/*, verified through the
// resource store), and the theatre became 夜梦's marionette on a control bar. Same intent as the 0.37.4 check:
// every art file is used, the puppet hangs on strings, and a new floor replays the opening.
test('9.2 veil art: seven scenes in three families, release-file art, a marionette on strings, opening replays per floor',async()=>{
 const {VEIL_ART}=await import('../src/ui/veil-art');
 const {veilScene,veilSceneFor,VEIL_SCENES}=await import('../src/ui/loading-veil');
 assert.deepEqual(Object.values(VEIL_SCENES).flat().sort(),['clock','fairy','ferry','library','night','shop','theater']);
 const html=new Set<string>();
 for(const v of VEIL_VARIANTS)for(let i=0;i<120;i++){const k='floor-'+i;assert.ok(VEIL_SCENES[v].includes(veilSceneFor(v,k)));html.add(veilScene(v,k));}
 const all=[...html].join('');
 for(const [key,file] of Object.entries(VEIL_ART)){assert.match(file,/^ui\/veil\/[a-z0-9-]+\.webp$/,key);assert.ok(all.includes(file),'unused art '+key);}
 assert.equal(veilSceneFor('library','x'),veilSceneFor('library','x'));
 const theater=veilScene('marionette','any');
 assert.match(theater,/bsv-rig/);assert.equal((theater.match(/class="bsv-string"/g)??[]).length,3,'strings: two hands and the head');
 assert.ok(theater.includes(VEIL_ART['theater-dream'])&&theater.includes(VEIL_ART['theater-curtain']));
 assert.match(VEIL_CSS,/@keyframes bsv-sway\{/);assert.match(VEIL_CSS,/@keyframes bsv-turn\{/);
 const page=fakePage(),veil=mount(page),root=page.stage.children[0]!,scene=root.querySelector('.bsv-scene')!;
 veil.update({key:'floor-1',variant:'marionette'});const first=scene.innerHTML;
 scene.innerHTML='(stale)';veil.update({key:'floor-1',variant:'marionette'});assert.equal(scene.innerHTML,'(stale)','same floor: no restart');
 veil.update({key:'floor-2',variant:'marionette'});assert.equal(scene.innerHTML,first,'new floor: opening replays');
 veil.dispose();
});
