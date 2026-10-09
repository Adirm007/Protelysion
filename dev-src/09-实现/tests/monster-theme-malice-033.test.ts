import test from 'node:test';
import {checkAssignment,checkKitsAndSmoke,checkThemeRange} from './theme-malice-shared';

test('主题专属 T25–T48：完全体与雏形都能编译、被动判定、run 作用域、隔离/时停/失控有期限、百分比下限、无对策文案', ()=>checkThemeRange(25,48));
test('主题专属 T25–T48：Boss t3+ 100% 完全体、精英 t5+ 100% 雏形、普通怪不拿；累进与墙检查照旧', ()=>checkAssignment(25,48));
test('主题专属 T25–T48：套件挂载 + 真实战斗闲置冒烟', ()=>checkKitsAndSmoke(25,48));
