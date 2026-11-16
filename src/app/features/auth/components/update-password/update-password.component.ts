import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';

import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ValidationService } from '../../../../shared/utils/validation.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeftOnRectangle, heroArrowPath, heroCheck, heroCheckCircle, heroChevronLeft, heroInformationCircle, heroKey, heroLockClosed } from '@ng-icons/heroicons/outline';
import { heroInformationCircleSolid } from '@ng-icons/heroicons/solid';

interface UpdatePasswordForm {
  contrasena: FormControl<string>;
  confirmarContrasena: FormControl<string>;
}

@Component({
  selector: 'app-update-password',
  imports: [RouterLink, ReactiveFormsModule, NgIcon],
  templateUrl: './update-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ heroArrowLeftOnRectangle, heroArrowPath, heroCheck, heroCheckCircle, heroChevronLeft, heroInformationCircle, heroInformationCircleSolid, heroKey, heroLockClosed })],
})
export class UpdatePasswordComponent implements OnInit {
  private validationService = inject(ValidationService);
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  globalErrorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  isValidSession = signal<boolean>(false);

  form = this.formBuilder.group<UpdatePasswordForm>({
    contrasena: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.minLength(8),
    ]),
    confirmarContrasena: this.formBuilder.nonNullable.control('', [
      Validators.required,
    ]),
  });

  ngOnInit() {
    this.checkSession();
    this.setupPasswordValidation();
  }

  private async checkSession() {
    try {
      // Solo se acepta una sesion recien creada por el enlace de recuperacion.
      // Antes bastaba con cualquier sesion abierta, asi que quien llegara a un
      // navegador con sesion iniciada podia cambiar la contrasena sin conocer
      // la actual y quedarse con la cuenta.
      const result = await this.authService.processRecoveryUrl();

      if (result.success) {
        this.isValidSession.set(true);
        this.globalErrorMessage.set(null);
        return;
      }

      this.globalErrorMessage.set(
        'El enlace de recuperación ha expirado o no es válido. Por favor, solicita uno nuevo.'
      );
      setTimeout(() => {
        this.router.navigate(['/autenticacion/recuperar-contrasena']);
      }, 10000);
    } catch (error) {
      this.globalErrorMessage.set(
        'Error al verificar la sesión. Por favor, solicita un nuevo enlace de recuperación.'
      );
    }
  }

  private setupPasswordValidation() {
    // Validación personalizada para confirmar contraseña
    this.form.get('confirmarContrasena')?.setValidators([
      Validators.required,
      (control) => {
        const password = this.form.get('contrasena')?.value;
        const confirmPassword = control.value;

        if (password && confirmPassword && password !== confirmPassword) {
          return { passwordMismatch: true };
        }
        return null;
      },
    ]);

    // Re-validar confirmar contraseña cuando cambie la contraseña
    this.form.get('contrasena')?.valueChanges.subscribe(() => {
      this.form.get('confirmarContrasena')?.updateValueAndValidity();
    });
  }

  get contrasena() {
    return this.form.get('contrasena');
  }

  get confirmarContrasena() {
    return this.form.get('confirmarContrasena');
  }

  getErrorMessage(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control) return '';

    if (
      controlName === 'confirmarContrasena' &&
      control.hasError('passwordMismatch')
    ) {
      return 'Las contraseñas no coinciden';
    }

    return this.validationService.getErrorMessage(control);
  }

  showErrorMessage(controlName: string): boolean {
    const control = this.form.get(controlName);
    return control ? this.validationService.showErrorMessage(control) : false;
  }

  async onSubmit() {
    if (this.form.invalid || !this.isValidSession()) return;

    this.isLoading.set(true);
    this.globalErrorMessage.set(null);
    this.successMessage.set(null);

    try {
      const newPassword = this.form.value.contrasena ?? '';
      const { error } = await this.authService.updatePassword(newPassword);

      if (error) {
        this.globalErrorMessage.set(this.getSupabaseErrorMessage(error));
        return;
      }

      this.successMessage.set(
        'Tu contraseña ha sido actualizada exitosamente.',
      );

      setTimeout(() => {
        this.router.navigate(['/autenticacion/iniciar-sesion']);
      }, 3000);
    } catch (error: any) {
      this.globalErrorMessage.set(
        'Ocurrió un error inesperado. Por favor, intenta de nuevo.'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  private getSupabaseErrorMessage(error: any): string {
    if (error.message?.includes('Password should be at least')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (error.message?.includes('Same password')) {
      return 'La nueva contraseña debe ser diferente a la actual.';
    }
    if (error.message?.includes('Weak password')) {
      return 'La contraseña es muy débil. Por favor, usa una contraseña más segura.';
    }

    return (
      error.message ||
      'Error al actualizar la contraseña. Por favor, intenta de nuevo.'
    );
  }
}
