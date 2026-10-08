import {actorAt,actorKey,object,resourceMax,type ActorRef,type Obj} from '../core/actors';
import {inspectCache,type Cache} from '../core/cache';
import {validateCompiled,type CompiledActor} from '../compiler/engine';
import {hostSkillScale} from '../compiler/host-skill-scale';
import type {SessionPort} from '../host/game-session';
import type {ActionSpec} from '../compiler/contract';
import {describeAction,targetText,costText,qualityName} from './ability-text';
import {repairLegacyTargeting} from '../battle/targeting';
import {escapeHtml as esc,icons} from './theme';
const integer=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.round(value).toLocaleString('zh-CN'):'—';
export function characterData(port:SessionPort,ref:ActorRef){
 const actor=actorAt(port.read(),ref),caches=object(object(port.chat().booksea??{}).actorCache??{}),cache=caches[actorKey(ref)] as Cache|undefined;
 let card:CompiledActor|undefined;const state=inspectCache(cache,actor,ref);
 if(cache&&state.status==='ready'){try{card=validateCompiled(cache.compiledActor);}catch{}}
 return {actor,card,ready:!!card,name:ref.kind==='player'?'主角':ref.name,level:Number(actor.等级),state};
}
export function executableCount(card:CompiledActor|undefined){return card?.skills.filter(s=>s.mapping.disposition==='active'||s.mapping.disposition==='passive').length??0;}
const groupName=(id:string)=>id.startsWith('/技能/')?'技能':id.startsWith('/登神长阶/要素/')?'要素':id.startsWith('/登神长阶/')?'登神之力':id.startsWith('/装备/')?'装备能力':id.startsWith('/道具定义/')?'携带道具':id.startsWith('/状态定义/')?'当前状态':'天性与特质';
export function renderCharacterSheet(body:HTMLElement,port:SessionPort,ref:ActorRef,onPrepare:()=>void){
 const {actor,card,ready,name,level}=characterData(port,ref),scale=hostSkillScale(level),attrs:Obj=card?.numeric.attributes??object(actor.属性??{});
 const resourceDefs=[['生命值','hp','生命'],['法力值','mp','法力'],['体力值','sp','体力']] as const;
 body.innerHTML=`<div class="bs-profile"><div class="bs-profile-emblem">${esc([...name][0]??'旅')}</div><div><h2>${esc(name)}</h2><div class="bs-profile-tags"><span class="bs-pill">Lv.${level}</span><span class="bs-pill violet">${esc(scale.qualityName)}</span><span class="bs-pill ${ready?'green':''}">${ready?'已就绪':'待整备'}</span></div></div></div><div class="bs-resource-grid">${resourceDefs.map(([host,key,label])=>`<div class="bs-stat-box"><span>${label}</span><strong>${integer(object(actor[host]).当前)}<small> / ${integer(card?.numeric.max[key]??resourceMax(actor,host))}</small></strong></div>`).join('')}</div><div class="bs-stat-grid">${['力量','敏捷','体质','智力','精神'].map(n=>`<div>${integer(attrs[n])}<small>${n}</small></div>`).join('')}</div>`;
 if(!card){const empty=body.ownerDocument.createElement('div');empty.className='bs-empty';empty.innerHTML=icons.book+'<p>能力尚未整备</p>';const button=body.ownerDocument.createElement('button');button.className='bs-button bs-primary';button.style.marginTop='16px';button.textContent='整备此角色';button.onclick=onPrepare;empty.append(button);body.append(empty);return;}
 const groups=new Map<string,CompiledActor['skills']>();for(const skill of card.skills){if(!['active','passive'].includes(skill.mapping.disposition))continue;const group=groupName(skill.sourceId);if(!groups.has(group))groups.set(group,[]);groups.get(group)!.push(skill);}
 for(const [group,skills]of groups){const heading=body.ownerDocument.createElement('div');heading.className='bs-skill-heading';heading.innerHTML=`<h3>${esc(group)}</h3><span class="bs-pill">${skills.length}</span>`;body.append(heading);
  for(const skill of skills){const mapping=skill.mapping,a=mapping.disposition==='active'?repairLegacyTargeting(mapping.action!).action:mapping.action!;const mode=skill.adaptation?.mode??(mapping.fidelity?.mode==='approximate'?'approximate':'original');const badge=mode==='replacement'?'同阶转化':mode==='approximate'?'迷宫适配':'原有效果';const quality=skill.adaptation?.quality??qualityName[a.source?.quality??''];
   const block=body.ownerDocument.createElement('article');block.className='bs-skill-card';
   const effects=describeAction(a,card.numeric),timing=a.perBattleUses?'每场 '+a.perBattleUses+' 次':a.castMs?'咏唱 '+(a.castMs/1000)+' 秒':'';
   block.innerHTML=`<div class="bs-skill-top"><h3>${esc(skill.name)}</h3><div class="bs-skill-badges"><span class="bs-pill ${mode==='original'?'green':'violet'}">${badge}</span>${quality?'<span class="bs-pill">'+esc(quality)+'</span>':''}</div></div><p class="bs-skill-meta">${mapping.disposition==='passive'?'被动':targetText(a)} · ${esc(costText(a))}${timing?' · '+timing:''}</p><ul class="bs-skill-effects">${effects.map(line=>'<li>'+esc(line)+'</li>').join('')}</ul>`;
   if(mode==='replacement'){const shift=body.ownerDocument.createElement('p');shift.className='bs-skill-shift';shift.textContent='本局转化为 '+(a.name&&a.name!==skill.name?a.name:(quality??scale.qualityName)+'能力');block.append(shift);}
   const granted=[...(mapping.actions??[]).map(x=>repairLegacyTargeting(x).action),...(a.grantedActions??[]).flatMap(id=>{const sub=a.library?.actions[id];return sub?[{...sub,library:a.library} as ActionSpec]:[]})];
   for(const active of granted){const sub=body.ownerDocument.createElement('div');sub.className='bs-skill-shift';sub.innerHTML=`<b>${esc(active.name??'主动效果')}</b><p class="bs-skill-meta">${esc(targetText(active))} · ${esc(costText(active))}${active.perBattleUses?' · 每场'+active.perBattleUses+'次':''}</p><ul class="bs-skill-effects">${describeAction(active,card.numeric).map(line=>'<li>'+esc(line)+'</li>').join('')}</ul>`;block.append(sub);}
   body.append(block);
  }
 }
 if(!groups.size){const empty=body.ownerDocument.createElement('p');empty.className='bs-player-status';empty.textContent='已准备就绪，可使用基础战斗指令。';body.append(empty);}
 const footer=body.ownerDocument.createElement('div');footer.className='bs-skill-heading';const update=body.ownerDocument.createElement('button');update.className='bs-button';update.textContent='重新整备';update.onclick=onPrepare;footer.append(update);body.append(footer);
}
