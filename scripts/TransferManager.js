/**
 * RNK Inventory Move - TransferManager
 *
 * Patches CSB item drop handlers so that:
 *   - Same-actor drops stay on the native CSB move path.
 *   - Cross-actor drops create on the target and delete from the source.
 *   - Item-displayer → actor drops (item parent is a world Item) create a copy on the target.
 *
 * @module TransferManager
 */

export class TransferManager {
    static MODULE_ID = 'rnk-inventory-move';
    static EMBEDDED_ITEMS_FOLDER_NAME = 'CSB - Embedded Items Folder - DO NOT RENAME OR REMOVE';
    // Tracks UUIDs of items currently being transferred to prevent double-firing
    // when multiple patched prototypes are in the same call chain.
    static _inFlight = new Set();

    static init() {
        Hooks.once('ready', TransferManager._patchSheets);
    }

    static _collectSheetClasses(groups) {
        return Object.values(groups ?? {})
            .flatMap(group => Object.values(group ?? {}))
            .map(entry => entry?.cls)
            .filter(Boolean);
    }

    static _patchSheets() {
        const sheetClasses = [
            ...TransferManager._collectSheetClasses(CONFIG.Actor.sheetClasses),
            ...TransferManager._collectSheetClasses(CONFIG.Item.sheetClasses)
        ];

        const patched = new Set();
        for (const cls of sheetClasses) {
            let proto = cls.prototype;
            while (proto) {
                if (Object.prototype.hasOwnProperty.call(proto, '_onDropItem') && !patched.has(proto)) {
                    TransferManager._patchProto(proto);
                    patched.add(proto);
                }
                proto = Object.getPrototypeOf(proto);
            }
        }

        if (patched.size === 0) {
            console.warn('rnk-inventory-move | Could not find any _onDropItem to patch');
        } else {
            console.log(`rnk-inventory-move | Patched _onDropItem on ${patched.size} prototype(s)`);
        }
    }

    static async _createWithContents(items, container) {
        const created = [];
        const createItemData = async (item, containerId, depth) => {
            if (!item) return;

            const itemData = item.toObject();
            itemData.system = {
                ...itemData.system,
                container: containerId ?? undefined
            };
            itemData.folder = game.items.folders.getName(TransferManager.EMBEDDED_ITEMS_FOLDER_NAME)?.id ?? null;
            itemData._id = foundry.utils.randomID();
            created.push(itemData);

            if (item.items) {
                if (depth > 5) {
                    ui.notifications.warn(game.i18n.format('CSB.UserMessages.ItemMaxDepth', { depth: '5' }));
                }
                for (const child of item.items) {
                    await createItemData(child, itemData._id, depth + 1);
                }
            }
        };

        for (const item of items) {
            await createItemData(item, container?.id, 0);
        }

        return created;
    }

    static _patchProto(proto) {
        const original = proto._onDropItem;
        proto._onDropItem = async function (event, data) {
            const item = await Item.implementation.fromDropData(data);
            if (!item || item.type !== 'equippableItem') {
                return original.call(this, event, data);
            }

            const sourceActor = item.parent instanceof Actor ? item.parent : null;
            const sourceItem = item.parent instanceof Item ? item.parent : null;
            const targetActor = this.actor;
            const targetItem = this.item;

            // Source is not from an actor or world item — let CSB handle it
            if (!sourceActor && !sourceItem) {
                return original.call(this, event, data);
            }

            // Target is not an actor — let CSB handle it
            if (!(targetActor instanceof Actor)) {
                return original.call(this, event, data);
            }

            // Same-actor drop: let CSB handle reordering; suppress no-op drop onto item sheet
            if (sourceActor && sourceActor.uuid === targetActor.uuid) {
                return targetItem ? original.call(this, event, data) : null;
            }

            // Token actors: let CSB handle it
            if ((sourceActor?.isToken) || targetActor.isToken) {
                return original.call(this, event, data);
            }

            // Guard: if this item is already mid-transfer (another patched proto fired first), bail
            if (TransferManager._inFlight.has(item.uuid)) {
                return null;
            }
            TransferManager._inFlight.add(item.uuid);

            let result = null;
            try {
                const itemData = await TransferManager._createWithContents([item], targetItem);
                const created = await targetActor.createEmbeddedDocuments('Item', itemData);
                if (created?.length) {
                    // Only remove from source if the item was owned by an actor (not a world item)
                    if (sourceActor) {
                        await sourceActor.deleteEmbeddedDocuments('Item', [item.id]);
                        void sourceActor.render(false);
                    }
                    void targetActor.render(false);
                    void targetItem?.render(false);
                    result = created[0];
                }
            } finally {
                TransferManager._inFlight.delete(item.uuid);
            }

            return result;
        };
    }
}
