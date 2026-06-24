# Changelog

All notable changes to **RNK Inventory Move** will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-06-24

### Changed

- Renamed module from LD Inventory Move to RNK Inventory Move (`ld-inventory-move` → `rnk-inventory-move`).
- Updated all branding, manifest, download, and GitHub URLs to RNK Enterprise.
- Localization namespace changed from `LDIM` to `RNKIM`.

### Fixed

- Item drops from item displayers (item sheet) into actor inventories now correctly create a copy on the target actor instead of falling back to CSB's no-op handler.
- Source items are only deleted when they are owned by an actor; drops from world item displayers produce a copy and leave the world item intact.

---

## [1.0.5] - 2026-06-06

### Fixed

- Same-actor drops no longer create duplicates. Previously dragging an item within the same actor's inventory sheet would create a copy without removing the original.
- Completely rewrote the transfer approach — instead of hooking `preCreateItem`/`createItem` (which CSB bypasses internally using `keepId: true`), the module now patches CSB's `_onDropItem` directly on both sheet prototypes at `ready`. This intercepts the drop before CSB can act on it.
- Cross-actor moves are now handled entirely by the module (create on target, delete from source) rather than relying on CSB's own create path, eliminating the duplicate window entirely.
- Token (synthetic) actor drops are correctly ignored.

---

## [1.0.2] - 2026-06-06

### Fixed

- Source items are now removed in two stages: the root item is deleted immediately after the target copy is created, and descendant cleanup runs shortly after. This reduces the visible duplicate window while keeping nested item cleanup intact.

---

## [1.0.1] - 2026-05-26

### Fixed

- `_onPreCreateItem` was reading `options.parent` for the target actor instead of `item.parent`, causing the hook to exit immediately on every drop.
- `item.id` can be null during the pre-creation phase; the handler now falls back to `data._id` (preserved by CSB's `keepId: true`) and guards against a missing ID.
- `setTimeout` delay increased from `0` to `150 ms` to give CSB time to finish creating all sub-items on the target before the source is deleted, preventing orphaned sub-items with broken `system.container` references.

---

## [1.0.0] - 2026-04-22

### Added

- Initial release.
- `TransferManager` - hook chain (`preCreateItem`, `createItem`) that intercepts Custom System Builder drag-and-drop between actor inventories and deletes the source item after the copy is created on the target actor.
- Full recursive cleanup of nested CSB sub-items on the source actor.
- Permission guard - warns and aborts the delete if the current user cannot delete the source item.
- Same-actor, sidebar, and compendium drops pass through untouched.
- English localization (`lang/en.json`).
- README with install URL, behavior table, and GitHub link.
