import {BRIDGE_VERSION,decodeIntent,PresentationMessage} from './protocol';
import {RosterView} from './roster-contract';
/** Dedicated read-only presentation. Never constructs a battle or grants admission from a cache label. */
export class RosterBridge {
  #view:RosterView;#sequence=0;#lastInput=0;#ready=false;#closed=false;
  readonly sessionId:string;
  constructor(view:RosterView,sessionId:string){this.#view=RosterView.parse(view);this.sessionId=sessionId;}
  #message(type:string,payload:unknown):PresentationMessage {
    return PresentationMessage.parse({protocolVersion:BRIDGE_VERSION,sessionId:this.sessionId,sequence:++this.#sequence,type,payload});
  }
  snapshot():PresentationMessage{return this.#message('actor_snapshot',this.#view);}
  update(view:RosterView):PresentationMessage {if(this.#closed)throw Error('呈现会话已关闭');this.#view=RosterView.parse(view);return this.snapshot();}
  receive(wire:unknown):PresentationMessage[]{
    if(this.#closed)return[];
    try {
      const m=decodeIntent(wire);
      if(m.sessionId!==this.sessionId||m.sequence<=this.#lastInput)throw Error('旧会话或重复消息');
      this.#lastInput=m.sequence;
      if(m.type!=='ui_ready'||this.#ready)throw Error('此页面只支持角色查看，不执行战斗输入');
      this.#ready=true;
      return[this.#message('boot_config',{authority:'typescript',mode:'host-readonly-roster'}),this.snapshot()];
    }catch{return[this.#message('error_view',{code:'READONLY_INPUT_REJECTED',message:'输入未执行；此页面仅显示宿主快照。'})];}
  }
  setHostBlocked(reason:string,blocked:boolean):PresentationMessage {
    if(blocked&&(reason==='chat-changed'||reason==='transport'||reason==='context-lost'))this.close();
    return this.#message('error_view',{code:blocked?'HOST_PAUSED':'HOST_VISIBLE',message:blocked?'宿主或显示已暂停，请重新打开查看器。':'页面已恢复；此处不推进规则时间。'});
  }
  close(){this.#closed=true;this.#view={mode:'readonly-not-entry',messageId:0,actors:[],selectedIds:[]};}
}
