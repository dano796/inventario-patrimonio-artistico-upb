import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ValidationService } from '../../../../shared/utils/validation.service';

interface ForgotPasswordForm {
  correo: FormControl<string>;
}

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordComponent {
  private validationService = inject(ValidationService);
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  globalErrorMessage: string | null = null;
  successMessage = signal<string | null>(null);
  isLoading = signal<boolean>(false);

  form = this.formBuilder.group<ForgotPasswordForm>({
    correo: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.email,
    ]),
  });

  get correo() {
    return this.form.get('correo');
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

    this.isLoading.set(true);
    this.globalErrorMessage = null;
    this.successMessage.set(null);

    try {
      const email = this.form.value.correo ?? '';
      const { error } = await this.authService.resetPassword(email);

      if (error) {
        this.globalErrorMessage = this.getSupabaseErrorMessage(error);
        return;
      }

      this.successMessage.set(
        'Se ha enviado un enlace de recuperación a tu correo electrónico. Revisa tu bandeja de entrada y la carpeta de spam.'
      );

      setTimeout(() => {
        this.router.navigate(['/autenticacion/iniciar-sesion']);
      }, 8000);
    } catch (error: any) {
      this.globalErrorMessage =
        'Ocurrió un error inesperado. Por favor, intenta de nuevo.';
    } finally {
      this.isLoading.set(false);
    }
  }

  private getSupabaseErrorMessage(error: any): string {
    if (error.message?.includes('Email not confirmed')) {
      return 'Tu cuenta aún no ha sido confirmada. Por favor, revisa tu correo electrónico.';
    }
    if (error.message?.includes('Invalid email')) {
      return 'El formato del correo electrónico no es válido.';
    }
    if (error.message?.includes('User not found')) {
      return 'No se encontró una cuenta asociada a este correo electrónico.';
    }
    if (error.message?.includes('Email rate limit')) {
      return 'Has solicitado demasiados emails de recuperación. Espera unos minutos antes de intentar de nuevo.';
    }
    if (error.message?.includes('SMTP')) {
      return 'Hay un problema temporal con el servicio de correo. Por favor, intenta más tarde o contacta al administrador.';
    }
    if (error.message?.includes('signup_disabled')) {
      return 'El registro de nuevos usuarios está deshabilitado temporalmente.';
    }

    const errorMsg = error.message || 'Error desconocido';
    return `Error al enviar el correo de recuperación: ${errorMsg}. Si el problema persiste, contacta al administrador.`;
  }
}
