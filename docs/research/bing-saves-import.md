# Bing Saves / Edge Collections import research

Research date: 2026-06-19

## Summary

Bing Saves currently exposes the collections associated with the signed-in Microsoft account through a same-origin JSON endpoint:

```text
GET https://www.bing.com/saves/collection
```

The endpoint was opened and inspected in a real, manually authenticated browser session. A request without cookies returned HTTP 200 and an empty collection list. The authenticated request returned all 39 collections and 243 items in the test account. No cookie, token, account identifier, raw response, or private title/URL is recorded in this repository.

The response contains enough information to import old Edge Collections: collection IDs and titles; item IDs, titles, URLs, thumbnails, notes, item types, and modified timestamps. The item metadata also identifies Edge-migrated records through an optional `EdgeMigration` object.

Recommended approach: an explicit, user-initiated import view runs inside the extension Side Panel while `https://www.bing.com/saves` is visible in the main browser tab. It waits for manual sign-in and injects a temporary content script into that tab. The content script makes the same-origin read-only request and returns parsed data to the extension. This keeps Microsoft credentials inside the browser's normal cookie handling and avoids copying or storing cookies.

This is an undocumented Bing implementation endpoint. It can change or disappear without notice. Import must therefore be isolated behind a small adapter, schema validation, clear errors, and a manual fallback.

## Method and privacy controls

The investigation used the authenticated Bing Saves page, its rendered state, and its loaded client code. The primary GET endpoint was then repeated by direct navigation in the same authenticated browser session. Only field names, type information, aggregate counts, and redacted examples were retained.

Controls used during research:

- Microsoft login was completed manually by the user.
- No password, cookie, `SID`, auth header, or token was requested, copied, stored, or committed.
- Raw private response data was not written to disk.
- The unauthenticated Node/PowerShell check used no copied cookies.
- Examples below contain synthetic values only.

## Confirmed data loading

### Initial page load

`https://www.bing.com/saves` server-renders a `TrueCollections` object into the page. In the test account it contained the collection list and most items. The page client can subsequently refresh or page the same data through `/saves/collection`.

This means data is not necessarily loaded solely through Fetch/XHR on the first navigation: the initial HTML can already contain it. Import code should not scrape this embedded object because its location and script format are more fragile than the JSON endpoint.

### Primary read endpoint

```http
GET /saves/collection HTTP/1.1
Host: www.bing.com
Cookie: [managed by the browser; never read or persisted by the extension]
```

Confirmed behavior:

- Method: `GET`.
- Authentication: existing Bing/Microsoft session cookies.
- Request body: none.
- Authenticated, no query parameters: HTTP 200 JSON containing all collections and items in the test account.
- Unauthenticated, no query parameters: HTTP 200 JSON with zero collections. Login failure is therefore not represented by 401/403.
- The unauthenticated response did not include `Access-Control-Allow-Origin` or `Access-Control-Allow-Credentials`.
- The browser client optionally adds a per-page Bing request identifier (`PIG`) and configured request headers. Neither was required for the successful authenticated no-parameter read.

Redacted response shape:

```json
{
  "collections": [
    {
      "Id": "redacted-collection-id",
      "TrueId": "redacted-collection-id",
      "Title": "Example Collection",
      "Description": "Example Collection",
      "CollectionType": 0,
      "ItemCount": 1,
      "HasAllItemsFetched": true,
      "ModifiedDateTime": 638937371114419200,
      "Cards": [
        {
          "Id": "/prism/edge/v1/web:redacted-item-id",
          "ContentId": "redacted-item-id",
          "ParentCollectionId": "redacted-collection-id",
          "MainTitle": "Example Site",
          "Label": "web",
          "CardType": 25,
          "ItemType": 9,
          "ClickthroughLink": {
            "Url": "https://example.com",
            "UrlWithFormCode": "https://example.com"
          },
          "ThumbnailUrl": "https://example.invalid/redacted-thumbnail",
          "Note": "Example note",
          "ModifiedDateTime": 638937371114419200,
          "MetaData": "{...redacted JSON string...}"
        }
      ]
    }
  ],
  "hasAllCollectionsFetched": true,
  "actualCollectionCount": 1
}
```

### Query parameters and paging

The loaded Bing client constructs the endpoint using these optional parameters:

| Parameter | Meaning inferred from client code |
| --- | --- |
| `collId` | Comma-separated collection IDs to fetch |
| `offset` | Collection offset |
| `limit` | Collection limit |
| `type` | `0` = collections and items; `1` = items |
| `collItemLimit` | Maximum cards returned for a selected collection |
| `collOffset` | Item offset within a selected collection |
| `collWS` | Internal collection-web-service mode flag |
| `PIG` | Bing per-page request identifier; not required in the successful read test |

The following focused request was confirmed:

```text
GET /saves/collection
  ?collId=redacted-collection-id
  &type=0
  &collItemLimit=1
  &collOffset=0
```

It returned one collection, one card, `HasAllItemsFetched: false`, and `hasAllCollectionsFetched: false`. Incrementing `collOffset` is therefore the apparent item paging mechanism.

The no-parameter request returned every collection and card in the test account, with both completeness flags true. Direct tests of `offset`/`limit` did not reduce the collection list, so collection-list paging semantics remain unconfirmed. Import code should first use the no-parameter request and refuse silent partial imports when either completeness flag is false. A pagination implementation should be added only after it is verified against an account large enough to produce a partial response.

### POST collection API found in the client

The client also defines:

```text
POST /mysaves/collections/get
```

Request characteristics from the loaded client code:

```http
POST /mysaves/collections/get?[Bing persisted parameters] HTTP/1.1
Content-Type: application/json
SID: [sensitive; supplied by Bing page code]
Cookie: [browser managed]

{
  "collectionItemType": "all",
  "targetCollections": [
    { "collectionId": "redacted-collection-id" }
  ],
  "collOffset": 0,
  "maxItemsToFetch": 100,
  "shouldFilterKCT": false,
  "shouldFetchMetadata": true
}
```

The body fields are optional except `collectionItemType`, which defaults to `"all"`. The client sets `withCredentials = true`, `Content-Type: application/json`, an `SID` query/header when available, and any headers from its runtime `favConfig`.

This POST endpoint was confirmed from the authenticated page's loaded production client, but it was not needed for the successful import read and was not replayed. The GET endpoint is safer: it requires no anti-CSRF value, has no mutation ambiguity, and returned the complete model.

Other `/mysaves/collections/*` operations exist for create, rename, add, update, delete, move, copy, reorder, share, and unshare. They are out of scope and must not be used by an importer.

## Data model

The API uses PascalCase and .NET ticks. The following raw types represent fields relevant to import; the production adapter should validate rather than blindly cast them.

```ts
type BingSavesResponse = {
  collections: BingSaveCollection[];
  hasAllCollectionsFetched: boolean;
  actualCollectionCount: number;
};

type BingSaveCollection = {
  Id: string;
  TrueId?: string;
  Title: string;
  Description?: string;
  CollectionTagPath?: string;
  CollectionType: number;
  ItemCount: number;
  Cards?: BingSaveItem[];
  HasAllItemsFetched: boolean;
  ModifiedDateTime?: number;
  CanRename?: boolean;
  IsAdult?: boolean;
  ShareId?: string;
  UseForRecommendations?: boolean;
};

type BingSaveItemLabel = 'web' | 'image' | 'video' | 'product';

type BingSaveItem = {
  Id: string;
  ContentId?: string;
  ParentCollectionId: string;
  CollectionIdentifiers?: Array<{
    Id: string;
    TrueId?: string;
    Title?: string;
  }>;
  MainTitle?: string;
  Label?: BingSaveItemLabel;
  CardType: 22 | 23 | 24 | 25 | number;
  ItemType: number;
  ClickthroughLink?: {
    Url?: string;
    UrlWithFormCode?: string;
  };
  SimplifiedClickthroughLink?: {
    Url?: string;
    UrlWithFormCode?: string;
  };
  ThumbnailUrl?: string;
  ThumbnailId?: string;
  ThumbnailWidth?: number;
  ThumbnailHeight?: number;
  FriendlyDomainName?: string;
  Footnote?: string;
  Note?: string | null;
  ModifiedDateTime?: number;
  MetaData?: string;
};

type BingSaveItemMetadata = {
  id?: string;
  contentId?: string;
  url?: string;
  title?: string;
  itemtype?: BingSaveItemLabel;
  itemtagpath?: string;
  note?: string | null;
  tid?: string;
  turl?: string;
  tw?: number;
  th?: number;
  fdn?: string;
  customdata?: string;
};

type BingSaveCustomData = {
  PageUrl?: string;
  MediaUrl?: string;
  ToolTip?: string;
  Price?: string;
  EdgeMigration?: {
    time?: number;   // Unix milliseconds in observed records
    action?: string;
  };
};
```

Observed card mapping:

| `CardType` | `Label` | ID prefix |
| ---: | --- | --- |
| 22 | `image` | `/prism/edge/v1/image:` |
| 23 | `video` | `/prism/edge/v1/video:` |
| 24 | `product` | `/prism/edge/v1/product:` |
| 25 | `web` | `/prism/edge/v1/web:` |

### Field reliability

Reliable in the inspected response:

- Collection: `Id`, `Title`, `ItemCount`, `HasAllItemsFetched`, `Cards`.
- Item: `Id`, `ParentCollectionId`, `CardType`, `ItemType`, `Label`, `ModifiedDateTime`.
- A destination URL was present for every inspected card, although one value was `#` and one used the `edge:` scheme. Import must accept only `http:` and `https:` bookmark URLs and report skipped values.
- `MainTitle` is the primary display title. `MetaData.title` is a fallback.
- `ClickthroughLink.Url` is the primary URL. `MetaData.url`/`customdata.PageUrl` are fallbacks only when valid.

Optional or unclear:

- `TrueId` usually duplicates `Id`; use `Id` as the collection key.
- `Description` was populated but duplicated display information in the inspected account. Do not map it to item notes.
- `Note` exists but is usually null. `MetaData.note` is a fallback.
- `ThumbnailUrl` is optional and points to Bing-hosted derived images. It should not be downloaded during bookmark import.
- `ShareId`, count-by-type fields, and recommendation flags are not needed.
- `MetaData` and `customdata` are JSON encoded as strings and require guarded, nested parsing.
- `ModifiedDateTime` is a .NET tick count (100 ns since 0001-01-01 UTC), not Unix milliseconds. Convert with `(ticks - 621355968000000000) / 10000` only after validating the range.
- No creation timestamp was found. `EdgeMigration.time` is migration metadata, not necessarily item creation time.

## Deleted and archived records

No deleted/archive flag occurred in the collection or card schemas. In the complete authenticated response, summed `ItemCount` equaled the number of returned cards. Deleted or archived records are therefore either excluded or not distinguishable. The importer must not claim to restore deleted items.

## Repeatability and execution contexts

| Context | Result | Cookies/CORS | Required permissions | Store-review assessment |
| --- | --- | --- | --- | --- |
| Authenticated `bing.com` browser context | Confirmed by direct authenticated navigation to the endpoint | Same-origin browser cookies were used; no CORS issue | None for manual console use | Research-only; asking users to run console code is poor UX and unsafe guidance |
| Script in authenticated page context | Feasible by same-origin `fetch('/saves/collection')` | Default same-origin credentials apply | Injection capability | Acceptable when user initiated and code is packaged with the extension |
| Content script on `https://www.bing.com/saves*` | Recommended; same-origin request should behave as the page request | Page-origin CORS rules; Bing cookies remain browser-managed | `scripting` plus temporary/optional access to `https://www.bing.com/*`, or a declared content script | Best balance if access is requested only during import and privacy disclosure is explicit |
| MV3 service worker/background direct fetch | Technically plausible with host permission and `credentials: 'include'`, but not verified with this extension | Host permission bypasses ordinary extension cross-origin restrictions; cookie/SameSite behavior and Bing anti-abuse changes remain risks | `host_permissions` or `optional_host_permissions` for Bing | Broader and harder to justify; authenticated-data access is less visible to the user |
| Local Node.js without copied cookies | Confirmed HTTP 200 empty result | No account cookies; no CORS because Node is not a browser | None | Useful only as a negative control |
| Local Node.js with copied cookies | Deliberately not tested | Would work only while copied credentials remain valid | Manual credential extraction | Unacceptable product design and contrary to this research's security constraints |

The endpoint response did not advertise permissive CORS headers. A normal web page on another origin cannot read it. A Bing content script avoids that problem because the request is same-origin with the inspected page. An extension service worker needs host permission and still depends on browser cookie policy.

Relevant platform references:

- [Chrome extension cross-origin network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Chrome content scripts and isolated worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome extension permission declarations](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome Web Store user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

## Architecture options

### Option A: direct API request from the service worker

Feasible but not preferred.

Expected requirements:

```json
{
  "optional_host_permissions": ["https://www.bing.com/*"]
}
```

The current manifest already has `<all_urls>`, but Bing import does not justify that broad permission. The implementation should use the narrowest permission independently of any existing preview feature requirements.

Risks:

- Cookie attachment may differ between Chrome/Edge versions or change with SameSite policy.
- A background request is less obviously connected to the visible signed-in Bing page.
- Store reviewers may require a stronger explanation for access to authenticated Microsoft data.
- An empty response cannot distinguish logged-out state from an account with zero collections.

### Option B: temporary content script on Bing Saves

Feasible and recommended.

Flow:

1. Keep the import workflow visible in the Side Panel and open or focus `https://www.bing.com/saves` in the main tab of the same window.
2. Tell the user to sign in manually.
3. On explicit **Next**, request optional Bing host access if needed.
4. Verify the tab URL is exactly HTTPS on `www.bing.com` and the path starts with `/saves`.
5. Inject packaged code with `chrome.scripting.executeScript`.
6. In the content script, confirm the page appears signed in, then call:

   ```ts
   fetch('/saves/collection', {
     method: 'GET',
     credentials: 'same-origin',
     cache: 'no-store',
   });
   ```

7. Validate content type and response schema, map only required fields, and message the parsed result back to the extension.
8. Do not expose the page's global variables, cookies, `_G.SID`, or request headers.

Reading the endpoint is preferable to observing/intercepting network responses. Chrome does not provide a normal content script with arbitrary response-body interception, and adding debugger/webRequest-style powers would be disproportionate.

### Option C: manual fallback

No Bing Saves export command was visible in the inspected page. Do not instruct ordinary users to copy DevTools responses or cookies.

Fallbacks:

- Explain that Microsoft may already have migrated some data to Favorites and offer the existing browser-bookmark path.
- Offer a generic file importer only for a documented, user-created JSON/HTML/CSV format. Do not pretend Bing currently produces one.
- Provide a manual "Open Bing Saves" link so the user can recreate a small collection when automated import fails.
- Keep the parser adapter isolated so support for an official Microsoft export can be added later.

## Recommended import mapping

For each Bing collection, create one browser bookmark folder under a single user-selected/import root such as `Imported Edge Collections`. For each card:

1. Select the first valid `http:`/`https:` URL from `ClickthroughLink.Url`, `SimplifiedClickthroughLink.Url`, `MetaData.url`, and `customdata.PageUrl`.
2. Select a title from `MainTitle`, `MetaData.title`, `customdata.ToolTip`, then the URL hostname.
3. Create a browser bookmark in the collection folder.
4. Preserve the note and source metadata only if the product has a separate metadata store. Browser bookmarks cannot store notes natively; do not silently append notes to titles or URLs.
5. Skip unsupported schemes and malformed URLs, then report them in a summary.
6. Deduplicate by normalized `(collectionId, source item Id)` for retry safety. URL-only deduplication would incorrectly merge deliberate duplicates.

The import should be staged before writes: validate and summarize first, let the user choose the destination, then create folders/bookmarks. On partial failure, retain a local import journal containing only Bing IDs mapped to created bookmark IDs, never raw responses or credentials.

## Proposed first-run UX

1. On first launch, read `edgeCollectionsImportPromptShown`.
2. If absent/false, show **Import old Edge Collections?**
3. Step 1 shows only **Open Bing Saves**, **Next**, and **Cancel**. Next validates that an authenticated Bing Saves tab can be read and does not advance on error.
4. Step 2 explicitly states that it is a preview and no bookmarks have been created. Show collection/link totals, decoded collection names, the destination folder, **Import**, and **Cancel**. Unsupported internal records are silently omitted from the summary.
5. Step 3 confirms the number of imported collections and links, with **Done**, **Cancel**, and the opt-out checkbox.
6. Persist `edgeCollectionsImportPromptShown` from the checkbox when the wizard closes. Default it to checked after a successful import.
7. Always expose **Import old Edge Collections…** in the Side Panel folder menu for retries/manual use.

The prompt flag records the user's opt-out choice. Import status, last result, and retry journal use separate fields.

## Security, privacy, and store policy

- Never request the user's Microsoft password, MFA code, token, or cookies.
- Never use `chrome.cookies` for this feature.
- Never persist or log raw Bing responses.
- Do not include URLs, titles, notes, or IDs in telemetry or error reports.
- Keep the request read-only and user initiated.
- Validate protocol, hostname, content type, response size, and schema before processing.
- Limit accepted URLs to `http:` and `https:` before calling `chrome.bookmarks.create`.
- Treat all titles, notes, metadata, and URLs as untrusted input; render through text APIs, not `innerHTML`.
- Declare authenticated collection data in the privacy policy and store disclosure. State the single purpose: local user-requested bookmark import.
- Request Bing access only at import time if platform support allows it.
- Package all injection code with the extension; do not fetch or execute remote code.

## Risks and limitations

- The endpoint is undocumented and may change without versioning.
- Login failure and a genuinely empty account both produce an empty successful response.
- Very large accounts may return partial results. Collection-list continuation is not yet confirmed.
- Item types beyond web/image/video/product may exist in other accounts.
- Bing-derived thumbnail URLs may expire and should not be treated as durable assets.
- Notes cannot be represented by the browser bookmarks API without a separate extension data model.
- `edge:` URLs, `#`, and other non-web targets cannot be imported as ordinary bookmarks safely.
- Edge/Bing may remove the service or migrate data again.
- The current extension manifest's `<all_urls>` permission is broader than this feature needs and may complicate review; narrowing it is a separate but related hardening task.

## Proposed implementation plan

See [bing-saves-import-plan.md](./bing-saves-import-plan.md).

## Open questions

1. What response and continuation behavior occurs for an account large enough that `hasAllCollectionsFetched` is false?
2. Does `collOffset += Cards.length` reliably page to `HasAllItemsFetched: true`, and is there a server maximum page size?
3. Does the same injected content-script fetch work in both Chrome and Edge stable with their current cookie behavior? This needs an unpacked-extension integration test.
4. How should notes be stored in Collections Reborn, which currently uses native browser bookmarks as its primary model?
5. Should image/video/product saves import their page URL, media URL, or both? The recommended default is the click-through page URL.
6. Can a signed-in account legitimately have zero collections, and what independent, non-sensitive signed-in signal should the wizard use?
7. Does Microsoft expose an official export or supported API that should replace this undocumented endpoint?
