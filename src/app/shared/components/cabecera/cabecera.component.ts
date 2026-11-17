import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Tema, TemaService } from '../../../core/services/tema.service';
import { etiquetaRol, iniciales } from './cabecera';

@Component({
  selector: 'app-cabecera',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './cabecera.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'cerrarPerfil(true)',
    '(document:click)': 'alPulsarFuera($event)',
  },
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
  correo = this.auth.correo;
  tema = this.temas.tema;
  esOscuro = computed(() => this.tema() === 'oscuro');
  menuAbierto = signal(false);
  perfilAbierto = signal(false);
  readonly opcionesTema: readonly { valor: Tema; etiqueta: string }[] = [
    { valor: 'claro', etiqueta: 'Claro' },
    { valor: 'oscuro', etiqueta: 'Oscuro' },
  ];

  private perfil = viewChild<ElementRef<HTMLElement>>('perfil');
  private botonPerfil = viewChild<ElementRef<HTMLButtonElement>>('botonPerfil');

  private url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  enGaleria = computed(() => !/^\/(resumen|mapa|tablero|sincronizacion|autenticacion)(\/|\?|$)/.test(this.url()));

  alternarTema(): void {
    this.temas.alternar();
  }

  elegirTema(tema: Tema): void {
    this.temas.establecer(tema);
  }

  cerrarPerfil(devolverFoco = false): void {
    if (!this.perfilAbierto()) return;
    this.perfilAbierto.set(false);
    if (devolverFoco) this.botonPerfil()?.nativeElement.focus();
  }

  alPulsarFuera(evento: Event): void {
    if (!this.perfil()?.nativeElement.contains(evento.target as Node)) this.cerrarPerfil();
  }

  async cerrarSesion(): Promise<void> {
    this.menuAbierto.set(false);
    this.perfilAbierto.set(false);
    await this.auth.signOut();
    await this.router.navigateByUrl('/autenticacion/iniciar-sesion');
  }
}
