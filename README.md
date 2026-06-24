# RNK Inventory Move

**A free module for Foundry VTT by RNK Enterprise**

Fixes the default Custom System Builder behavior where dragging an item from one
actor's inventory to another, or into a container item, creates a duplicate
instead of moving it.

---

## What It Does

When you drag an item from Actor A's inventory to Actor B's inventory, or from
an actor inventory into an item container, Foundry and CSB duplicate the item by
default. This module intercepts that operation and deletes the original item
after the copy is created on the target.

All nested sub-items (CSB item containers within items) are moved with their
parent and cleaned up from the source actor automatically.

---

## Requirements

- Foundry VTT v13 - v14
- [Custom System Builder](https://foundryvtt.com/packages/custom-system-builder) (any recent version)

---

## Installation

Paste the manifest URL into Foundry's module installer:

```text
https://github.com/RNK-Enterprise/rnk-inventory-move/releases/latest/download/module.json
```

---

## Behavior Notes

| Scenario | Result |
|---|---|
| Drag item from Actor A -> Actor B | Item moved (deleted from A, created on B) |
| Drag item from Actor A -> Item container | Item moved into the target container |
| Drag item from Item displayer -> Actor | Item copied to actor (world item stays intact) |
| Drag item within the same actor | Unchanged - CSB handles its own sorting |
| Drag item from sidebar / compendium | Unchanged - standard Foundry create behavior |
| No delete permission on source | Warning notification; item is not removed |

---

## Support

- Bug reports and feature requests: [GitHub Issues](https://github.com/RNK-Enterprise/rnk-inventory-move/issues)

---

## License

Proprietary - see [LICENSE](LICENSE) for terms.

Copyright 2026 RNK Enterprise. All rights reserved.
