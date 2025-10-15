import { FormControl, FormGroup } from '@angular/forms';

// Tipos para formularios reactivos
export interface BaseFormData {
  [key: string]: FormControl<any>;
}

export type FormControlType<T> = FormControl<T | null>;

export interface FormValidationError {
  field: string;
  message: string;
}

export interface FormState {
  isSubmitting: boolean;
  isValid: boolean;
  errors: FormValidationError[];
}
