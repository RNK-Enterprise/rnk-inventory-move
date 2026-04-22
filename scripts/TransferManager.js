/**
 * RNK CSB Item Transfer - TransferManager
 *
 * Intercepts actor sheet drag-and-drop events for Custom System Builder
 * and deletes the source item after the copy is created on the target actor,
 * producing a move rather than a duplicate.
 *
 * @module TransferManager
 */

export class TransferManager {
    static MODULE_ID = 'rnk-csb-item-transfer';

    /**
     * UUID of the item currently being transferred.
     * Set on dropActorSheetData, consumed by preCreateItem, confirmed on createItem.
     * @type {string|null}
     * @private
     */
    static _pendingSourceUuid = null;

    /**
     * UUID of the target actor for the active transfer.
     * Used to verify the createItem callback belongs to this transfer.
     * @type {string|null}
     * @private
     */
    static _pendingTargetActorUuid = null;

    /* ---------------------------------------------------------- */
    /*  Initialization                                             */
    /* ---------------------------------------------------------- */

    /**
     * Register all hooks.  Called once from main.js on the 'init' lifecycle.
     */
    static init() {
        Hooks.on('dropActorSheetData', TransferManager._onDropActorSheetData);
        Hooks.on('preCreateItem', TransferManager._onPreCreateItem);
        Hooks.on('createItem', TransferManager._onCreateItem);
    }

    /* ---------------------------------------------------------- */
    /*  Hook: dropActorSheetData                                   */
    /* ---------------------------------------------------------- */

    /**
     * Fires when data is dropped onto any actor sheet.
     * If the dropped item belongs to a DIFFERENT actor we mark it for transfer.
     *
     * @param {Actor}  targetActor  The actor receiving the drop.
     * @param {object} _sheet       The sheet instance (unused).
     * @param {object} data         The drag-transfer data object from Foundry.
     * @returns {boolean}           Always true – we never cancel the default create.
     */
    static _onDropActorSheetData(targetActor, _sheet, data) {
        // Only handle Item drops.
        if (data.type !== 'Item') return true;

        // Resolve synchronously to stay within the synchronous hook contract.
        const sourceItem = fromUuidSync(data.uuid);
        if (!sourceItem) return true;

        const sourceParent = sourceItem.parent;

        // Must originate from an Actor (not the sidebar / compendium).
        if (!(sourceParent instanceof Actor)) return true;

        // Same actor = within-inventory re-ordering; CSB handles that natively.
        if (sourceParent.uuid === targetActor.uuid) return true;

        // Current user must have permission to delete the source.
        if (!sourceItem.canUserModify(game.user, 'delete')) {
            ui.notifications.warn(
                game.i18n.localize('RNKCSBIT.Notifications.NoDeletePermission')
            );
            return true;
        }

        // Mark this as a pending transfer.
        TransferManager._pendingSourceUuid      = data.uuid;
        TransferManager._pendingTargetActorUuid = targetActor.uuid;

        return true;
    }

    /* ---------------------------------------------------------- */
    /*  Hook: preCreateItem                                        */
    /* ---------------------------------------------------------- */

    /**
     * Fires before each Item document is created in the database.
     * We stamp the root item with the source UUID so createItem can
     * retrieve it later without any fragile name-matching.
     *
     * @param {Item}   item    The item document about to be created.
     * @param {object} data    The raw creation data.
     */
    static _onPreCreateItem(item, data) {
        if (!TransferManager._pendingSourceUuid) return;

        // Only stamp the root item of the transfer (no container parent).
        // CSB sets system.container on sub-items during createWithContents.
        if (data.system?.container) return;

        item.updateSource({
            [`flags.${TransferManager.MODULE_ID}.transferSourceUuid`]:
                TransferManager._pendingSourceUuid,
            [`flags.${TransferManager.MODULE_ID}.transferTargetActorUuid`]:
                TransferManager._pendingTargetActorUuid
        });

        // Consumed – clear so subsequent preCreateItem calls in the same
        // batch (sub-items) are ignored.
        TransferManager._pendingSourceUuid      = null;
        TransferManager._pendingTargetActorUuid = null;
    }

    /* ---------------------------------------------------------- */
    /*  Hook: createItem                                           */
    /* ---------------------------------------------------------- */

    /**
     * Fires after an Item document is created.
     * If the newly created item carries our transfer flag we delete the source.
     *
     * @param {Item}   item    The newly created item.
     * @param {object} _options
     * @param {string} userId  ID of the user who initiated the creation.
     */
    static async _onCreateItem(item, _options, userId) {
        // Only execute on the client that performed the drop.
        if (userId !== game.user.id) return;

        const sourceUuid = item.getFlag(TransferManager.MODULE_ID, 'transferSourceUuid');
        if (!sourceUuid) return;

        // Resolve the original source item.
        let sourceItem;
        try {
            sourceItem = await fromUuid(sourceUuid);
        } catch (err) {
            console.error(`${TransferManager.MODULE_ID} | Failed to resolve source UUID:`, err);
            return;
        }

        if (!sourceItem) return;

        // Delete source item and all of its nested CSB sub-items.
        await TransferManager._deleteItemWithContents(sourceItem);
    }

    /* ---------------------------------------------------------- */
    /*  Helpers                                                    */
    /* ---------------------------------------------------------- */

    /**
     * Recursively collects the IDs of an item and every item whose
     * system.container chain leads back to it, then deletes them all.
     *
     * @param {Item} rootItem  The top-level item to delete.
     * @returns {Promise<void>}
     */
    static async _deleteItemWithContents(rootItem) {
        const collection = rootItem.parent?.items ?? game.items;
        const idsToDelete = TransferManager._collectDescendantIds(rootItem.id, collection);
        idsToDelete.push(rootItem.id);

        if (rootItem.parent instanceof Actor) {
            await rootItem.parent.deleteEmbeddedDocuments('Item', idsToDelete);
        } else {
            await Item.deleteDocuments(idsToDelete);
        }
    }

    /**
     * Builds a flat array of all descendant item IDs belonging to the given parent.
     *
     * @param {string}     parentId    ID of the parent item.
     * @param {Collection} collection  The item collection to search within.
     * @returns {string[]}
     * @private
     */
    static _collectDescendantIds(parentId, collection) {
        const ids = [];
        for (const item of collection) {
            if (item.system?.container === parentId) {
                ids.push(item.id);
                ids.push(...TransferManager._collectDescendantIds(item.id, collection));
            }
        }
        return ids;
    }
}
