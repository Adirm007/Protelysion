import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {makeExternalHtml,makeExternalRegex} from '../scripts/public-loader.mjs';

function fixture({narrative=false,own=1}={}){
 const elements=new Map<string,any>(),calls:string[]=[];
 const create=(id?:string)=>{const node:any={id,hidden:false,disabled:false,textContent:'',innerHTML:'',style:{cssText:''},children:[] as any[],append(child:any){this.children.push(child);},querySelector(selector:string){return elements.get(selector.slice(1));}};if(id)elements.set(id,node);return node;};
 for(const id of ['loader-status','loader-retry','booksea-game','booksea-actions'])create(id);
 const rows=[{mes:'previous'},{mes:'current',extra:{}}],context={characterId:7,getCurrentChatId:()=> 'chat',chat:rows};
 const parent:any={SillyTavern:{getContext:()=>context},ReaderCore:{openBooksea:async(action:string)=>{calls.push(action);}}};
 const win:any={parent,SillyTavern:parent.SillyTavern,TavernHelper:{getVariables:()=>({booksea:{activeExpedition:{narrative:{active:narrative}}}})}};
 const document={getElementById:(id:string)=>elements.get(id),createElement:()=>create()};
 const script=makeExternalHtml('https://assets.example/game/').match(/<script>([\s\S]*?)<\/script>/)![1]!;
 new vm.Script(script).runInNewContext({window:win,document,URL,getCurrentMessageId:()=>own,fetch(){throw Error('The lightweight message must not download the game');}});
 return {elements,calls,buttons:elements.get('booksea-actions').children,context};
}

test('both entry and narrative markers use the one loader, adjacent tags are untouched',()=>{
 const item=makeExternalRegex('https://assets.example/game/',{}),literal=item.findRegex;
 const expression=new RegExp(literal.slice(1,literal.lastIndexOf('/')),literal.slice(literal.lastIndexOf('/')+1));
 assert.deepEqual('<booksea-game>进入</booksea-game> / <booksea-game>迷宫模式</booksea-game>'.match(expression),['<booksea-game>进入</booksea-game>','<booksea-game>迷宫模式</booksea-game>']);
 assert.deepEqual('<booksea-game>「进入\n书海」</booksea-game> / <booksea-game>迷宫模式</booksea-game>'.match(expression),['<booksea-game>「进入\n书海」</booksea-game>','<booksea-game>迷宫模式</booksea-game>']);
 assert.equal(expression.test('<booksea-game>未闭合<booksea-game>进入</booksea-game>'),true);
 assert.equal(expression.test('<booksea-game>未闭合'),false);
});

test('reader-owned entry is a lightweight control and repeated clicks do not boot another app',async()=>{
 const f=fixture();assert.equal(f.buttons.length,1);assert.equal(f.buttons[0].textContent,'打开迷宫');
 await f.buttons[0].onclick();await f.buttons[0].onclick();assert.deepEqual(f.calls,['maze']);
});

test('narrative controls route maze, descend and confirmed-leave UI to the persistent owner',async()=>{
 for(const [index,action]of ['maze','descend','leave'].entries()){
  const f=fixture({narrative:true});assert.equal(f.buttons.length,3);await f.buttons[index].onclick();assert.deepEqual(f.calls,[action]);
 }
});

test('historical panels and a changed chat cannot apply actions to the current run',async()=>{
 const historical=fixture({own:0});assert.ok(historical.buttons.every((button:any)=>button.disabled));await historical.buttons[0].onclick();assert.equal(historical.calls.length,0);
 const changed=fixture();changed.context.getCurrentChatId=()=> 'other';await changed.buttons[0].onclick();assert.equal(changed.calls.length,0);
});
