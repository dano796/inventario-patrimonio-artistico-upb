# Estructura del Proyecto - Mejores Prácticas Angular

Este proyecto ha sido reorganizado siguiendo las mejores prácticas de Angular según la [Guía de Estilo Oficial](https://angular.dev/style-guide).

## 📁 Estructura de Carpetas

```
src/app/
├── core/                           # Servicios singleton y guards principales
│   ├── guards/                     # Guards de autenticación y autorización
│   │   ├── auth.guard.ts           # Guard para rutas privadas
│   │   └── admin.guard.ts          # Guard para rutas de administrador
│   ├── services/                   # Servicios singleton principales
│   │   ├── auth.service.ts         # Servicio de autenticación
│   │   ├── supabase.service.ts     # Cliente de Supabase
│   │   └── inactivity.service.ts   # Servicio de inactividad
│   └── interceptors/               # HTTP interceptors (preparado para futuro)
│
├── features/                       # Módulos de características REORGANIZADO
│   ├── artworks/                   # Feature module de obras de arte
│   │   ├── components/             # Componentes del feature
│   │   │   ├── artwork-detail/     # Detalle de obra
│   │   │   ├── artwork-form/       # Formulario CRUD de obra
│   │   │   └── artwork-list/       # Lista de obras
│   │   ├── services/               # Servicios específicos del feature
│   │   │   └── artworks.service.ts
│   │   ├── models/                 # Modelos específicos del feature (preparado)
│   │   ├── types/                  # Tipos específicos del feature (preparado)
│   │   └── artwork.routes.ts       # Rutas del feature
│   │
│   └── auth/                       # Feature module de autenticación
│       ├── components/             # Componentes del feature
│       │   ├── auth-log-in/        # Componente de inicio de sesión
│       │   └── auth-sign-up/       # Componente de registro
│       ├── services/               # Servicios específicos (preparado)
│       ├── models/                 # Modelos específicos (preparado)
│       └── auth.routes.ts          # Rutas del feature
│
├── shared/                         # Componentes y servicios reutilizables EXPANDIDO
│   ├── components/                 # Componentes compartidos
│   │   ├── confirm-modal/          # Modal de confirmación
│   │   └── image-uploader/         # Componente de subida de imágenes
│   ├── models/                     # Todos los modelos centralizados
│   │   ├── artwork.model.ts        # Modelo principal de artwork
│   │   ├── user.model.ts           # Modelo de usuario
│   │   └── image.model.ts          # Modelo de imágenes (antes artwork-image)
│   ├── types/                      # Tipos TypeScript
│   │   ├── common.types.ts         # Tipos comunes
│   │   └── form.types.ts           # Tipos para formularios
│   ├── constants/                  # Constantes de la aplicación
│   │   ├── app.constants.ts        # Constantes generales
│   │   └── validation.constants.ts # Constantes de validación
│   ├── services/                   # Servicios utilitarios
│   │   └── image.service.ts        # Servicio de manejo de imágenes
│   ├── utils/                      # Servicios de utilidades
│   │   └── validation.service.ts   # Servicio de validaciones

├── app.config.ts                   # Configuración de la aplicación
├── app.routes.ts                   # Rutas principales
├── app.html                        # Template principal
└── app.ts                          # Componente raíz
```

## 🏗️ Principios de Arquitectura

### **Core Module**

- **Propósito**: Servicios singleton que se usan en toda la aplicación
- **Contenido**:
  - `AuthService`: Manejo de autenticación y autorización
  - `SupabaseService`: Cliente principal de la base de datos
  - Guards para protección de rutas

### **Feature Modules**

- **Propósito**: Encapsular funcionalidades específicas del negocio
- **Estructura consistente**:
  - `data-access/`: Servicios específicos del feature
  - `features/`: Componentes y sub-features
  - Routing propio para cada feature

### **Shared Module**

- **Propósito**: Componentes, servicios y utilidades reutilizables
- **Contenido**:
  - Componentes UI reutilizables
  - Modelos de datos compartidos
  - Servicios utilitarios

## 📦 Imports Directos

Los imports se realizan directamente a los archivos específicos, manteniendo claridad y simplicidad:

```typescript
// ✅ Imports directos recomendados
import { AuthService } from "../core/services/auth.service";
import { adminGuard } from "../core/guards/admin.guard";
import { ArtworkImage } from "../shared/models/artwork-image.model";
import { ImageUploaderComponent } from "../shared/components/image-uploader/image-uploader.component";
```

Esto proporciona:

- **Transparencia**: Es claro de dónde viene cada import
- **Mantenibilidad**: Fácil seguimiento de dependencias
- **Simplicidad**: No requiere configuración adicional de barrels

## 🎯 Beneficios de esta Estructura

1. **Separación de Responsabilidades**: Cada módulo tiene un propósito claro
2. **Escalabilidad**: Fácil agregar nuevos features sin afectar otros
3. **Mantenibilidad**: Estructura predecible y fácil navegación
4. **Reutilización**: Componentes y servicios compartidos centralizados
5. **Testing**: Cada feature puede ser testeado independientemente
6. **Lazy Loading**: Features pueden cargarse bajo demanda

## 🚀 Próximos Pasos

1. Considerar implementar path mapping en `tsconfig.json` para imports más cortos (opcional)
2. Implementar NgModules si el proyecto crece significativamente
3. Agregar pruebas unitarias específicas por módulo
4. Implementar arquitectura de estado (NgRx) si la complejidad aumenta

## 📋 Convenciones de Nombrado

- **Archivos**: `kebab-case.suffix.ts`
- **Componentes**: `PascalCase` + `Component`
- **Servicios**: `PascalCase` + `Service`
- **Guards**: `camelCase` + `Guard`
- **Interfaces**: `PascalCase`
- **Carpetas**: `kebab-case`
