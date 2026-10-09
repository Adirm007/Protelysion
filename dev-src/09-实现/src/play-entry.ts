import {playtestParty} from './game/content';
import {startExpedition} from './game/expedition';
import {mountExpeditionRuntime} from './game/runtime';
mountExpeditionRuntime({uiRoot:document.querySelector<HTMLElement>('#stage')??document.querySelector('canvas')?.parentElement??undefined,storageKey:'booksea-expedition-random-v2',newGame:()=>startExpedition(playtestParty(),Date.now()>>>0)});
