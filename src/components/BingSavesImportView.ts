import { collectAllFolders, findNodeById } from '../domain/bookmarkTree.js';
import { getBookmarkCapabilities } from '../domain/bookmarkCapabilities.js';
import { BingSavesReaderService } from '../import/bingSaves/bingSavesReaderService.js';
import { parseBingSavesResponse, type BingImportPreview } from '../import/bingSaves/bingSavesParser.js';
import { importBingSavesPreview, type BingImportResult } from '../import/bingSaves/bingSavesImporter.js';
import type { BookmarksService } from '../services/bookmarksService.js';
import type { StorageService } from '../services/storageService.js';

type WizardStep = 1 | 2 | 3;
const BING_READ_TIMEOUT_MS = 10_000;

export class BingSavesImportView {
  private readonly reader = new BingSavesReaderService();
  private tree: chrome.bookmarks.BookmarkTreeNode[] = [];
  private destinationFolderId = '';
  private preview: BingImportPreview | undefined;
  private result: BingImportResult | undefined;
  private step: WizardStep = 1;
  private error = '';
  private busy = false;
  private doNotOfferAgain = false;
  private closed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly initialFolderId: string,
    private readonly bookmarks: BookmarksService,
    private readonly storage: StorageService,
    private readonly onClose: () => void,
  ) {}

  async init(): Promise<void> {
    const [tree, settings] = await Promise.all([
      this.bookmarks.getTree(),
      this.storage.loadSettings(),
    ]);
    this.tree = tree;
    this.destinationFolderId = this.resolveDestination(this.initialFolderId);
    this.doNotOfferAgain = settings.edgeCollectionsImportPromptShown === true;
    this.render();
  }

  private render(): void {
    if (this.closed) return;
    const cancelDisabled = this.busy && this.step === 2;
    this.root.innerHTML = `
      <header class="bing-import__header">
        <button class="btn-icon bing-import__back" data-action="cancel" aria-label="Cancel import" title="Cancel import" ${cancelDisabled ? 'disabled' : ''}>
          ${backIcon()}
        </button>
        <div>
          <h1>Import old Edge Collections</h1>
          <p>Step ${this.step} of 3</p>
        </div>
      </header>

      <div class="bing-import__progress" aria-label="Import progress">
        ${progressStep(1, 'Bing Saves', this.step)}
        ${progressStep(2, 'Preview', this.step)}
        ${progressStep(3, 'Complete', this.step)}
      </div>

      <main class="bing-import">
        ${this.renderStep()}
        ${this.error ? `<div class="bing-import__message bing-import__message--error" role="alert">${escapeHtml(this.error)}</div>` : ''}
      </main>

      <footer class="bing-import__footer">
        ${this.step === 3 ? `
          <label class="bing-import__never-offer">
            <input type="checkbox" data-never-offer ${this.doNotOfferAgain ? 'checked' : ''} />
            <span>Don’t offer this import again</span>
          </label>
        ` : ''}
        <div class="bing-import__footer-actions">
          <button class="btn btn--secondary" data-action="cancel" ${cancelDisabled ? 'disabled' : ''}>Cancel</button>
          ${this.renderPrimaryAction()}
        </div>
      </footer>
    `;
    this.attachEvents();
  }

  private renderStep(): string {
    switch (this.step) {
      case 1:
        return `
          <section class="bing-import__step">
            <h2>Open Bing Saves and sign in</h2>
            <p>Open Bing Saves in the main tab. If Microsoft asks you to sign in, complete the sign-in there manually. Keep this Side Panel open.</p>
            <button class="btn btn--secondary bing-import__open" data-action="open-bing">Open Bing Saves</button>
            <p class="bing-import__privacy">Collections Reborn never reads or stores your Microsoft password, authentication tokens, or cookies.</p>
          </section>
        `;
      case 2:
        return this.renderPreviewStep();
      case 3:
        return `
          <section class="bing-import__step bing-import__complete">
            <div class="bing-import__complete-icon" aria-hidden="true">✓</div>
            <h2>Import complete</h2>
            <p>Imported ${this.result?.createdCollections ?? 0} collections and ${this.result?.createdItems ?? 0} links.</p>
          </section>
        `;
    }
  }

  private renderPreviewStep(): string {
    if (!this.preview) return '';
    const folders = collectAllFolders(this.tree).filter((folder) => folder.canCreateChildren);
    const destination = findNodeById(this.tree, this.destinationFolderId);
    return `
      <section class="bing-import__step">
        <h2>Review what will be imported</h2>
        <p>This is only a preview. No bookmarks have been created yet. Make sure these are your collections and choose the folder where you want to import them.</p>

        <div class="bing-import__stats">
          <div><span>Collections</span><strong>${this.preview.collections.length}</strong></div>
          <div><span>Links</span><strong>${this.preview.importableItemCount}</strong></div>
        </div>

        <label class="bing-import__destination">
          <span>Import into</span>
          <select data-destination ${this.busy ? 'disabled' : ''}>
            ${folders.map((folder) => `<option value="${escapeAttribute(folder.id)}" ${folder.id === this.destinationFolderId ? 'selected' : ''}>${escapeHtml(folder.path)}</option>`).join('')}
          </select>
        </label>
        ${destination ? `<p class="bing-import__destination-hint">Collections will be created inside “${escapeHtml(destination.title)}”.</p>` : ''}

        <div class="bing-import__collections">
          ${this.preview.collections.map((collection) => `
            <div><span>${escapeHtml(collection.title)}</span><strong>${collection.items.length}</strong></div>
          `).join('')}
        </div>
      </section>
    `;
  }

  private renderPrimaryAction(): string {
    if (this.step === 1) {
      return `<button class="btn btn--primary" data-action="next" ${this.busy ? 'disabled' : ''}>${this.busy ? 'Checking…' : 'Next'}</button>`;
    }
    if (this.step === 2) {
      return `<button class="btn btn--primary" data-action="import" ${this.busy ? 'disabled' : ''}>${this.busy ? 'Importing…' : 'Import'}</button>`;
    }
    return '<button class="btn btn--primary" data-action="done">Done</button>';
  }

  private attachEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-action="cancel"]').forEach((button) => {
      button.addEventListener('click', () => void this.cancel());
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="open-bing"]')?.addEventListener('click', () => {
      void this.openBing();
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="next"]')?.addEventListener('click', () => {
      void this.loadPreview();
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="import"]')?.addEventListener('click', () => {
      void this.importCollections();
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="done"]')?.addEventListener('click', () => {
      void this.finish();
    });
    this.root.querySelector<HTMLInputElement>('[data-never-offer]')?.addEventListener('change', (event) => {
      this.doNotOfferAgain = (event.currentTarget as HTMLInputElement).checked;
    });
    this.root.querySelector<HTMLSelectElement>('[data-destination]')?.addEventListener('change', (event) => {
      this.destinationFolderId = (event.currentTarget as HTMLSelectElement).value;
      this.render();
    });
  }

  private async openBing(): Promise<void> {
    this.error = '';
    try {
      await this.reader.openBingSaves();
    } catch {
      this.error = 'Could not open Bing Saves.';
      this.render();
    }
  }

  private async loadPreview(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.render();
    try {
      const raw = await withTimeout(
        this.reader.read(),
        BING_READ_TIMEOUT_MS,
        'Could not read Bing Saves. Open Bing Saves, sign in, and try Next again.',
      );
      if (this.closed) return;
      const preview = parseBingSavesResponse(raw);
      if (preview.collections.length === 0) {
        throw new Error('No collections were found. Confirm that Bing Saves is open and signed in to the expected Microsoft account.');
      }
      this.preview = preview;
      this.step = 2;
    } catch (error) {
      if (this.closed) return;
      this.error = errorMessage(error);
    } finally {
      this.busy = false;
      if (!this.closed) this.render();
    }
  }

  private async importCollections(): Promise<void> {
    if (!this.preview) return;
    const destination = findNodeById(this.tree, this.destinationFolderId);
    if (!destination || !getBookmarkCapabilities(this.tree, destination).canCreateChildren) {
      this.error = 'Choose a writable bookmark folder.';
      this.render();
      return;
    }

    this.busy = true;
    this.error = '';
    this.render();
    try {
      this.result = await importBingSavesPreview(this.preview, this.destinationFolderId, this.bookmarks);
      await this.storage.saveEdgeCollectionsImportResult('success');
      this.doNotOfferAgain = true;
      this.step = 3;
    } catch {
      await this.storage.saveEdgeCollectionsImportResult('failed');
      this.error = 'Import stopped because a bookmark could not be created. Some earlier collections may already exist.';
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async cancel(): Promise<void> {
    this.closed = true;
    if (this.step === 3) {
      await this.storage.setEdgeCollectionsImportPromptShown(this.doNotOfferAgain);
    }
    this.onClose();
  }

  private async finish(): Promise<void> {
    this.closed = true;
    await this.storage.setEdgeCollectionsImportPromptShown(this.doNotOfferAgain);
    this.onClose();
  }

  private resolveDestination(folderId: string): string {
    const current = findNodeById(this.tree, folderId);
    if (current && getBookmarkCapabilities(this.tree, current).canCreateChildren) return current.id;
    return collectAllFolders(this.tree).find((folder) => folder.canCreateChildren)?.id ?? '';
  }
}

function progressStep(step: WizardStep, label: string, current: WizardStep): string {
  const state = step < current ? 'complete' : step === current ? 'active' : 'pending';
  return `<div class="bing-import__progress-step bing-import__progress-step--${state}"><span>${step < current ? '✓' : step}</span><small>${label}</small></div>`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not read Bing Saves.';
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        globalThis.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function backIcon(): string {
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
}
