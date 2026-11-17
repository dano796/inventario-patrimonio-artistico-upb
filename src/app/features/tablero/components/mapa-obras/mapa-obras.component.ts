import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, OnInit, signal, untracked, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableroService } from '../../tablero.service';
import { EstadoMapaService } from '../../estado-mapa.service';
import { calcularTablero, ObraTablero, ResumenTablero } from '../../tablero';
import { MapaCampusComponent } from '../mapa-campus/mapa-campus.component';

@Component({
  selector: 'app-mapa-obras',
  imports: [RouterLink, MapaCampusComponent],
  templateUrl: './mapa-obras.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaObrasComponent implements OnInit {
  private tablero = inject(TableroService);
  private recuerdo = inject(EstadoMapaService);
  private injector = inject(Injector);
  private lista = viewChild<ElementRef<HTMLElement>>('lista');

  cargando = signal(true);
  error = signal(false);
  resumen = signal<ResumenTablero | null>(null);
  bloqueElegido = this.recuerdo.bloque;
  lugarAbierto = this.recuerdo.lugar;
  private pantallaAncha = signal(true);

  /** En pantalla ancha el panel de bloques tapa la derecha del mapa: el centro se corre a la izquierda. */
  rellenoMapa = computed(() => ({ top: 0, right: this.pantallaAncha() ? 412 : 0, bottom: 0, left: 0 }));

  constructor() {
    // Al cambiar de bloque (desde la lista o desde el plano) se cierra el lugar abierto.
    let bloqueVisto = this.bloqueElegido();
    effect(() => {
      const bloque = this.bloqueElegido();
      if (bloque === bloqueVisto) return;
      bloqueVisto = bloque;
      untracked(() => this.lugarAbierto.set(undefined));
    });
    const consulta = inject(DOCUMENT).defaultView?.matchMedia?.('(min-width: 1024px)');
    if (consulta) {
      this.pantallaAncha.set(consulta.matches);
      const cambio = (e: MediaQueryListEvent) => this.pantallaAncha.set(e.matches);
      consulta.addEventListener('change', cambio);
      inject(DestroyRef).onDestroy(() => consulta.removeEventListener('change', cambio));
    }
  }

  ngOnInit(): void {
    this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      this.resumen.set(calcularTablero(await this.tablero.obras(), new Date()));
      afterNextRender(() => this.lista()?.nativeElement.scrollTo({ top: this.recuerdo.desplazamiento }), { injector: this.injector });
    } catch (error) {
      console.error('Error cargando el mapa de obras:', error);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  elegirBloque(numero: number): void {
    this.bloqueElegido.set(this.bloqueElegido() === numero ? null : numero);
  }

  guardarDesplazamiento(evento: Event): void {
    this.recuerdo.desplazamiento = (evento.target as HTMLElement).scrollTop;
  }

  alternarLugar(nombre: string | null): void {
    this.lugarAbierto.set(this.lugarAbierto() === nombre ? undefined : nombre);
  }

  titulo(obra: ObraTablero): string {
    return obra.titulo?.trim() || 'Sin título';
  }

  nombreBloque(numero: number, nombre: string | null): string {
    return nombre ?? `Bloque ${numero}`;
  }

  numero(valor: number): string {
    return valor.toLocaleString('es-CO');
  }

  porcentaje(proporcion: number): string {
    return `${Math.round(proporcion * 100)}%`;
  }
}
