# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Angular 20 SPA for cataloguing UPB's art collection ("Inventario Patrimonio Artístico UPB"). Supabase is the entire backend: Postgres, Auth and Storage — there is no custom API layer, services talk to `supabase-js` directly. Deployed as a static site on Netlify.

Domain language is Spanish: routes, DB columns, UI copy, comments, commit messages. Keep new code in Spanish for user-facing strings, comments and data model names.

## Commands

```bash
npm start                  # ng serve -> http://localhost:4200
npm run build              # production build -> dist/front/browser
npm test                   # Karma + Jasmine in Chrome
npm run env                # regenerate src/environments/* from .env
ng test --include='**/artwork-list.spec.ts'   # single spec file
```

`prestart` / `prebuild` / `pretest` run `scripts/generate-env.js` automatically — credentials can't silently go missing. There is no linter configured.

## Environment

`src/environments/environment.ts` and `environment.development.ts` are **generated and gitignored**. `scripts/generate-env.js` reads `SUPABASE_URL` and `SUPABASE_KEY` from real env vars first, then `.env` (see `.env.example`). It **exits 1** if either is missing, and refuses a `service_role` key outright — that key must never reach a browser bundle.

`angular.json` swaps `environment.ts` → `environment.development.ts` for the development configuration.

## Security model — read this before touching data access

Authorization is **100% Postgres RLS + column grants**. Angular guards and `@if (isAdmin())` are UX only: anyone can call PostgREST directly with the anon key. Never treat a client-side check as enforcement.

- **Restricted columns.** `ubicacion`, `valor`, `bloque_asignado` and `responsable_id` are granted on `obras` to *neither* `anon` nor `authenticated` — column grants are per-role, and an admin is also `authenticated`, so a grant cannot tell them apart. Only the `obras_admin` view serves them: it runs as its owner (`security_invoker = off`), carries the `rol = 'admin'` check inside, and joins `responsables` to expose `responsable` (the name) and `cargo`. **Reads go through `tablaLectura()`, writes always go to `obras`.** A write that returns the row must select explicit columns (`.select('id')`), because returning `*` would need SELECT on the restricted ones. Filters over those columns are admin-only too, since filtering a hidden column leaks it by trial and error. `descripcion` is public.
- **Sign-in is Microsoft Entra only** (`provider: 'azure'`, single tenant — the UPB directory decides who exists). Password sign-in is retired, not deleted: the form is behind `accesoPorContrasena` in `auth-log-in.component.ts` and the two password routes are commented out in `auth.routes.ts`. Signing in grants nothing by itself — the role lives in `usuarios.rol` and an admin sets it; a new account lands on `'usuario'`, which sees what an anonymous visitor sees.
- **Provisioning:** create the user in Authentication → Users with the institutional address copied *exactly* from the directory, then they sign in with Microsoft and Supabase links the identity by email. A one-character mismatch makes Supabase try to sign them up instead, which fails with `signup_disabled`. The `handle_new_user()` trigger only fires on insert, so fix `usuarios.nombre` by hand for pre-created accounts.
- **Public signup is closed** on purpose, and so is password sign-in. Both must also be off in Supabase → Authentication → Sign In / Providers — removing a route or hiding a form is not enough.
- **`.or()` takes a raw PostgREST filter string** with no escaping. Any user value interpolated into it must go through `quoteFilterValue()`. `.ilike()` values are separate params and are safe from structural injection.
- **Password change requires a genuine recovery link** (`AuthService.isRecoveryFlow()`), not merely an open session.
- **What Postgres enforces.** RLS is enabled on `obras`, `imagenes`, `usuarios`, `responsables`, `sincronizacion_hoja` and `sincronizacion_estado`; every write policy requires `usuarios.rol = 'admin'`, so a plain signed-in user cannot write. `responsables` and both `sincronizacion_*` tables are admin-only for reads too, and `anon` has nothing on them. `obras.titulo` is nullable: the official sheet has untitled rows, and the UI shows «Sin título». Neither `anon` nor `authenticated` holds a table-level `SELECT` on `obras` — both get a column list that excludes the restricted three. `anon` has nothing at all on `usuarios`; `authenticated` has `SELECT` there and nothing else, and only for its own row. The `imagenes-obras` bucket is world-readable but admin-only for INSERT/UPDATE/DELETE, and is capped at 5 MB and `image/jpeg|png|webp` — the checks in `image.service.ts` are a nicety, the bucket config is the limit.
- **Schema changes are made in the Supabase dashboard**, not from a migrations folder — this repo holds no SQL. When you change a policy or a grant, update this section in the same commit.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the folder map and the reasoning. Two things matter most when writing code here:

**One owner per concern.** Session validity → `InactivityService`. Client lifecycle → `SupabaseService`. Request retries → `ArtworksService`. Presentation → components. Three competing tab-wake recovery systems used to cancel each other's requests; don't add ad-hoc recovery to a component.

**The Supabase client is swapped at runtime.** `reinitializeClient()` creates a *new* instance, so a field captured once goes stale. Every DB operation must first call:

```ts
await this.prepareClient();   // ensureActiveSession() + re-read the client
```

`ensureActiveSession()` returns `true` when there is no session — anonymous reads are supported by design.

## Conventions

- Component is `name.component.ts`, its template is `name.html` (no `.component` in the template filename).
- Standalone components, `inject()`, signals, and `ChangeDetectionStrategy.OnPush` **everywhere**. Because of OnPush, mutable state must live in signals — a plain field mutated after an `await` will not re-render.
- `@if` / `@for` with an explicit stable `track` (prefer `track x.id`, not object identity).
- Tailwind utilities in templates only; no per-component stylesheets. `getGridClasses()` builds class names at runtime, so those variants live in `safelist` in `tailwind.config.js`.
- Heavy dependencies go behind `await import()` (`exceljs` + `file-saver` are a ~1.5 MB lazy chunk). All routes use `loadComponent`.
- Supabase tables: `obras`, `imagenes`, `usuarios`. Storage bucket: `imagenes-obras`. The FK column is `id_obra`.

## Testing

The 6 remaining spec files are unmodified CLI scaffolds that instantiate real components with no Supabase mock — effectively zero coverage. Treat `npm test` as unverified.
