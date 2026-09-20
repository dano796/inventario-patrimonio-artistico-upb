import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { ValidationService } from '../../../../shared/utils/validation.service';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeftOnRectangle, heroAtSymbol, heroChevronLeft, heroLockClosed, heroUser } from '@ng-icons/heroicons/outline';
import { heroInformationCircleSolid } from '@ng-icons/heroicons/solid';

interface LogInForm {
  correo: FormControl<string>;
  contrasena: FormControl<string>;
}

@Component({
  selector: 'app-auth-log-in',
  imports: [RouterLink, ReactiveFormsModule, NgIcon],
  templateUrl: './auth-log-in.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ heroArrowLeftOnRectangle, heroAtSymbol, heroChevronLeft, heroInformationCircleSolid, heroLockClosed, heroUser })],
})
export class AuthLogInComponent implements OnInit {
  private validationService = inject(ValidationService);
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  globalErrorMessage = signal<string | null>(null);

  form = this.formBuilder.group<LogInForm>({
    correo: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.email,
    ]),
    contrasena: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.minLength(8),
    ]),
  });

  ngOnInit() {
    this.checkForPasswordResetRedirect();
  }

  private checkForPasswordResetRedirect() {
    const fragment = window.location.hash;

    // Si la URL contiene parámetros de error relacionados con password reset
    if (
      fragment.includes('error=access_denied') &&
      fragment.includes('error_code=otp_expired')
    ) {
      this.globalErrorMessage.set(
        'El enlace de recuperación de contraseña ha expirado. Por favor, solicita uno nuevo.'
      );

      // Limpiar la URL del error
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Si la URL contiene un access_token válido para recuperación
    if (
      fragment.includes('access_token') &&
      fragment.includes('type=recovery')
    ) {
      this.router.navigate(['/autenticacion/actualizar-contrasena']);
      return;
    }
  }

  get correo() {
    return this.form.get('correo');
  }
  get contrasena() {
    return this.form.get('contrasena');
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
      const { error, data } = await this.authService.logIn({
        email: this.form.value.correo ?? '',
        password: this.form.value.contrasena ?? '',
      });

      if (error) throw error;

      this.router.navigateByUrl('/');
    } catch (error) {
      if (error instanceof Error) {
        this.globalErrorMessage.set(error.message);
      }
    }
  }
}
