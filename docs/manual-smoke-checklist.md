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

4. **Navigate back**
   - Click the back button
   - Returns to the virtual root screen
   - Back button disappears

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

14. **Sort: Folders first**
    - Click the sort icon (≡) in the folder header
    - Select "Folders first"
    - All folders appear before all links
    - Reopen Edge/Chrome → confirm order is saved

15. **Sort: Links first**
    - Select "Links first"
    - All links appear before all folders
    - Confirm order persists after reload

16. **Sort: Title A–Z**
    - Select "Sort by title A–Z"
    - Items are in alphabetical ascending order
    - Confirm order persists after reload

17. **Sort unavailable during search**
    - Type something in the search box
    - The sort button (≡) should be hidden
    - Clear search → sort button reappears

18. **Sort unavailable on virtual root**
    - Navigate to the virtual root screen (back from Bookmarks Bar)
    - No sort button should appear in the header

19. **Delete link**
    - Open context menu → Delete
    - Confirm deletion
    - Item is removed from the list

20. **Delete folder**
    - Open context menu on a folder → Delete
    - Confirm deletion
    - Folder and all its contents are removed

21. **Persist folder selection across reload**
    - Navigate into a subfolder
    - Close and reopen the side panel
    - The same subfolder should be shown on reopening

22. **Deleted folder fallback**
    - Delete a bookmark folder externally (via browser bookmark manager)
    - Reopen side panel
    - Should show the virtual root screen instead of an error
