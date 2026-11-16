import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** null marca un tramo de páginas omitido. */
export function paginasVisibles(actual: number, total: number): (number | null)[] {
  const paginas: (number | null)[] = [];
  for (let pagina = 1; pagina <= total; pagina++) {
    if (pagina === 1 || pagina === total || Math.abs(pagina - actual) <= 1) paginas.push(pagina);
    else if (paginas[paginas.length - 1] !== null) paginas.push(null);
  }
  return paginas;
}

@Component({
  selector: 'app-paginacion',
  templateUrl: './paginacion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginacionComponent {
  paginaActual = input.required<number>();
  totalPaginas = input.required<number>();
  irA = output<number>();

  paginas = computed(() => paginasVisibles(this.paginaActual(), this.totalPaginas()));

  ir(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas() && pagina !== this.paginaActual()) this.irA.emit(pagina);
  }
}
