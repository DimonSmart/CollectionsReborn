# Publishing Checklist

## Blocking checks

- [ ] Screenshots are real PNG files, not JPEG files with `.png` extension.
- [ ] All screenshots are 1280x800.
- [ ] Promo images have correct PNG format and dimensions.
- [ ] Logo images have correct PNG format and dimensions.
- [ ] Privacy policy URL is public and opens without authentication.
- [ ] Support URL is public.
- [ ] `npm run verify:store-assets` passes.
- [ ] `npm run package` passes.
- [ ] Release zip does not contain `src/`, `node_modules/`, `docs/`, `scripts/`, tests or source maps.
- [ ] Release zip contains `manifest.json` at root level.
- [ ] Extension loads from `dist/` as unpacked in Chrome.
- [ ] Extension loads from `dist/` as unpacked in Edge.

## Before packaging

- [ ] `npm ci`
- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Load `dist/` as unpacked extension in Chrome
- [ ] Load `dist/` as unpacked extension in Edge
- [ ] Test side panel opening from extension action
- [ ] Test folder navigation
- [ ] Test bookmark open
- [ ] Test add current page
- [ ] Test rename folder
- [ ] Test edit bookmark
- [ ] Test move to another folder
- [ ] Test drag-and-drop reorder
- [ ] Test delete bookmark
- [ ] Test delete folder
- [ ] Verify no host permissions
- [ ] Verify no remote code
- [ ] Verify privacy policy URL is public
- [ ] Verify screenshots are based on the real UI
- [ ] Verify package zip contains files at the root level, not inside an extra folder

## Chrome Web Store

- [ ] Upload package zip
- [ ] Add privacy policy URL
- [ ] Add short description
- [ ] Add full description
- [ ] Add permission justifications
- [ ] Add single purpose
- [ ] Upload 128x128 icon if required separately
- [ ] Upload 440x280 small promotional image
- [ ] Upload screenshots, preferably 5
- [ ] Choose visibility: Unlisted or Public
- [ ] Submit for review with deferred publishing if available

## Microsoft Edge Add-ons

- [ ] Upload package zip
- [ ] Add category
- [ ] Add privacy policy URL
- [ ] Add single purpose
- [ ] Add permission justifications
- [ ] Declare no remote code
- [ ] Add full description
- [ ] Upload extension logo
- [ ] Upload screenshots
- [ ] Upload promotional tiles if available
- [ ] Add certification testing notes
- [ ] Submit for certification

## GitHub Pages

- [ ] Repository Settings -> Pages -> Source is set to GitHub Actions.
- [ ] `Deploy GitHub Pages` workflow passed.
- [ ] Privacy policy URL opens publicly:
      https://dimonsmart.github.io/CollectionsReborn/privacy.html
- [ ] Privacy policy URL is added to `docs/store/PUBLICATION_URLS.md`.
- [ ] Privacy policy URL is added to `docs/store/STORE_LISTING.md`.
- [ ] Support URL opens publicly:
      https://github.com/DimonSmart/CollectionsReborn/issues

## GitHub Actions

- [ ] CI workflow passes on `main`.
- [ ] CI workflow uploads extension package artifact.
- [ ] CI workflow uploads store assets artifact.
- [ ] Pages workflow deploys site successfully.
- [ ] Release workflow creates a release from `v*` tag.
- [ ] Release asset contains the extension zip.
