import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TemaService } from '../../../core/services/tema.service';
import { etiquetaRol, iniciales } from './cabecera';

@Component({
  selector: 'app-cabecera',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cabecera.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabeceraComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private temas = inject(TemaService);

  esAdmin = this.auth.isAdmin;
  conSesion = this.auth.isAuthenticated;
  nombre = computed(() => this.auth.nombre() ?? 'Sesión iniciada');
  iniciales = computed(() => iniciales(this.auth.nombre()));
  rol = computed(() => etiquetaRol(this.esAdmin()));
  esOscuro = computed(() => this.temas.tema() === 'oscuro');
  menuAbierto = signal(false);

  alternarTema(): void {
    this.temas.alternar();
  }

  async cerrarSesion(): Promise<void> {
    this.menuAbierto.set(false);
    await this.auth.signOut();
    await this.router.navigateByUrl('/autenticacion/iniciar-sesion');
  }
}
