# Certification Testing Notes

Collections Reborn is a Manifest V3 browser extension that displays and manages the user's existing browser bookmarks in a side panel.

## How to test

1. Install the extension.
2. Click the extension toolbar icon.
3. The Collections Reborn side panel opens.
4. Browse bookmark folders.
5. Click a folder to open it.
6. Use the back button to return to the parent folder.
7. Use the + button to add the current page.
8. Use the row menu to rename, edit, move, or delete an item.
9. Use the drag handle to reorder items in the current folder.

## Test data

The extension uses the browser's existing bookmarks. If the test browser has no bookmarks, create a few bookmark folders and links before testing.

## Data handling

All bookmark data remains in the browser's built-in bookmarks storage.
The extension does not use an external backend.
The extension does not collect analytics.
The extension does not use remote code.
The extension requests all-sites host access because the browser requires it for `chrome.tabs.captureVisibleTab`, which is used to create local bookmark preview thumbnails. Preview images remain local.
