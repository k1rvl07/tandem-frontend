# Tandem Frontend

Vue-приложение коллаборативного таск-трекера Tandem. SPA на Vue 3
(Composition API), сборка через Vite.

## Стек

- Vue 3, Vue Router 4, Pinia;
- Vite, TypeScript, vue-tsc;
- axios — HTTP-клиент;
- Tailwind CSS 3 (тёмная тема через `darkMode: 'class'`);
- Biome 2.5 — форматирование и линт;
- Vitest 3 + jsdom — unit- и интеграционные тесты;
- Playwright (@playwright/test) + Chromium — E2E-тесты;
- @vueuse/core, lucide-vue-next, vue-draggable-plus, zod.

## Требования

- Node.js 20+ и npm;
- backend на `http://localhost:8080` (см. `tandem-backend/README.md`);
- для E2E — браузеры Playwright: `npx playwright install chromium`.

## Быстрый старт

```sh
npm install
npm run dev        # Vite dev server на :5173
```

Vite proxy: `/api` → `http://localhost:8080`, `/ws` → `ws://localhost:8080`.
API-клиент по умолчанию ходит на same-origin (`/api/v1`, `/ws`); переменные
`VITE_API_BASE_URL` и `VITE_WS_URL` задекларированы (см.
`src/shared/types/env.d.ts`) и предназначены для альтернативных настроек.

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер (Vite) |
| `npm run build` | Проверка типов (`vue-tsc --noEmit`) и сборка Vite |
| `npm run preview` | Превью продакшен-сборки |
| `npm run format` | Форматирование (biome check --write) |
| `npm run format:check` | Проверка форматирования |
| `npm run lint` | Линт (biome lint) |
| `npm run test:run` | Unit/интеграционные тесты (Vitest + jsdom) |
| `npm run test:coverage` | То же с отчётом покрытия (V8) |
| `npm run test:e2e` | E2E-тесты (Playwright, Chromium) |
| `npm run test:e2e:ui` | E2E с UI-режимом Playwright (--ui) |

## Структура `src/`

- `api/` — HTTP-клиент (`http.ts`), WebSocket (`ws.ts`), файлы (`files.ts`:
  presigned URL + TTL-кеш);
- `features/` — самодостаточные фичи: auth, profile, workspaces, boards
  (канбан), home (дерево и избранное), admin;
- `shared/` — переиспользуемое:
  - `types/` — доменные типы;
  - `composables/` — `useTheme` (тема и акцент);
  - `directives/` — `v-autosize`;
  - `ui/` — ProfileMenu, ErrorBanner, SignedImage, TagSelect, TagCheck;
  - `utils/` — extractError, collectErrors;
- `router/` — маршруты (`/`, `/login`, `/profile`, `/admin`,
  `/workspaces/:id`, `/invite/:token`);
- `styles/index.css` — Tailwind и CSS-переменные акцента;
- `test/` — тестовое окружение: `setup.ts` (localStorage-полифилл для jsdom,
  стабы URL blob), `tokens.ts` (`makeToken` для seed'а JWT-сессий).

Алиас `@` → `src/`.

## Тесты

Три уровня покрытия:

- **unit** — утилиты и сторы: `src/shared/utils/*.test.ts`, `src/api/*.test.ts`,
  `src/stores/auth.test.ts`;
- **интеграционные** — компоненты и роутер с реальным Pinia/Router и мокнутым
  API: `src/App.test.ts`, `src/router/index.test.ts`,
  `src/features/**/*.test.ts` (jsdom, мосты на axios/WS/API);
- **E2E (Playwright)** — `tests/e2e/`: `playwright.config.ts` (webServer:
  Vite :5173 + backend :8080 с `reuseExistingServer`), `global-setup.ts`
  (healthz → admin-login → storageState `.auth/admin.json`), `helpers/api.ts`
  + `fixtures.ts` (создание и очистка тестовых воркспейсов `e2e-<runid>`),
  спеки: auth (вход/выход, неверные креды), workspace (создание воркспейса,
  доски и задачи), profile (смена display_name), admin (поиск по login).

E2E требуют запущенных dev-серверов (backend :8080 и Vite :5173) и установленного
Chromium Playwright.

## Хранилище в браузере

- `tandem_token`, `tandem_user` — JWT и данные пользователя;
- `tandem_theme` — светлая/тёмная тема;
- `tandem_accent` — пресет акцентного цвета.

## Дизайн-система

- Светлая и тёмная темы: класс `.dark` на `<html>`;
- акцент: семантический синий в CSS-переменных `--blue-50..800`,
  8 пресетов (`useTheme.setAccent`); токены Tailwind `blue-*` ссылаются
  на переменные;
- скругления запрещены: `border-radius: 0` для всех элементов,
  утилиты `rounded-*` в интерфейсе не используются.

## Проверки

```sh
npm run format:check   # biome check .
npm run lint           # biome lint .
npm run test:run       # Vitest (13 файлов, 91 тест)
npm run test:coverage  # Vitest с отчётом покрытия
npm run test:e2e       # Playwright (5 спеков)
npm run build          # vue-tsc --noEmit && vite build
```