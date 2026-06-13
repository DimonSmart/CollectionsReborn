import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputDir = join(root, 'site-dist');
const privacyUrl = 'https://dimonsmart.github.io/CollectionsReborn/privacy.html';
const repositoryUrl = 'https://github.com/DimonSmart/CollectionsReborn';
const supportUrl = 'https://github.com/DimonSmart/CollectionsReborn/issues';

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const privacyMarkdown = await readFile(join(root, 'PRIVACY.md'), 'utf8');

await Promise.all([
  writeFile(
    join(outputDir, 'index.html'),
    renderPage({
      title: 'Collections Reborn',
      description: 'A collections-style side panel for organizing browser bookmarks.',
      body: `
        <section class="hero">
          <h1>Collections Reborn</h1>
          <p>A collections-style side panel for organizing browser bookmarks.</p>
        </section>
        <section aria-labelledby="links-heading">
          <h2 id="links-heading">Links</h2>
          <ul class="link-list">
            <li><a href="${privacyUrl}">Privacy Policy</a></li>
            <li><a href="${repositoryUrl}">GitHub Repository</a></li>
            <li><a href="${supportUrl}">Support / Issues</a></li>
          </ul>
        </section>
      `,
    }),
    'utf8',
  ),
  writeFile(
    join(outputDir, 'privacy.html'),
    renderPage({
      title: 'Privacy Policy - Collections Reborn',
      description: 'Privacy policy for the Collections Reborn browser extension.',
      body: `<article class="document">${markdownToHtml(privacyMarkdown)}</article>`,
    }),
    'utf8',
  ),
  writeFile(join(outputDir, 'styles.css'), styles(), 'utf8'),
]);

console.log('GitHub Pages site built in site-dist/.');

function renderPage({ title, description, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeAttribute(description)}">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <main>
      ${body}
    </main>
  </body>
</html>
`;
}

function markdownToHtml(markdown) {
  const blocks = markdown.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return blocks.map(renderMarkdownBlock).join('\n');
}

function renderMarkdownBlock(block) {
  const lines = block.split('\n');
  const heading = block.match(/^(#{1,2})\s+(.+)$/);
  if (heading) {
    const level = heading[1].length;
    return `<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`;
  }

  return `<p>${renderInlineMarkdown(lines.join(' '))}</p>`;
}

function renderInlineMarkdown(value) {
  return escapeHtml(value).replace(
    /(https:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>',
  );
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('\n', ' ');
}

function styles() {
  return `:root {
  color-scheme: light;
  --background: #f8fafc;
  --surface: #ffffff;
  --text: #172033;
  --muted: #526070;
  --border: #d9e2ef;
  --accent: #2357c6;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--background);
  color: var(--text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.6;
}

main {
  width: min(760px, calc(100% - 32px));
  margin: 0 auto;
  padding: 56px 0;
}

.hero,
.document,
section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 28px;
}

.hero + section {
  margin-top: 20px;
}

h1,
h2 {
  line-height: 1.2;
  margin: 0 0 14px;
}

h1 {
  font-size: clamp(2rem, 6vw, 3rem);
}

h2 {
  font-size: 1.35rem;
  margin-top: 28px;
}

h2:first-child {
  margin-top: 0;
}

p {
  margin: 0 0 16px;
}

p:last-child {
  margin-bottom: 0;
}

a {
  color: var(--accent);
}

.link-list {
  margin: 0;
  padding-left: 1.25rem;
}

.link-list li + li {
  margin-top: 8px;
}

@media (max-width: 520px) {
  main {
    width: min(100% - 20px, 760px);
    padding: 20px 0;
  }

  .hero,
  .document,
  section {
    padding: 20px;
  }
}
`;
}
