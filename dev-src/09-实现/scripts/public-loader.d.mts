export type LoadedRegex<T> = T & {scriptName:string;findRegex:string;disabled:boolean;replaceString:string};
export function makeExternalHtml(base:string,css?:string,mode?:'host'|'standalone'):string;
export function makeExternalRegex<T extends Record<string,unknown>>(base:string,template:T,css?:string):LoadedRegex<T>;
export function makeLocalRegex<T extends Record<string,unknown>>(template:T,css?:string):LoadedRegex<T>;
