// Explicit diagnostic bootstrap replacing only the original HTML entry reference.
// Imports resolve through the same Vite module graph as the untouched native page entry.
import {Stage} from '../../../../packages/core/src/render/Stage.js';
import {Avatar} from '../../../../packages/core/src/Avatar.js';
import {installShowcaseBootHold} from './showcase-boot-hold.mjs';
const hold=installShowcaseBootHold({Stage,Avatar});
globalThis.__showcaseBootHold=hold;
try {
 await import('/src/showcase.js');
 globalThis.__showcaseBootAdmission=hold.admitReady(globalThis.showcase);
} catch(error) {
 globalThis.__showcaseBootError=String(error);
 try{hold.restoreForRetirement();}catch(cleanup){globalThis.__showcaseBootCleanupError=String(cleanup);}
 throw error;
}
