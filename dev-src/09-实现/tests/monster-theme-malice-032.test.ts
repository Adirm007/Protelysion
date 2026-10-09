import test from 'node:test';
import assert from 'node:assert/strict';
import {THEME_EXCLUSIVE} from '../src/game/monsters/theme-malice';
import {checkAssignment,checkKitsAndSmoke,checkThemeRange} from './theme-malice-shared';

test('主题专属 T01–T24：完全体与雏形都能编译、被动判定、run 作用域、隔离/时停/失控有期限、百分比下限、无对策文案', ()=>checkThemeRange(1,24));
test('主题专属 T01–T24：Boss t3+ 100% 完全体、精英 t5+ 100% 雏形、普通怪不拿；累进与墙检查照旧', ()=>checkAssignment(1,24));
test('主题专属 T01–T24：套件挂载 + 真实战斗闲置冒烟', ()=>checkKitsAndSmoke(1,24));
test('主题专属：48 个主题全部启用后，主题专属条目数为 48', ()=>{assert.equal(Object.keys(THEME_EXCLUSIVE).length,48);});
