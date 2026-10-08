import {hash32, Random} from './maps/geometry';

export const SUPPLIER_APPEARANCE_RATE = .09;
export const SUPPLIER_NAME = '补给员';
export const SUPPLIER_QUESTION = '要选哪个呢？';
export const SUPPLIER_ART_ID = 'npc-supplier';
export const SUPPLIER_CHOICES = [
  {id: 'event', label: '事件'},
  {id: 'bench', label: '长椅'},
  {id: 'shop', label: '商店'},
  {id: 'kill', label: '杀害'},
] as const;
export type SupplierChoice = typeof SUPPLIER_CHOICES[number]['id'];

/** One independent lottery per generated floor/visit. Opening a menu, combat,
 * saving and restoring never draw again or consume the mutable battle RNG. */
export function supplierRoll(depth: number, visit: number, seed: number): number {
  return new Random(hash32(`supplier-v1|${seed >>> 0}|${depth}|${visit}`)).next();
}
export function supplierSpawns(depth: number, visit: number, seed: number): boolean {
  return supplierRoll(depth, visit, seed) < SUPPLIER_APPEARANCE_RATE;
}
