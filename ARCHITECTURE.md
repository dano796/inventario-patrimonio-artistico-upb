# Arquitectura

Aplicación Angular 20 (standalone + signals) sobre Supabase. No hay capa de
API propia: los servicios hablan directamente con `supabase-js`.

> **Consecuencia central:** los guards de Angular y los `@if (isAdmin())` de las
> plantillas son **solo interfaz**. Cualquiera puede abrir la consola del
> navegador y llamar a PostgREST con la anon key. La autorización real vive
> en las políticas RLS y en los permisos por columna de Postgres, que se
> administran desde el panel de Supabase.

## Estructura

```
src/app/
├── core/                      # Singletons: una sola instancia en toda la app
│   ├── guards/
│   │   ├── auth.guard.ts      # privateGuard / publicGuard
│   │   └── admin.guard.ts
│   └── services/
│       ├── auth.service.ts        # sesión, perfil, rol, flujo de recuperación
│       ├── supabase.service.ts    # dueño del cliente Supabase
│       ├── tema.service.ts        # tema claro/oscuro en <html data-theme>
│       └── inactivity.service.ts  # único responsable del despertar de pestaña
│
├── features/
│   ├── artworks/
│   │   ├── components/        # artwork-list · artwork-detail · artwork-form · selector-responsable
│   │   │   └── galeria/       # barra-filtros · tarjeta-obra · tabla-obras · paginacion (solo presentan)
│   │   ├── utils/             # galeria (chips, vista) · ficha (campos por rol) · buscar-responsables
│   │   ├── services/
│   │   │   ├── artworks.service.ts        # estado + CRUD + paginación
│   │   │   └── artwork-export.service.ts  # generación del .xlsx
│   │   └── artwork.routes.ts  # rutas con loadComponent (carga diferida)
│   ├── auth/
│   │   ├── components/        # auth-log-in · forgot-password · update-password
│   │   └── auth.routes.ts
│   ├── sincronizacion/
│   │   ├── nucleo/            # TS puro, compartido con scripts/importar-hoja.ts
│   │   ├── services/          # graph.service (Microsoft Graph, token delegado)
│   │   ├── components/        # vincular-hoja
│   │   └── sincronizacion.routes.ts
│   └── tablero/               # estado del inventario (solo administradores, lee obras_admin)
│       ├── tablero.ts         # calcularTablero: función pura
│       ├── tablero.service.ts
│       └── components/        # tablero
│
└── shared/
    ├── components/            # cabecera · confirm-modal · image-uploader
    ├── models/                # artwork.model · image.model · user.model
    ├── constants/
    ├── services/              # image.service (Storage)
    └── utils/                 # validation.service · almacen (localStorage seguro) · leer-por-paginas
```

Los imports son rutas relativas directas. No hay barrels ni path aliases.

## Decisiones que no se ven en el código

### Un único responsable por preocupación

Hubo un momento en que tres sistemas distintos reaccionaban al volver la
pestaña al primer plano y llegaban a cancelarse peticiones entre sí. Ahora:

| Preocupación                    | Responsable único    |
| ------------------------------- | -------------------- |
| Vigencia de la sesión           | `InactivityService`  |
| Ciclo de vida del cliente       | `SupabaseService`    |
| Reintentos de peticiones        | `ArtworksService`    |
| Presentación                    | Los componentes      |

No añadir recuperación ad-hoc en un componente: corregir al responsable.

### El cliente Supabase se sustituye en caliente

`SupabaseService.reinitializeClient()` crea una **instancia nueva**. Una
referencia guardada en un campo queda obsoleta. Por eso toda operación contra
la base pasa antes por:

```ts
await this.prepareClient();   // ensureActiveSession() + releer el cliente
```

`ensureActiveSession()` devuelve `true` a propósito cuando no hay sesión: el
catálogo se puede consultar de forma anónima.

### Columnas públicas y columnas restringidas

`ubicacion`, `valor` y `responsable` no se envían a visitantes anónimos:
juntas indican qué obra vale cuánto y dónde encontrarla. Se aplica en tres
capas, y las tres hacen falta:

1. `COLUMNAS_PUBLICAS` en `artworks.service.ts` — no se piden.
2. `@if (isAdmin())` en las plantillas — no se pintan.
3. `GRANT SELECT (columnas)` en Postgres — **la única que de verdad protege.**

Por el mismo motivo los filtros por ubicación y responsable solo existen para
administradores: poder filtrar por una columna oculta permite deducir su
contenido por ensayo y error.

### Registro público cerrado

Es un inventario institucional interno. Las cuentas las crea un administrador
desde el panel de Supabase. Quitar la ruta no basta: los signups deben estar
desactivados también en Supabase → Authentication → Sign In / Providers.

## Convenciones

- Componente: `nombre.component.ts`; su plantilla: `nombre.html` (sin `.component`).
- Standalone + `inject()` + signals. `ChangeDetectionStrategy.OnPush` en todos
  los componentes; por eso el estado mutable va en signals y no en campos planos.
- Sintaxis de control de flujo moderna (`@if` / `@for` con `track`).
- Tailwind en las plantillas. No hay hojas de estilo por componente.
- Dependencias pesadas (`exceljs`, `file-saver`) siempre tras `await import()`.
