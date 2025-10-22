// Constantes para validaciones
export const VALIDATION_RULES = {
  ARTWORK: {
    TITULO: {
      MIN_LENGTH: 2,
      MAX_LENGTH: 200,
    },
    AUTOR: {
      MAX_LENGTH: 100,
    },
    TECNICA: {
      MAX_LENGTH: 100,
    },
    DIMENSION: {
      MAX_LENGTH: 50,
    },
    UBICACION: {
      MAX_LENGTH: 200,
    },
    OBSERVACIONES: {
      MAX_LENGTH: 1000,
    },
    RESPONSABLE: {
      MAX_LENGTH: 100,
    },
    ANO: {
      MIN: 1700,
      MAX: new Date().getFullYear(),
    },
    VALOR: {
      MIN: 0,
    },
  },
  USER: {
    EMAIL: {
      PATTERN: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    },
    PASSWORD: {
      MIN_LENGTH: 8,
    },
  },
  IMAGE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  },
} as const;

// Mensajes de validación
export const VALIDATION_MESSAGES = {
  REQUIRED: 'Este campo es obligatorio',
  EMAIL: 'Ingresa un email válido',
  MIN_LENGTH: (min: number) => `Mínimo ${min} caracteres`,
  MAX_LENGTH: (max: number) => `Máximo ${max} caracteres`,
  MIN_VALUE: (min: number) => `El valor mínimo es ${min}`,
  MAX_VALUE: (max: number) => `El valor máximo es ${max}`,
  INVALID_FILE_TYPE: 'Tipo de archivo no válido',
  FILE_TOO_LARGE: 'El archivo es demasiado grande',
} as const;
