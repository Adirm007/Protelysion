import {array,enumeration,literal,nullable,number,object,text,type Infer} from '../compiler/schema';
const resources=object({hp:number(),mp:number(),sp:number()});
export const RosterView=object({
  mode:literal('readonly-not-entry'),messageId:number(0,Number.MAX_SAFE_INTEGER,true),
  actors:array(object({id:text(80),name:text(256),kind:enumeration(['player','partner'] as const),
    level:nullable(number(1,25,true)),current:nullable(resources),max:nullable(resources),
    eligibility:enumeration(['eligible','blocked'] as const),reason:text(1000),
    cache:enumeration(['missing','source-matches','stale','incompatible','invalid'] as const)}),0,512),
  selectedIds:array(text(80),0,4)
});
export type RosterView=Infer<typeof RosterView>;
