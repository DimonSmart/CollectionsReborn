# Collections Reborn

A browser extension for Microsoft Edge and Google Chrome that displays your standard browser bookmarks as beautiful collections in a side panel.

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
│   ├── state.ts            # Reactive state (view mode, expanded folders, search)
│   ├── types.ts            # Shared TypeScript types
│   ├── services/
│   │   ├── bookmarksService.ts   # chrome.bookmarks API wrapper
│   │   ├── faviconService.ts     # Favicon URL + domain helpers
│   │   └── storageService.ts     # chrome.storage.sync (persists UI prefs)
│   └── components/
│       ├── App.ts                # Main orchestrator — layout, render, events
│       ├── CollectionSection.ts  # Folder rendered as a collection block
│       ├── FavoriteItem.ts       # Individual bookmark link
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
- `chrome.storage.sync` stores only UI preferences (view mode, expanded folder list)
- No external backend, no cloud storage, no data leaves the browser

---

## Permissions

| Permission   | Purpose |
|-------------|---------|
| `bookmarks` | Read and write browser bookmarks |
| `sidePanel` | Show the side panel UI |
| `storage`   | Persist UI preferences (view mode, expanded state) |
| `favicon`   | Load site favicons via the browser's built-in favicon API |
| `tabs`      | Get the current active tab URL when adding a page to favorites |

No host permissions (`http://*/*`, `https://*/*`) are requested.

---

## MVP Features

- Side panel opens on extension icon click
- Bookmarks folders displayed as expandable collection sections
- Compact and Normal view modes
- Favicon for every link (with letter fallback)
- Search across titles, URLs, domains and folder names
- Expand / collapse folder inline
- Open links in a new tab
- Add current page to a selected folder
- Rename any bookmark or folder (inline, double-click)
- Delete a bookmark (with confirmation)
- UI preferences persisted across panel sessions

## Not in MVP

Screenshots/previews, drag-and-drop, tags, notes, cloud sync, Firefox/Safari support.
