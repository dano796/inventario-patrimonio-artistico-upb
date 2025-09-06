import { Injectable } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Injectable({
  providedIn: 'root',
})
export class ValidationService {
  getErrorMessage(control: AbstractControl): string {
    if (control.hasError('required')) {
      return 'Este campo es obligatorio';
    } else if (control.hasError('minlength')) {
      const minLength = control.getError('minlength').requiredLength;
      return `Este campo debe tener al menos ${minLength} caracteres`;
    } else if (control.hasError('maxlength')) {
      const maxLength = control.getError('maxlength').requiredLength;
      return `Este campo no debe exceder los ${maxLength} caracteres`;
    } else if (control.hasError('email')) {
      return 'Este campo debe ser un correo electrónico válido';
    } else if (control.hasError('pattern')) {
      return 'Este campo tiene un formato inválido';
    }
    return '';
  }

  showErrorMessage(control: AbstractControl): boolean {
    return Boolean(control?.invalid && control?.touched);
  }
}
