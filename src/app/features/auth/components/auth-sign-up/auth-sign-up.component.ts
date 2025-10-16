import { AuthService } from '../../../../core/services/auth.service';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ValidationService } from '../../../../shared/utils/validation.service';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

interface SignUpForm {
  correo: FormControl<string>;
  contrasena: FormControl<string>;
  nombre: FormControl<string>;
}

@Component({
  selector: 'app-auth-sign-up',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './auth-sign-up.html',
})
export class AuthSignUpComponent {
  private validationService = inject(ValidationService);
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  globalErrorMessage: string | null = null;
  successMessage = signal<string | null>(null);

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
      this.globalErrorMessage = null; // Limpiar errores previos

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
        console.error('Error de Supabase:', authResponse.error);
        this.globalErrorMessage = this.getSupabaseErrorMessage(
          authResponse.error
        );
        return;
      }

      // Registro exitoso
      console.log('Registro exitoso');
      this.successMessage.set('Cuenta creada exitosamente');

      // Redirigir al inicio de sesión después de un breve delay para mostrar el mensaje
      setTimeout(() => {
        this.router.navigate(['/autenticacion/iniciar-sesion']);
      }, 2000);
    } catch (error: any) {
      console.error('Error en el registro:', error);
      this.globalErrorMessage =
        'Ocurrió un error inesperado. Por favor, intenta de nuevo.';
    }
  }

  private getSupabaseErrorMessage(error: any): string {
    if (error.message?.includes('User already registered')) {
      return 'Este correo electrónico ya está registrado. Por favor, usa otro correo o inicia sesión.';
    }
    if (error.message?.includes('Password should be at least')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (error.message?.includes('Invalid email')) {
      return 'El formato del correo electrónico no es válido.';
    }
    if (error.message?.includes('Email not confirmed')) {
      return 'Por favor, confirma tu correo electrónico antes de continuar.';
    }

    return (
      error.message || 'Error al crear la cuenta. Por favor, intenta de nuevo.'
    );
  }
}
