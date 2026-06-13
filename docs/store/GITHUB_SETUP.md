# GitHub Setup

## 1. Enable GitHub Pages

1. Open the repository:
   https://github.com/DimonSmart/CollectionsReborn

2. Go to:
   Settings -> Pages

3. In "Build and deployment", set:

   Source: GitHub Actions

4. Save if GitHub asks to save.

5. Go to:
   Actions -> Deploy GitHub Pages

6. Run the workflow manually or push to `main`.

7. After successful deployment, check:

   https://dimonsmart.github.io/CollectionsReborn/privacy.html

## 2. Check Actions permissions

1. Go to:
   Settings -> Actions -> General

2. In "Actions permissions", allow GitHub Actions to run.

3. In "Workflow permissions", use one of:

   - Read and write permissions

   or keep read-only globally and rely on explicit workflow permissions:

   ```yaml
   permissions:
     contents: write
     pages: write
     id-token: write
   ```

4. For this repository, the workflows define explicit minimal permissions.

## 3. GitHub Pages environment

1. Go to:
   Settings -> Environments

2. Check that `github-pages` exists after the first Pages deployment.

3. Optional but recommended:
   restrict deployment branches to `main`.

## 4. Verify public URLs

Open these URLs in an incognito/private browser window:

* [https://dimonsmart.github.io/CollectionsReborn/](https://dimonsmart.github.io/CollectionsReborn/)
* [https://dimonsmart.github.io/CollectionsReborn/privacy.html](https://dimonsmart.github.io/CollectionsReborn/privacy.html)
* [https://github.com/DimonSmart/CollectionsReborn/issues](https://github.com/DimonSmart/CollectionsReborn/issues)

They must open without authentication.

## 5. Create release package

To create a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then check:

1. GitHub -> Actions -> Release
2. GitHub -> Releases
3. The release must contain the extension zip asset.

## 6. Store submission

Use:

* privacy policy URL:
  [https://dimonsmart.github.io/CollectionsReborn/privacy.html](https://dimonsmart.github.io/CollectionsReborn/privacy.html)

* support URL:
  [https://github.com/DimonSmart/CollectionsReborn/issues](https://github.com/DimonSmart/CollectionsReborn/issues)

* package zip:
  attached to the GitHub Release or downloaded from the CI artifact
