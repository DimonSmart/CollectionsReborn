# Bing Saves import implementation plan

Status: initial implementation completed on 2026-06-19; unpacked-extension verification in Chrome and Edge remains pending.

This plan implements the Side Panel and content-script architecture recommended in [bing-saves-import.md](./bing-saves-import.md).

## 1. Permission and manifest design

- Add `scripting`.
- Add `https://www.bing.com/*` as an optional host permission where supported by the import flow.
- Do not add `cookies`, `webRequest`, `debugger`, or Microsoft identity permissions.
- Review the existing `<all_urls>` host permission separately. Bing import must not depend on or be used to justify it.
- Keep injected code in the extension package; no remote scripts.

Acceptance checks:

- Bing access is requested only after the user starts import.
- Declining permission leaves the extension otherwise usable.
- Store permission text and privacy disclosures explain the read-only import purpose.

## 2. Raw API adapter and validation

Add a small module boundary, for example:

```text
src/import/bingSaves/bingSavesRawTypes.ts
src/import/bingSaves/bingSavesSchema.ts
src/import/bingSaves/bingSavesMapper.ts
```

Responsibilities:

- Represent the raw PascalCase response separately from application models.
- Validate top-level completeness flags, collection/card arrays, IDs, titles, URLs, and response-size limits.
- Parse `MetaData` and `customdata` with guarded JSON parsing.
- Convert .NET ticks only after range validation.
- Treat unknown fields and card types as forward-compatible data, but skip unsupported records with a reason.
- Return sanitized diagnostics containing counts and reason codes only.

Unit tests should use synthetic fixtures only. Include malformed JSON strings, missing URLs, unknown card types, `edge:`/`#` URLs, duplicate IDs, null notes, and partial responses.

## 3. Bing tab coordinator

Create a coordinator used by an import view embedded in the Side Panel. The Side Panel remains visible while the main tab displays Bing Saves. The coordinator:

1. Opens or focuses `https://www.bing.com/saves`.
2. Records only the tab ID required for the active wizard session.
3. Waits for the user to choose **Next** after manual sign-in.
4. Revalidates HTTPS, hostname `www.bing.com`, and `/saves` path.
5. Requests optional host access and injects the packaged reader.
6. Times out with a user-readable error and supports retry.

Do not automate Microsoft login or inspect login forms.

## 4. Injected reader

The reader performs one operation:

```ts
const response = await fetch('/saves/collection', {
  method: 'GET',
  credentials: 'same-origin',
  cache: 'no-store',
});
```

It then:

- Requires HTTP 200 and JSON content type.
- Enforces a conservative response-size limit before parsing where practical.
- Validates the response envelope.
- Returns data through extension messaging only to the initiating extension context.
- Does not access `document.cookie`, Bing globals, `SID`, local storage, or page auth headers.
- Does not log the response.

If the endpoint returns zero collections, the wizard must not claim success automatically. Show: **No Bing collections were returned. Confirm that this Bing tab is signed in to the expected Microsoft account, then retry.** Also allow **My account has no collections**.

## 5. Completeness and paging

Initial version:

- Use the no-parameter endpoint.
- Continue only when `hasAllCollectionsFetched === true` and every selected collection has `HasAllItemsFetched === true`.
- If any completeness flag is false, stop before bookmark writes and show an unsupported-large-account error with retry guidance.

Follow-up after additional research:

- Page selected collections using `collId`, `type=0`, `collItemLimit`, and `collOffset`.
- Advance offsets by the actual number of returned cards.
- Detect repeated pages/IDs and enforce page/count limits.
- Verify final card count against `ItemCount`.
- Add collection-list paging only after `offset`/`limit` semantics are confirmed.

This ordering prevents a plausible but unverified pager from silently dropping data.

## 6. Import preview model

Map the validated response to a staging model:

```ts
type EdgeCollectionImportPreview = {
  sourceCollectionId: string;
  title: string;
  items: EdgeCollectionImportItem[];
};

type EdgeCollectionImportItem = {
  sourceItemId: string;
  title: string;
  url: string;
  note?: string;
  modifiedAt?: string;
  sourceType: 'web' | 'image' | 'video' | 'product' | 'unknown';
};
```

Show before writing:

- Number of collections and valid items.
- Counts skipped by reason.
- Destination folder.
- A warning that Bing notes cannot be stored in ordinary browser bookmarks unless note storage is implemented first.

Do not render private item details in logs or telemetry.

## 7. Bookmark transaction

- Create or select an import root such as `Imported Edge Collections`.
- Create one child folder per selected Bing collection.
- Create bookmarks sequentially or with bounded concurrency.
- Keep an import journal mapping source IDs to created bookmark IDs for retry and rollback UI.
- Store only IDs and operation status in the journal, not the raw response.
- On failure, report completed/failed counts and allow retry without duplicating successful records.
- Use source item ID within source collection as the idempotency key.

Decide explicitly whether rollback is supported. If it is, delete only bookmark nodes created by the current import journal; never delete pre-existing user bookmarks.

## 8. Settings and first-run UX

Extend settings with separately named state:

```ts
type EdgeCollectionsImportSettings = {
  edgeCollectionsImportPromptShown?: boolean;
  lastEdgeCollectionsImportAt?: string;
  lastEdgeCollectionsImportResult?: 'success' | 'partial' | 'failed';
};
```

- Set `edgeCollectionsImportPromptShown = true` on both accept and decline.
- Do not overload the prompt flag as import completion state.
- Add **Import old Edge Collections…** to the Side Panel folder menu regardless of first-run choice.
- Keep failure/retry details local and sanitized.

## 9. Security and privacy review

Before release:

- Update `PRIVACY.md` and store privacy text to disclose user-initiated reading of Bing Saves data for local bookmark import.
- Confirm no Microsoft data is transmitted to extension servers or analytics.
- Search built artifacts for raw fixture URLs, account IDs, tokens, and cookies.
- Verify no console logging of API payloads in development or production.
- Verify all imported text is rendered without HTML injection.
- Verify only `http:`/`https:` URLs reach `chrome.bookmarks.create`.
- Document the undocumented-API limitation in user-facing help.

## 10. Test plan

Automated:

- Raw schema and nested metadata parser tests.
- URL/title fallback tests.
- .NET tick conversion tests.
- Unsupported-scheme and malformed-data tests.
- Completeness-flag refusal tests.
- Idempotent retry and partial-failure tests.
- Storage migration tests for the new prompt flag.

Manual in Chrome and Edge:

- Logged out, then manual login and successful import.
- Permission accept and deny.
- Empty account/empty response handling.
- Import all four observed item labels.
- Note present and note absent.
- Unsupported URL schemes.
- Retry after tab close, navigation away, and session expiry.
- Verify cookies/tokens never appear in extension storage, logs, DevTools messages, or exported diagnostics.
- Verify resulting bookmark hierarchy and counts against the import preview.

## 11. Release gate

Do not enable the feature by default until all are true:

- An unpacked extension confirms the content-script request in current Chrome and Edge stable.
- Complete-account and partial-response behavior is understood.
- The privacy/store disclosures are updated.
- Synthetic tests and manual count reconciliation pass.
- No credential or private-response material exists in the repository or package.
