// Configuración general de la aplicación
export const APP_CONFIG = {
  APP_NAME: 'Inventario Patrimonio Artístico UPB',
  VERSION: '1.0.0',
  DEFAULT_PAGE_SIZE: 12,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  DEBOUNCE_TIME: 300, // milliseconds
} as const;

// URLs y endpoints
export const API_ENDPOINTS = {
  ARTWORKS: 'obras',
  USERS: 'usuarios',
  IMAGES: 'imagenes',
} as const;

// Mensajes de la aplicación
export const MESSAGES = {
  SUCCESS: {
    ARTWORK_CREATED: 'Obra creada exitosamente',
    ARTWORK_UPDATED: 'Obra actualizada exitosamente',
    ARTWORK_DELETED: 'Obra eliminada exitosamente',
    LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  },
  ERROR: {
    GENERIC: 'Ha ocurrido un error inesperado',
    NETWORK: 'Error de conexión',
    VALIDATION: 'Por favor, corrige los errores del formulario',
    UNAUTHORIZED: 'No tienes permisos para realizar esta acción',
    NOT_FOUND: 'Recurso no encontrado',
  },
  CONFIRM: {
    DELETE_ARTWORK: '¿Estás seguro de que deseas eliminar esta obra?',
  },
} as const;
