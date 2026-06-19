# Collections Reborn

A browser extension for Microsoft Edge and Google Chrome that displays your standard browser bookmarks in a clean, navigable side panel.

## Quick Start

### Prerequisites
- Node.js 18+ and npm

### Install & Build

```bash
npm install
npm run build
```

This produces a `dist/` folder — the loadable extension.

### Load as Unpacked Extension

**Microsoft Edge:**
1. Navigate to `edge://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

**Google Chrome:**
1. Navigate to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

### Development (watch mode)

```bash
npm run dev
```

Rebuilds `dist/` on every file change. Reload the extension in the browser after each build.

---

## Architecture

```
collections-reborn/
├── manifest.json           # MV3 manifest (copied to dist/)
├── background.js           # Service worker — opens side panel on click
├── sidepanel.html          # Side panel entry point
├── src/
│   ├── main.ts             # App bootstrap
│   ├── types.ts            # Shared TypeScript types
│   ├── state.ts            # (unused — state managed in App)
│   ├── services/
│   │   ├── bookmarksService.ts   # chrome.bookmarks API wrapper
│   │   ├── faviconService.ts     # Favicon URL + domain helpers
│   │   └── storageService.ts     # chrome.storage.sync (persists last folder)
│   └── components/
│       ├── App.ts                # Main orchestrator — layout, navigation, events
│       ├── FolderView.ts         # Nav header + sortable bookmark list
│       ├── BookmarkRow.ts        # Individual row (folder or link)
│       ├── MoveToDialog.ts       # "Move to…" folder picker dialog
│       ├── ActionsMenu.ts        # Contextual dropdown menu
│       ├── ItemEditor.ts         # Rename / edit link dialogs
│       ├── ConfirmModal.ts       # Delete confirmation dialog
│       └── AddFavoriteModal.ts   # Add current page modal
├── styles/
│   └── sidepanel.css       # All styles (CSS custom properties, light theme)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**Data flow:**
- `chrome.bookmarks` is the single source of truth
- `chrome.storage.sync` stores only the last opened folder ID
- No external backend, no cloud storage, no data leaves the browser
- All ordering and folder moves are written directly to browser bookmarks

---

## Permissions

| Permission   | Purpose |
|-------------|---------|
| `bookmarks` | Read and write browser bookmarks |
| `sidePanel` | Show the side panel UI |
| `storage`   | Persist last opened folder ID |
| `favicon`   | Load site favicons via the browser's built-in favicon API |
| `tabs`      | Read tab metadata and open bookmark links for preview generation |
| `activeTab` | Work with the current tab when adding or previewing the current page |
| `<all_urls>` | Generate local bookmark preview thumbnails with the browser capture API |

Host access is used only for local preview capture. Preview images are stored in the browser and are not uploaded.

---

## Publishing

See:

- `docs/store/STORE_LISTING.md`
- `docs/store/PUBLISHING_CHECKLIST.md`
- `PRIVACY.md`

To create a production package:

```bash
npm run package
```

The package is generated in `release/`.

## Public Pages

Privacy Policy:

https://dimonsmart.github.io/CollectionsReborn/privacy.html

Support:

https://github.com/DimonSmart/CollectionsReborn/issues

## Release package

Run locally:

```bash
npm run package
```

CI also builds the release zip and uploads it as a workflow artifact.

To create a GitHub Release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow creates a GitHub Release and attaches the extension zip from `release/`.

---

## Features

### One-level folder navigation
The side panel shows the direct children of the current folder — subfolders and links side by side. Click a folder to open it. Use the ← back button to return to the parent folder. No recursive tree, no expand/collapse.

### Compact layout (only mode)
All items are displayed in a dense list. There are no Compact/Normal/Full view modes.

### Mouse drag-and-drop reorder and folder moves
Folders and links inside the current folder can be reordered by dragging. Grab the `⋮⋮` handle on the left of any row and drag it to a new position. Drop over the highlighted middle of a folder card to move the item into that folder; use the top or bottom edge to place it before or after the folder. Changes are written to browser bookmarks immediately. Drag-and-drop is disabled while a search is active.

### Move to another folder
Open the `⋯` menu on any row and choose **Move to…** to move it to a different folder. A dialog shows the full bookmark tree with search. The current folder is marked and disabled as a target. Moving a folder disables itself and all its descendants as targets (to prevent cycles).

### Folder and link actions
- **Folders**: Open, Rename, Move to…, Delete
- **Links**: Open, Edit…, Move to…, Delete

### Add current page
Press the **+** button to add the active tab as a bookmark. A modal lets you choose the title and destination folder, defaulting to the current folder.

### Search in current folder
The search box filters the current folder's children by title, URL, or domain. Drag handles are hidden while searching.

---

## Not in MVP

Cloud sync, tags, notes, screenshots, virtual collections, drag into invisible folders, keyboard reorder shortcuts, Firefox/Safari support.

---

## Disclaimer

Collections Reborn is an independent browser extension. It is not affiliated with, endorsed by, or produced by Microsoft, Google, or any browser vendor.
