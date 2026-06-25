# Manual Smoke Checklist

Run these scenarios after each significant change to verify nothing is broken.

## Setup
- Build with `npm run build`
- Load `dist/` as an unpacked extension in Edge or Chrome
- Open the side panel via the toolbar button

---

## Scenarios

1. **Open side panel**
   - Panel opens without errors
   - Virtual root screen is shown (Bookmarks Bar, Other Bookmarks, etc.)

2. **See root screen**
   - All top-level bookmark folders are listed
   - No back button is visible
   - Search filters only among root-level folders

3. **Enter Bookmarks Bar**
   - Click Bookmarks Bar
   - Contents of the folder are shown
   - Back button appears in the header
   - Breadcrumb shows `All bookmarks / Bookmarks Bar`

4. **Navigate back**
   - Click the back button
   - Returns to the virtual root screen
   - Back button disappears
   - Breadcrumb shows `All bookmarks`

5. **Add current page**
   - Navigate to a regular website (not chrome://)
   - Click the + button
   - "Add to favorites" modal opens with the page title pre-filled
   - Title is editable; folder defaults to current folder
   - Click Add → bookmark is created and appears in the list

6. **Block system pages**
   - Navigate to `edge://settings` or `chrome://extensions`
   - Click the + button
   - An info message is shown: "This page cannot be added to bookmarks"
   - No modal should open

7. **Rename folder**
   - Open context menu on a folder → Rename…
   - Change the name and save
   - New name appears in the list

8. **Edit link**
   - Open context menu on a link → Edit…
   - Change title and/or URL and save
   - Updated entry is shown in the list

9. **Move link to another folder — at the beginning**
   - Open context menu on a link → Move to…
   - Select a target folder; set position to "At the beginning"
   - Click Move
   - Open the target folder: the link appears first

10. **Move link to another folder — at the end**
    - Same as above but select "At the end"
    - Link appears last in the target folder

11. **Move folder — descendant guard**
    - Open context menu on a parent folder → Move to…
    - Verify that the folder itself and its subfolders are greyed out and cannot be selected

12. **Drag to reorder**
    - In a folder with multiple items, drag an item using the grip handle
    - Drop it at a new position
    - Reopen Edge/Chrome → confirm the new order persisted in browser bookmarks

13. **Drag into folder**
    - Drag a link or folder over the middle of another folder card
    - Verify that the card is highlighted and shows "Move into folder"
    - Drop the item and verify that it appears at the end of the destination folder
    - Drag over the top or bottom edge of a folder and verify that regular reordering still works

14. **Breadcrumb navigation and drag targets**
    - Navigate into a nested folder and verify that the full path is shown, for example `All bookmarks / Bookmarks Bar / Work`
    - Click `All bookmarks` and verify that the root folder opens
    - Navigate back into the nested folder, type a search query, click `Bookmarks Bar`, and verify that search is cleared
    - Click the current folder breadcrumb segment and verify that the folder does not visibly reload
    - Drag a bookmark onto an ancestor breadcrumb segment and verify that the segment highlights and the bookmark moves to that folder
    - Drag a folder onto an ancestor breadcrumb segment and verify that the segment highlights and the folder moves to that folder
    - Drag a bookmark or folder over the current folder breadcrumb segment and verify that it does not highlight and does not move
    - Drag a bookmark or folder over `All bookmarks` and verify that it does not highlight and does not move
    - In dark theme, verify that breadcrumb text, hover, focus, and drop highlight are readable
    - Narrow the side panel and verify that the breadcrumb stays on one line without breaking the toolbar

15. **Sort: Folders first**
    - Click the sort icon (≡) in the folder header
    - Select "Folders first"
    - All folders appear before all links
    - Reopen Edge/Chrome → confirm order is saved

16. **Sort: Links first**
    - Select "Links first"
    - All links appear before all folders
    - Confirm order persists after reload

17. **Sort: Title A–Z**
    - Select "Sort by title A–Z"
    - Items are in alphabetical ascending order
    - Confirm order persists after reload

18. **Sort unavailable during search**
    - Type something in the search box
    - The sort button (≡) should be hidden
    - Clear search → sort button reappears

19. **Sort unavailable on virtual root**
    - Navigate to the virtual root screen (back from Bookmarks Bar)
    - No sort button should appear in the header

20. **Delete link**
    - Open context menu → Delete
    - Confirm deletion
    - Item is removed from the list

21. **Delete folder**
    - Open context menu on a folder → Delete
    - Confirm deletion
    - Folder and all its contents are removed

22. **Persist folder selection across reload**
    - Navigate into a subfolder
    - Close and reopen the side panel
    - The same subfolder should be shown on reopening

23. **Deleted folder fallback**
    - Delete a bookmark folder externally (via browser bookmark manager)
    - Reopen side panel
    - Should show the virtual root screen instead of an error
