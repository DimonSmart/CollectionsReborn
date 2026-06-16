import { App } from './components/App.js';
import { BookmarksService } from './services/bookmarksService.js';
import { FaviconService } from './services/faviconService.js';
import { StorageService } from './services/storageService.js';
import { BookmarkOperationsService } from './services/bookmarkOperationsService.js';
import { BrowserTabsService } from './services/browserTabsService.js';
import { PreviewDbService } from './services/previewDbService.js';
import { PreviewSettingsService } from './services/previewSettingsService.js';
import { PreviewCaptureService } from './services/previewCaptureService.js';

async function boot(): Promise<void> {
  const container = document.getElementById('app');
  if (!container) return;

  const bookmarksService = new BookmarksService();
  const faviconService = new FaviconService();
  const storageService = new StorageService();
  const operationsService = new BookmarkOperationsService(bookmarksService);
  const tabsService = new BrowserTabsService();
  const previewDb = new PreviewDbService();
  const previewSettings = new PreviewSettingsService();
  const previewCapture = new PreviewCaptureService(previewDb, previewSettings);

  const app = new App(
    container,
    bookmarksService,
    faviconService,
    storageService,
    operationsService,
    tabsService,
    previewDb,
    previewSettings,
    previewCapture,
  );

  try {
    await app.init();
  } catch (err) {
    console.error('Collections Reborn failed to initialize:', err);
    container.innerHTML = `
      <div class="panel">
        <div class="error-state">
          <p>Could not load bookmarks.</p>
          <button onclick="location.reload()" class="btn btn--secondary">Retry</button>
        </div>
      </div>
    `;
  }
}

boot();
