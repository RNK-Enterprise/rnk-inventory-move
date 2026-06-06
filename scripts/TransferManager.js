/**
 * LD Inventory Move - TransferManager
 *
 * Patches CSB's _onDropItem on both sheet classes so that:
 *   - Same-actor drops are no-ops (no duplicate created).
 *   - Cross-actor drops create the item on the target then delete it from the source.
 *
 * @module TransferManager
 */

export class TransferManager {
    static MODULE_ID = 'ld-inventory-move';

    static init() {
        // Patch both CSB sheet classes once they exist after 'ready'.
        Hooks.once('ready', TransferManager._patchSheets);
    }

    static _patchSheets() {
        // CSB exposes sheet classes on CONFIG
        const sheetClasses = [
            CONFIG.Actor.sheetClasses?.character,
            CONFIG.Actor.sheetClasses?._template
        ]
            .flatMap(group => group ? Object.values(group) : [])
            .map(entry => entry?.cls)
            .filter(Boolean);

        const patched = new Set();
        for (const cls of sheetClasses) {
            // Walk the prototype chain to find _onDropItem
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
            console.warn('ld-inventory-move | Could not find any _onDropItem to patch');
        } else {
            console.log(`ld-inventory-move | Patched _onDropItem on ${patched.size} prototype(s)`);
        }
    }

    static _patchProto(proto) {
        const original = proto._onDropItem;
        proto._onDropItem = async function (event, data) {
            const item = await Item.implementation.fromDropData(data);
            if (!item || item.type !== 'equippableItem') {
                return original.call(this, event, data);
            }

            const sourceActor = item.parent;
            const targetActor = this.actor;

            // Same actor — do nothing, no duplicate.
            if (sourceActor?.uuid === targetActor?.uuid) return null;

            // Cross-actor — create on target, delete from source.
            if (sourceActor instanceof Actor && targetActor instanceof Actor
                && !sourceActor.isToken && !targetActor.isToken) {
                const itemData = item.toObject();
                delete itemData._id;
                const [created] = await targetActor.createEmbeddedDocuments('Item', [itemData]);
                if (created) {
                    await sourceActor.deleteEmbeddedDocuments('Item', [item.id]);
                }
                return created ?? null;
            }

            return original.call(this, event, data);
        };
    }
}
