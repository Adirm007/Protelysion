import type {State} from '../src/game/expedition';
import type {Thing} from '../src/game/region';

/** Explicit mechanic fixture, NOT a production spawn rule or supplier bypass. */
export function installEventFixture(s: State): Thing {
  const t: Thing = {id: 'isolated-event-fixture', kind: 'event', x: s.x, z: s.z, name: '事件测试夹具', used: false, foes: []};
  s.region.things.push(t); return t;
}
