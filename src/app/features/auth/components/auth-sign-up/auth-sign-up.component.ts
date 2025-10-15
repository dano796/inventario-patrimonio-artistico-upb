import { AuthService } from '../../../../core/services/auth.service';
import { Component, inject } from '@angular/core';
import { ValidationService } from '../../../../shared/utils/validation.service';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

interface SignUpForm {
  correo: FormControl<string>;
  contrasena: FormControl<string>;
  nombre: FormControl<string>;
}

@Component({
  selector: 'app-auth-sign-up',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './auth-sign-up.html',
})
export class AuthSignUpComponent {
  private validationService = inject(ValidationService);
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);

  globalErrorMessage: string | null = null;

  form = this.formBuilder.group<SignUpForm>({
    correo: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.email,
    ]),
    contrasena: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.minLength(8),
    ]),
    nombre: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(50),
    ]),
  });

  get correo() {
    return this.form.get('correo');
  }
  get contrasena() {
    return this.form.get('contrasena');
  }
  get nombre() {
    return this.form.get('nombre');
  }

  getErrorMessage(controlName: string): string {
    const control = this.form.get(controlName);
    return control ? this.validationService.getErrorMessage(control) : '';
  }

  showErrorMessage(controlName: string): boolean {
    const control = this.form.get(controlName);
    return control ? this.validationService.showErrorMessage(control) : false;
  }

  async onSubmit() {
    if (this.form.invalid) return;

    try {
      const authResponse = await this.authService.signUp({
        email: this.form.value.correo ?? '',
        password: this.form.value.contrasena ?? '',
        options: {
          data: {
            display_name: this.form.value.nombre ?? '',
          },
        },
      });

      if (authResponse.error) {
        throw authResponse.error;
      }
    } catch (error) {
      console.error('Error en el registro:', error);
    }
  }
}
