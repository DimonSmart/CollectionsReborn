# Store Listing

## Extension name

Collections Reborn

## Short description

A collections-style side panel for organizing browser bookmarks.

## Full description

Collections Reborn gives your browser bookmarks a clean collections-style side panel.

It does not replace the browser bookmark system. Instead, it uses your existing bookmarks and displays them in a more focused, visual, and convenient layout.

Main features:

- Browse bookmarks and folders in a side panel
- Open folders one level at a time without expanding a full tree
- Reorder bookmarks and folders with mouse drag-and-drop
- Move items to another folder with a folder picker
- Rename folders and edit bookmark links
- Add the current page to the selected folder
- Search inside the current folder
- Use the browser's built-in bookmark storage as the source of truth

Collections Reborn stores your bookmarks in the browser's standard bookmark system. It does not use an external backend, does not collect analytics, and does not send your bookmark data to any server.

This extension is independent and is not affiliated with, endorsed by, or produced by Microsoft, Google, or any browser vendor.

## Single purpose

Collections Reborn provides a collections-style side panel for browsing, organizing, reordering, editing, and adding browser bookmarks using the browser's built-in bookmarks system.

## Permission justifications

| Permission | Justification |
|---|---|
| bookmarks | Required to read, display, create, rename, move, reorder, and delete browser bookmarks and bookmark folders when the user performs these actions. |
| sidePanel | Required to display the extension UI in the browser side panel. |
| storage | Required to remember the last opened bookmark folder ID. No bookmark data is stored there. |
| favicon | Required to show site favicons for bookmark links using the browser's built-in favicon API. |
| tabs | Required to read tab metadata and open bookmark links for preview generation. |
| activeTab | Required to work with the currently active tab when the user adds or previews the current page. |
| `<all_urls>` host access | Required by the browser `captureVisibleTab` API to generate local bookmark preview thumbnails. Preview images are stored locally and are not sent to any server. |

## Remote code declaration

No. Collections Reborn does not use remote code. All executable code is included in the extension package.

## Data usage declaration

The extension accesses bookmarks and the active tab title/URL only to provide user-triggered bookmark management features. Bookmark data remains in the browser's built-in bookmark storage. The extension does not collect analytics, does not use an external backend, and does not transmit user data to any server.

## Category

Productivity

## URLs

Privacy policy URL:

```text
https://dimonsmart.github.io/CollectionsReborn/privacy.html
```

Support URL:

```text
https://github.com/DimonSmart/CollectionsReborn/issues
```

Repository URL:

```text
https://github.com/DimonSmart/CollectionsReborn
```

## Search terms

bookmarks
favorites
collections
bookmark manager
side panel
organizer

## Screenshot notes

The drag-and-drop reorder screenshot shows visible drag handles and a row in the selected drag state to demonstrate the reorder affordance.

## Regenerating store assets

Generate the logo and both Chrome promotional images:

```bash
npm run assets:store
```

The promotional files are generated as 24-bit RGB PNG images without an alpha channel:

- `small-promo-440x280.png` — 440x280
- `marquee-1400x560.png` — 1400x560

To refresh screenshots after a UI change, ask Codex:

> Regenerate the store assets and all five screenshots from `sidepanel-demo.html` using the scenarios in `src/demo/storeScreenshots.ts`. Save screenshots as 1280x800 PNG files under `docs/store/assets/screenshots`, regenerate the 440x280 and 1400x560 Chrome promotional images as 24-bit PNG files without alpha, and run `npm run verify:store-assets`.

The five screenshot scenarios and output filenames are:

| Scenario | Output file |
|---|---|
| `main` | `01-main-side-panel.png` |
| `folder` | `02-folder-navigation.png` |
| `reorder` | `03-drag-and-drop-reorder.png` |
| `move` | `04-move-to-folder-dialog.png` |
| `add` | `05-add-current-page.png` |
