# Changelog

All notable changes to **RNK CSB Item Transfer** will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-22

### Added
- Initial release.
- `TransferManager` — three-hook chain (`dropActorSheetData`, `preCreateItem`, `createItem`) that intercepts CSB drag-and-drop between actor inventories and deletes the source item after the copy is created on the target actor.
- Full recursive cleanup of nested CSB sub-items on the source actor.
- Permission guard — warns and aborts the delete if the current user cannot delete the source item.
- Same-actor, sidebar, and compendium drops pass through untouched.
- English localization (`lang/en.json`).
- Proprietary RNK Enterprises license.
- README with install URL, behavior table, and Patreon link.
