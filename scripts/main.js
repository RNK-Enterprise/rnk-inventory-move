/**
 * RNK Inventory Move - Entry Point
 *
 * Bootstraps the module by registering the TransferManager on the
 * Foundry 'init' lifecycle hook.  Keeps this file intentionally thin.
 *
 * @module main
 */

import { TransferManager } from './TransferManager.js';

Hooks.once('init', () => {
    console.log('rnk-inventory-move | Initializing RNK Inventory Move');
    TransferManager.init();
});
