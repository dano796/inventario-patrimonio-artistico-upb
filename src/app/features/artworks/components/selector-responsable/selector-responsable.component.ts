import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { Responsable } from '../../../../shared/models/responsable.model';
import { buscarPorNombre, filtrarResponsables, responsablesParecidos } from '../../utils/buscar-responsables';

export type SeleccionResponsable =
  | { tipo: 'existente'; responsable: Responsable }
  | { tipo: 'nuevo'; nombre: string; cargo: string | null }
  | null;

@Component({
  selector: 'app-selector-responsable',
  standalone: true,
  templateUrl: './selector-responsable.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorResponsableComponent {
  responsables = input.required<Responsable[]>();
  seleccion = model<SeleccionResponsable>(null);

  texto = signal('');
  listaAbierta = signal(false);
  creando = signal(false);
  nombreNuevo = signal('');
  cargoNuevo = signal('');

  coincidencias = computed(() => filtrarResponsables(this.texto(), this.responsables()).slice(0, 8));
  existeExacto = computed(() => buscarPorNombre(this.texto(), this.responsables()) !== undefined);
  parecidos = computed(() => responsablesParecidos(this.nombreNuevo(), this.responsables()));
  cargos = computed(() =>
    [...new Set(this.responsables().map((r) => r.cargo).filter((c): c is string => !!c))].sort()
  );

  elegir(responsable: Responsable): void {
    this.seleccion.set({ tipo: 'existente', responsable });
    this.texto.set('');
    this.listaAbierta.set(false);
    this.creando.set(false);
  }

  elegirPrimera(): void {
    const primera = this.coincidencias()[0];
    if (primera) this.elegir(primera);
  }

  abrirCreacion(): void {
    this.nombreNuevo.set(this.texto().trim());
    this.cargoNuevo.set('');
    this.listaAbierta.set(false);
    this.creando.set(true);
  }

  confirmarCreacion(): void {
    const nombre = this.nombreNuevo().trim();
    if (!nombre) return;
    const existente = buscarPorNombre(nombre, this.responsables());
    if (existente) {
      this.elegir(existente);
      return;
    }
    this.seleccion.set({ tipo: 'nuevo', nombre, cargo: this.cargoNuevo().trim() || null });
    this.creando.set(false);
    this.texto.set('');
  }

  cancelarCreacion(): void {
    this.creando.set(false);
  }

  quitar(): void {
    this.seleccion.set(null);
  }

  /** El blur del campo llega antes que el click en una opcion de la lista; sin la espera, la lista se cierra y el clic se pierde. */
  cerrarLista(): void {
    setTimeout(() => this.listaAbierta.set(false), 150);
  }
}
