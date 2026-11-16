import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, Injector, inject, input, model, signal, viewChild } from '@angular/core';
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
  host: { '(document:keydown.escape)': 'abierto() && cerrar()' },
})
export class SelectorResponsableComponent {
  responsables = input.required<Responsable[]>();
  seleccion = model<SeleccionResponsable>(null);

  abierto = signal(false);
  texto = signal('');
  creando = signal(false);
  nombreNuevo = signal('');
  cargoNuevo = signal('');

  private readonly injector = inject(Injector);
  private readonly campo = viewChild<ElementRef<HTMLButtonElement>>('campo');
  private readonly dialogo = viewChild<ElementRef<HTMLElement>>('dialogo');
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');
  private readonly nombre = viewChild<ElementRef<HTMLInputElement>>('nombre');

  coincidencias = computed(() => filtrarResponsables(this.texto(), this.responsables()));
  parecidos = computed(() => responsablesParecidos(this.nombreNuevo(), this.responsables()));
  cargos = computed(() =>
    [...new Set(this.responsables().map((r) => r.cargo).filter((c): c is string => !!c))].sort()
  );

  abrir(): void {
    this.texto.set('');
    this.creando.set(false);
    this.abierto.set(true);
    this.enfocar(() => this.buscador());
  }

  cerrar(): void {
    this.abierto.set(false);
    this.creando.set(false);
    this.enfocar(() => this.campo());
  }

  elegir(responsable: Responsable): void {
    this.seleccion.set({ tipo: 'existente', responsable });
    this.abierto.set(false);
    this.creando.set(false);
  }

  elegirPrimera(): void {
    const primera = this.coincidencias()[0];
    if (primera) this.elegir(primera);
  }

  abrirCreacion(): void {
    this.nombreNuevo.set(this.texto().trim());
    this.cargoNuevo.set('');
    this.creando.set(true);
    this.enfocar(() => this.nombre());
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
    this.abierto.set(false);
    this.creando.set(false);
  }

  cancelarCreacion(): void {
    this.creando.set(false);
    this.enfocar(() => this.buscador());
  }

  cargoDe(seleccion: NonNullable<SeleccionResponsable>): string | null {
    return seleccion.tipo === 'existente' ? seleccion.responsable.cargo : seleccion.cargo;
  }

  quitar(): void {
    this.seleccion.set(null);
    this.enfocar(() => this.campo());
  }

  atraparFoco(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab') return;
    const dialogo = this.dialogo()?.nativeElement;
    if (!dialogo) return;
    const enfocables = [...dialogo.querySelectorAll<HTMLElement>('button:not([disabled]), input')];
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  private enfocar(destino: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => destino()?.nativeElement.focus(), { injector: this.injector });
  }
}
