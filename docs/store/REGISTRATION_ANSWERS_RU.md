# Ответы для регистрации Collections Reborn в Chrome Web Store

Тексты ниже подготовлены для вкладки **«Меры по обеспечению конфиденциальности»**. Английские варианты можно вставлять в поля магазина без изменений.

## Описание единственной цели

```text
Collections Reborn provides a collections-style side panel for browsing, organizing, reordering, editing, importing, and adding browser bookmarks using the browser's built-in bookmarks system.
```

## Обоснования разрешений

### activeTab

```text
Required to access the current tab only after a user action, so the extension can prefill the title and URL when adding the current page as a bookmark and create a local preview thumbnail for that page.
```

### bookmarks

```text
Required to read and display the user's browser bookmarks and to create, rename, edit, move, reorder, import, and delete bookmarks and bookmark folders when the user requests those operations.
```

### favicon

```text
Required to display the browser-provided favicon for each bookmark. Favicons are obtained through the browser's built-in favicon API and are not sent to an extension server.
```

### scripting

```text
Required only for the user-initiated "Import old Edge Collections" feature. After the user opens Bing Saves and signs in manually, the extension injects its packaged reader function into that Bing Saves tab to request and read the user's saved collections. It does not inject scripts during normal browsing and does not load remote code.
```

### sidePanel

```text
Required to display the extension's bookmark-management interface in the browser side panel and to open that panel when the user clicks the extension action.
```

### storage

```text
Required to store extension settings, including the last opened bookmark folder, preview preferences, excluded domains, whether the import prompt was shown, and the time and result of the last import. Local preview thumbnails and their metadata are also stored locally in the browser. The extension does not use an external backend.
```

### tabs

```text
Required to read the active tab title and URL when adding the current page, open bookmark pages for user-requested preview generation, wait for those pages to load, capture their visible content locally, and locate or open the Bing Saves tab during a user-initiated import.
```

### Доступ к хостам (`<all_urls>`)

```text
Required to generate local preview thumbnails for bookmark URLs from different websites. The extension opens a bookmarked page and uses the browser's captureVisibleTab API to capture its visible content. Host access is also used during the user-initiated Edge Collections import on https://www.bing.com/saves. Captures and imported data are processed locally and are not sent to an extension server.
```

## Удаленный код

Выбрать: **«Нет, я не использую удаленный код»**.

Если форма требует текстовое пояснение:

```text
Collections Reborn does not use remote code. All JavaScript executed by the extension is included in the extension package. The extension does not load external scripts or modules and does not evaluate remotely obtained code. The packaged function injected into Bing Saves by chrome.scripting is part of the submitted extension package.
```

## Подробное описание продукта

```text
Collections Reborn gives your browser bookmarks a clean collections-style side panel.

It uses the browser's standard bookmark system as the source of truth, so existing bookmarks remain available through the browser's normal bookmark tools.

Main features:

- Browse bookmarks and folders in a side panel
- Open folders one level at a time
- Reorder bookmarks and folders with drag-and-drop
- Move items with a searchable folder picker
- Rename folders and edit or delete bookmarks
- Add the current page to a selected folder
- Search within the current folder
- Generate and store bookmark preview thumbnails locally
- Optionally import old Edge Collections from Bing Saves after manual sign-in and an explicit user action

Collections Reborn has no external backend, collects no analytics, and does not transmit bookmark data or preview images to an extension server. It is independent and is not affiliated with, endorsed by, or produced by Microsoft, Google, or any browser vendor.
```

## Декларация об использовании данных

Расширение обрабатывает следующие данные только для своих пользовательских функций:

- закладки: названия, URL, структура папок и порядок элементов;
- заголовок и URL активной вкладки при добавлении текущей страницы;
- видимое содержимое открытой страницы при создании локальной миниатюры;
- названия коллекций, названия и URL сохраненных элементов, заметки и связанные метаданные при запущенном пользователем импорте Bing Saves;
- локальные настройки, миниатюры и технический статус импорта.

Консервативный вариант заполнения перечня типов данных, если форма спрашивает не только о передаче, но и о доступе/обработке:

- **История веб-поиска / Web history** — отметить, поскольку обрабатываются URL и заголовки закладок и активной вкладки.
- **Контент веб-сайтов / Website content** — отметить, поскольку создаются снимки видимой части страниц и считываются данные Bing Saves по явной команде пользователя.
- Остальные категории — не отмечать, если новые функции не начали их обрабатывать.

Готовое пояснение:

```text
The extension accesses bookmark titles, URLs, and folder structure to provide bookmark management. It accesses the active tab title and URL when the user adds the current page, captures visible page content for local preview thumbnails, and reads Bing Saves collection data only during a user-initiated import. This data is used only to provide the extension's stated features. It is not sold, used for advertising or credit decisions, or transmitted to an extension backend. Authentication remains managed by the browser and Bing; the extension does not read passwords, cookies, or authentication tokens.
```

## Подтверждения

После проверки фактического поведения опубликованной сборки подтвердить все три пункта:

- данные не продаются и не передаются третьим лицам вне разрешенных случаев;
- данные не используются для целей, не связанных с единственной целью расширения;
- данные не используются для кредитоспособности или выдачи займов.

Также установить обязательный флажок подтверждения соблюдения Правил программы для разработчиков.

## URL

Политика конфиденциальности:

```text
https://dimonsmart.github.io/CollectionsReborn/privacy.html
```

Поддержка:

```text
https://github.com/DimonSmart/CollectionsReborn/issues
```

## Перед отправкой

После заполнения нажать **«Сохранить черновик»**, снова открыть страницу публикации и убедиться, что предупреждения по каждому разрешению исчезли.
