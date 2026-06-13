import { App } from './components/App.js';
import { AppState } from './state.js';
import { BookmarksService } from './services/bookmarksService.js';
import { FaviconService } from './services/faviconService.js';
import { StorageService } from './services/storageService.js';

async function boot(): Promise<void> {
  const container = document.getElementById('app');
  if (!container) return;

  const state = new AppState();
  const bookmarksService = new BookmarksService();
  const faviconService = new FaviconService();
  const storageService = new StorageService();

  const app = new App(container, state, bookmarksService, faviconService, storageService);

  try {
    await app.init();
  } catch (err) {
    console.error('Collections Reborn failed to initialize:', err);
    container.innerHTML = `
      <div class="panel">
        <div class="error-state">
          <p>Could not load favorites.</p>
          <button onclick="location.reload()" class="btn btn--secondary">Retry</button>
        </div>
      </div>
    `;
  }
}

boot();
