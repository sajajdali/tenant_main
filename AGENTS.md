# Repository Guidelines

## Project Structure & Module Organization

React/Vite booking app plus Laravel tenant/admin backend:

- `client/src/`: React pages, components, hooks, utilities, assets, and `nutrition/` features.
- `server/`, `shared/`: TypeScript server and shared schemas/utilities.
- `laravel-app/`: Laravel code. See `app/Domain`, `app/Http/Controllers`, `app/Services`, `resources/views`, and `tests/{Feature,Unit}`.
- `script/`: build/sync helpers, including tenant asset sync.
- `attached_assets/`, `client/src/assets/`, `public/`: static or generated public files.

## Build, Test, and Development Commands

- `npm run dev:client`: start React/Vite on port `5000`.
- `npm run dev`: start the root TypeScript server in development mode.
- `npm run build`: build the root client/server bundle.
- `npm run build:tenant`: build and sync assets into `laravel-app/public/booking-app`.
- `npm run check`: run TypeScript checking with `tsc`.
- `cd laravel-app && composer dev`: run Laravel server, queue, logs, and Vite.
- `cd laravel-app && php artisan test`: run PHPUnit tests.
- `cd laravel-app && npm run build`: build Laravel-managed frontend assets.

## Coding Style & Naming Conventions

Use strict TypeScript and aliases such as `@/components/...` and `@shared/...`. React components use PascalCase, hooks use `useSomething`, and utilities follow nearby file patterns. Laravel follows PSR-4 under `App\\`; keep controllers thin and business logic in services/domain classes. Use Laravel Pint for PHP formatting.

## Localization & Direction

Localization applies only to tenant-facing surfaces: tenant websites, the booking/customer React app, tenant panels, tenant APIs, and tenant-originated validation, email, SMS, notifications, invoices, and exceptions. React strings live in i18n resources; tenant-facing Laravel strings use `lang/{locale}` and translation helpers.

The central Laravel administration panel (`/admin`, `App\Http\Controllers\Admin`, `resources/views/admin`, and `resources/views/auth/admin-login.blade.php`) is intentionally Persian-only and RTL. Tenant locale must never change it. Do not migrate central-admin copy to English/Arabic/German and do not add new central-admin keys to those locale files. Persian text may remain direct in code that is exclusively owned by the central admin surface.

Swagger/OpenAPI documentation is also intentionally Persian-only and excluded from i18n migration. Do not translate `laravel-app/app/OpenApi`, L5 Swagger configuration/UI, generated specifications, schema descriptions, summaries, examples, or Swagger-only labels. This exception is documentation-only: actual tenant API responses, validation errors, exceptions, and customer-visible payloads must still use tenant localization.

Landing sites created through the central `/admin/landing-sites` builder are Persian-only for now. Exclude their builder UI, persisted page/section/SEO content, public landing domains, landing-specific React pages, auth/contact/order endpoints, and `App\Http\Controllers\Landing`/`App\Services\Landing` code from localization work. Do not add translation fields or locale switching to this subsystem. Normal tenant booking, store, nutrition, and tenant-panel surfaces remain localization targets.

For every new tenant-facing module, page, feature, state, action, validation, notification, email, SMS, API message, exception, label, placeholder, aria-label, title, tooltip, empty/loading/error state, and tenant-admin or customer-facing copy, add the text to all currently registered React message files (`fa`, `en`, `ar`, and `de`) or the matching tenant Laravel `lang/{locale}` files at the same time. Do not add a key only for the active language. Arabic and German may remain non-selectable until translation and QA are complete, but their message keys must still exist when new tenant-facing text is introduced.

New UI must work in RTL and LTR. Prefer logical alignment/spacing (`start/end`, `ms/me`, `ps/pe`, `text-start`) over physical `left/right`, `ml/mr`, `pl/pr`, and hardcoded `text-right`. Keep phone numbers, codes, URLs, and IDs explicitly LTR.

Currency and calendar behavior must come from the central locale metadata/formatters, not inline component or controller logic. English displays prices in USD, Arabic displays prices in Saudi Riyal (SAR, because the registered Arabic country is `SA`), German displays prices in EUR, and Persian keeps the product's Iranian toman/rial convention. English, German, and other non-Persian/non-Arabic locales use the Gregorian calendar; Arabic uses the Hijri lunar calendar; Persian uses the Jalali/Shamsi calendar. Do not change only a currency symbol unless the amount has been converted by an explicit, tested currency conversion path.

Follow `docs/I18N_ARCHITECTURE.md`. Register languages/countries in `client/src/i18n/registry.ts` and `laravel-app/config/localization.php`; load React message files only through `client/src/i18n/messages/index.ts`. Track rollout in `docs/I18N_MIGRATION_CHECKLIST.md` and tick items only after verification.

## Testing Guidelines

Add or update tests for booking rules, authorization, payments, tenant behavior, API responses, or date/time logic. Put workflows in `tests/Feature`; isolated services/models in `tests/Unit`. Run `npm run check` and `php artisan test`.

## Commit & Pull Request Guidelines

Existing history uses short, informal messages; make new commits concise but descriptive, for example `fix booking horizon for staff users`. PRs should include summary, affected areas, tests run, linked task, and UI screenshots when relevant.

## Security & Configuration Tips

Do not commit `.env`, tenant credentials, API keys, payment secrets, or generated build artifacts unless required. For tenant-aware or localized changes, verify central and tenant behavior separately.
