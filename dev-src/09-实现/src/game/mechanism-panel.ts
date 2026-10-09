import {rewardLabel} from '../core/settlement';
import type {view} from './expedition';
export function mechanismPanelKey(v:ReturnType<typeof view>){
 const {timeMs:_time,units,...battle}=v.battle;
 const stableUnits=units.map(({atb:_atb,statuses,...u})=>({...u,statuses:statuses.map(s=>({...s,remaining:s.clock==='battle_time'?Math.ceil(s.remaining/1000):s.remaining}))}));
 return JSON.stringify({mode:v.mode,paused:v.paused,depth:v.depth,notice:v.notice,intel:v.explorationIntel,settings:v.settings,party:v.party.map(p=>[p.id,p.hp,p.mp,p.sp,p.status]),battle:{...battle,units:stableUnits},ev:v.event,relic:v.relicDetails,settlement:v.settlement});
}
export function mechanismPanel(root:HTMLElement,send:(type:string,payload?:Record<string,unknown>)=>void){
 root.setAttribute('aria-label','战斗与探索操作');root.classList.add('bs-mechanics');let last='';
 const element=(tag:string,text='')=>{const el=document.createElement(tag);el.textContent=text;return el;};
 function button(text:string,type:string,payload:Record<string,unknown>={},disabled=false){const b=element('button',text) as HTMLButtonElement;b.disabled=disabled;b.onclick=()=>send(type,payload);return b;}
 return (v:ReturnType<typeof view>|{mode:string;canContinue:boolean})=>{
  if(!('party'in v))return;const key=mechanismPanelKey(v);if(key===last)return;last=key;
  const opened=new Set(Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-key]')).filter(d=>d.open).map(d=>d.dataset.key)),scroll=root.scrollTop;root.replaceChildren();
  const details=(id:string)=>{const d=element('details') as HTMLDetailsElement;d.dataset.key=id;d.open=opened.has(id);return d;};
  const heading=element('div',`第 ${v.depth} 层 · ${v.themeName}`);heading.className='bs-stage-toolbar';root.append(heading);if(v.notice)root.append(element('p',v.notice));if(v.mode!=='ended')heading.append(button(v.paused?'继续':'暂停','pause'));
  if(v.mode==='explore'){
   root.append(button('交互','interact'),button('结束旅程','withdraw'));
   for(const p of v.party){const box=element('section'),line=element('div',`${p.name} · 生命 ${Math.round(p.hp)}/${Math.round(p.maxHp)}`);line.className='bs-skill-heading';box.append(line);root.append(box);if(p.status!=='active'){box.append(element('p','已离队'));continue;}
    box.append(button('离队返回','withdraw',{ids:[p.id]}));
    for(const a of p.outsideActions){const info=details('outside:'+p.id+':'+a.id);info.append(element('summary',a.name));const effects=element('ul');effects.className='bs-skill-effects';for(const text of a.effectText)effects.append(element('li',text));info.append(effects);const targets=a.target==='self'?[p]:v.party.filter(x=>x.status==='active');for(const t of targets)info.append(button(a.target==='self'?'使用':'对 '+t.name+' 使用','outsideSkill',{actor:p.id,id:a.id,targets:[t.id]}));box.append(info);}
   }
   for(const r of v.relicDetails){const d=details('relic:'+r.id+':'+r.owner);d.append(element('summary',r.name??'遗物'),element('p',r.description??''),button('放下遗物','removeRelic',{id:r.id,owner:r.owner}));root.append(d);}
  }
  if(v.mode==='battle'){
   for(const u of v.battle.units){const card=details('unit:'+u.id);card.append(element('summary',`${u.name}${u.owner?' · 召唤物':''} · Lv.${u.level} · 生命 ${Math.round(u.hp)}/${Math.round(u.maxHp)}`));const stats=element('div');stats.className='bs-mini-row';for(const text of ['法力 '+Math.round(u.mp),'体力 '+Math.round(u.sp),'护盾 '+Math.round(u.shield),'物防 '+Math.round(u.armor.physical),'能量防御 '+Math.round(u.armor.energy)])stats.append(element('span',text));card.append(stats);for(const s of u.statuses)card.append(element('p',s.name+(s.stacks>1?' ×'+s.stacks:'')+' · '+s.description));root.append(card);}
   if(v.battle.ready){root.append(element('strong',v.battle.actorName+' 的行动'));
    for(const [id,name]of [['all','全部'],['skill','技能'],['spell','法术'],['item','物品'],['relic','遗物'],['command','基础动作'],['favorite','收藏']])root.append(button(name!,'category',{id}));
    for(const a of v.battle.visibleActions){const row=element('div'),cost=[a.mp?'法力 '+Math.ceil(a.mp):'',a.sp?'体力 '+Math.ceil(a.sp):'',a.hp?'生命 '+Math.ceil(a.hp):''].filter(Boolean).join(' · ');row.append(button(a.name+(cost?' · '+cost:''),'skill',{id:a.id},a.disabled),button(a.favorite?'★':'☆','favorite',{id:a.id}));const info=details('action:'+a.id);info.append(element('summary','效果'));const lines=element('ul');lines.className='bs-skill-effects';for(const text of a.effectText)lines.append(element('li',text));if(a.limit)lines.append(element('li',`本场剩余 ${Math.max(0,a.limit-a.used)} 次`));if(a.charges!==null)lines.append(element('li','充能 '+a.charges));info.append(lines);row.append(info);root.append(row);}
    root.append(button('上一页','page',{value:v.battle.page-1},v.battle.page<=0),element('span',`${v.battle.page+1} / ${Math.max(1,v.battle.pages)}`),button('下一页','page',{value:v.battle.page+1},v.battle.page+1>=v.battle.pages),button('尝试撤退','flee'));
   }
   if(v.battle.selected){root.append(element('p','选择目标'));for(const id of v.battle.targets){const u=v.battle.units.find(u=>u.id===id)!;root.append(button((v.battle.selectedTargets.includes(id)?'✓ ':'')+u.name,'target',{id}));}if(v.battle.selectedTargets.length)root.append(button('确认','confirmTargets'));root.append(button('取消','cancel'));}
  }
  if(v.mode==='event'&&v.event){root.append(element('h3',v.event.title),element('p',v.event.body));for(const p of v.party.filter(p=>p.status==='active'))root.append(button('交给 '+p.name,'eventOwner',{id:p.id}));for(const [index,c]of v.event.choices.entries()){const option=button(c.label,'event',{choice:index},c.disabled);const detail=element('small',c.description);detail.style.cssText='display:block;white-space:pre-line';option.append(detail);root.append(option);}}
  if(v.mode==='explore'&&(v.explorationIntel.enemies.length||v.explorationIntel.chests?.length)){const count=v.explorationIntel.enemies.reduce((n,g)=>n+g.enemies.length,0);root.append(element('p',(count?'附近感知到 '+count+' 名敌人':'')+(v.explorationIntel.chests?.length?' · '+v.explorationIntel.chests.length+' 个宝箱':'')));}
  if(v.mode==='ended'&&v.settlement){const s=v.settlement,box=element('section');box.className='bs-settlement';box.append(element('h3',v.source==='host'&&!s.committed?'正在收好这页……':s.outcome==='success'?'这一页，已珍藏':'稍作休息，再启程'),element('p','抵达第 '+v.depth+' 层'));for(const p of s.experience){const row=element('div');row.className='bs-reward';row.append(element('span',p.ref.kind==='player'?'主角':p.ref.name),element('span','经验 +'+p.amount));box.append(row);}for(const r of s.rewards){const row=element('div');row.className='bs-reward';row.append(element('span',rewardLabel(r)),element('span','×'+r.count));box.append(row);}box.append(button('继续故事','handoff'));root.append(box);}
  const settings=details('settings');settings.append(element('summary','游玩设置'));for(const n of [1,2,3])settings.append(button('动画 ×'+n,'settings',{animationSpeed:n}));settings.append(button('关闭震屏','settings',{shake:false}),button('关闭闪烁','settings',{flash:false}),button('静音','settings',{music:0,effects:0}),button('恢复声音','settings',{music:.7,effects:.8}));root.append(settings);root.scrollTop=scroll;
 };
}
