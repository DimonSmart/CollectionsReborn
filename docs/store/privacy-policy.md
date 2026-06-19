# Privacy Policy for Collections Reborn

Last updated: 2026-06-19

Collections Reborn is a browser extension that provides a collections-style side panel for browser bookmarks.

## Data the extension accesses

Collections Reborn accesses browser bookmarks through the browser bookmarks API. This is necessary to display, create, rename, move, reorder, and delete bookmarks and bookmark folders when the user performs these actions.

When the user chooses to add the current page, the extension reads the active tab title and URL to prefill the bookmark form.

When the user starts the optional "Import old Edge Collections" flow, the extension reads collection titles, saved item titles, URLs, notes, and related metadata directly from the user's authenticated Bing Saves tab. This read happens only after the user opens Bing Saves, signs in manually, and chooses to check collections. The data is used locally to preview and create browser bookmark folders and bookmarks.

The extension does not read or store the user's Microsoft password, authentication tokens, or cookies. Authentication remains managed by the browser and Bing.

The extension stores the last opened bookmark folder ID, local preview settings and data, whether the Edge Collections import prompt was shown, and the time and success/failure status of the last import.

## Data the extension does not collect

Collections Reborn does not collect analytics.
Collections Reborn does not use an external backend.
Collections Reborn does not transmit bookmark data to any server.
Collections Reborn does not sell, share, or transfer user data.
Collections Reborn does not use remote code.

## Data storage

All bookmark data remains in the browser's built-in bookmarks storage. Preview data remains in local browser storage.

Bing Saves response data is processed in memory and is not stored as a raw response. The extension stores only the resulting bookmarks and the import status described above.

## Third parties

Collections Reborn does not send data to third-party services or an extension backend. During a user-initiated Edge Collections import, the authenticated Bing tab requests the user's collection data directly from Bing, a Microsoft service, using the browser-managed Microsoft session.

## Contact

For questions or support, use the GitHub Issues page of the project repository.
