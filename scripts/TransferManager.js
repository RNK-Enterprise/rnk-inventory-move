/**
 * RNK Inventory Move - TransferManager
 *
 * Patches CSB item drops so successful cross-actor copies become moves.
 *
 * @module TransferManager
 */

export class TransferManager {
    static MODULE_ID = 'rnk-inventory-move';
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

    static _hasCreatedItem(result) {
        if (Array.isArray(result)) return result.length > 0;
        return !!result;
    }

    static _patchProto(proto) {
        const original = proto._onDropItem;
        proto._onDropItem = async function (event, data) {
            const item = await Item.implementation.fromDropData(data);
            if (!item || item.type !== 'equippableItem') {
                return original.call(this, event, data);
            }

            const sourceActor = item.parent instanceof Actor ? item.parent : null;
            const targetActor = this.actor instanceof Actor ? this.actor : null;
            const targetItem = this.item instanceof Item ? this.item : null;

            if (!sourceActor || !targetActor || sourceActor.isToken || targetActor.isToken) {
                return original.call(this, event, data);
            }

            if (sourceActor.uuid === targetActor.uuid) {
                if (targetItem || item.system?.container) {
                    return original.call(this, event, data);
                }
                return null;
            }

            if (TransferManager._inFlight.has(item.uuid)) return null;
            TransferManager._inFlight.add(item.uuid);

            try {
                const result = await original.call(this, event, data);
                if (TransferManager._hasCreatedItem(result)) {
                    await sourceActor.deleteEmbeddedDocuments('Item', [item.id]);
                    void sourceActor.render(false);
                    void targetActor.render(false);
                    void targetItem?.render(false);
                }
                return result;
            } finally {
                TransferManager._inFlight.delete(item.uuid);
            }
        };
    }
}
