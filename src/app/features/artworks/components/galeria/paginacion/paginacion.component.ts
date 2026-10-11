import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-paginacion',
  templateUrl: './paginacion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginacionComponent {
  paginaActual = input.required<number>();
  totalPaginas = input.required<number>();
  irA = output<number>();

  progreso = computed(() => `${Math.round((this.paginaActual() / Math.max(this.totalPaginas(), 1)) * 100)}%`);

  ir(valor: string | number): void {
    const pagina = Number(valor);
    if (Number.isInteger(pagina) && pagina >= 1 && pagina <= this.totalPaginas() && pagina !== this.paginaActual()) {
      this.irA.emit(pagina);
    }
  }
}
