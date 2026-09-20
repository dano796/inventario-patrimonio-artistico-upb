import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ValidationService } from '../../../../shared/utils/validation.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeftOnRectangle, heroAtSymbol, heroCheck, heroChevronLeft, heroEnvelope, heroInformationCircle, heroKey } from '@ng-icons/heroicons/outline';
import { heroInformationCircleSolid } from '@ng-icons/heroicons/solid';

interface ForgotPasswordForm {
  correo: FormControl<string>;
}

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, ReactiveFormsModule, NgIcon],
  templateUrl: './forgot-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ heroArrowLeftOnRectangle, heroAtSymbol, heroCheck, heroChevronLeft, heroEnvelope, heroInformationCircle, heroInformationCircleSolid, heroKey })],
})
export class ForgotPasswordComponent {
  private validationService = inject(ValidationService);
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  globalErrorMessage = signal<string | null>(null);
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
    this.globalErrorMessage.set(null);
    this.successMessage.set(null);

    try {
      const email = this.form.value.correo ?? '';
      const { error } = await this.authService.resetPassword(email);

      if (error) {
        this.globalErrorMessage.set(this.getSupabaseErrorMessage(error));
        return;
      }

      this.successMessage.set(
        'Se ha enviado un enlace de recuperación a tu correo electrónico. Revisa tu bandeja de entrada y la carpeta de spam.'
      );

      setTimeout(() => {
        this.router.navigate(['/autenticacion/iniciar-sesion']);
      }, 8000);
    } catch (error: any) {
      this.globalErrorMessage.set(
        'Ocurrió un error inesperado. Por favor, intenta de nuevo.'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  private getSupabaseErrorMessage(error: any): string {
    if (error.message?.includes('Invalid email')) {
      return 'El formato del correo electrónico no es válido.';
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

    // Sin detalles del error: distinguir "usuario no existe" de otros fallos
    // permitiria enumerar que correos estan registrados.
    console.warn('resetPassword falló:', error?.message);
    return 'No se pudo enviar el correo de recuperación. Si el problema persiste, contacta al administrador.';
  }
}
