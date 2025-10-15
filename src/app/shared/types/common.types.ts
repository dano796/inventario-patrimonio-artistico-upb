// Tipos comunes para la aplicación
export interface ApiResponse<T> {
  data: T;
  error: string | null;
  message?: string;
}

export interface LoadingState {
  loading: boolean;
  error: boolean;
  success: boolean;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  field: string;
  order: SortOrder;
}
