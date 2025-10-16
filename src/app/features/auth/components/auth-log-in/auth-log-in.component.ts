import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ValidationService } from '../../../../shared/utils/validation.service';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, RouterLink } from '@angular/router';

interface LogInForm {
  correo: FormControl<string>;
  contrasena: FormControl<string>;
}

@Component({
  selector: 'app-auth-log-in',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './auth-log-in.html',
})
export class AuthLogInComponent {
  private validationService = inject(ValidationService);
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  globalErrorMessage: string | null = null;

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
      const { error, data } = await this.authService.logIn({
        email: this.form.value.correo ?? '',
        password: this.form.value.contrasena ?? '',
      });

      if (error) throw error;

      console.log(data);

      this.router.navigateByUrl('/');
    } catch (error) {
      if (error instanceof Error) {
        this.globalErrorMessage = error.message;
      }
    }
  }
}
