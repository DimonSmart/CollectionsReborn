# Final Local Test

Run:

```bash
npm ci
npm run package
```

Then test Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select `dist/`.
5. Click the Collections Reborn toolbar icon.
6. Verify that the side panel opens.
7. Test folder navigation.
8. Test adding the current page.
9. Test rename.
10. Test edit bookmark.
11. Test move to folder.
12. Test drag-and-drop reorder.
13. Test delete bookmark.
14. Test delete folder.

Then test Edge:

1. Open `edge://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select `dist/`.
5. Repeat the same scenario.

The store package is generated in:

```text
release/
```

Upload the generated zip, not the repository root and not the `dist/` folder itself.
