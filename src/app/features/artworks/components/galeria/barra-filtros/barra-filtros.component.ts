import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ChipFiltro, ClaveFiltro, ValoresFiltros } from '../../../utils/galeria';

interface CampoFiltro {
  clave: Exclude<ClaveFiltro, 'busqueda'>;
  etiqueta: string;
  ejemplo: string;
  restringido: boolean;
}

const CAMPOS: readonly CampoFiltro[] = [
  { clave: 'ubicacion', etiqueta: 'Ubicación', ejemplo: 'Ej: Biblioteca Central', restringido: true },
  { clave: 'responsable', etiqueta: 'Responsable', ejemplo: 'Ej: Jobany Tobón', restringido: true },
  { clave: 'autor', etiqueta: 'Autor', ejemplo: 'Ej: Julio Londoño', restringido: false },
  { clave: 'tecnica', etiqueta: 'Técnica', ejemplo: 'Ej: Óleo sobre lienzo', restringido: false },
];

@Component({
  selector: 'app-barra-filtros',
  templateUrl: './barra-filtros.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraFiltrosComponent {
  valores = input.required<ValoresFiltros>();
  chips = input.required<readonly ChipFiltro[]>();
  esAdmin = input(false);
  abierto = input(false);

  cambio = output<{ clave: ClaveFiltro; valor: string }>();
  agregarUbicacion = output<string>();
  quitar = output<ChipFiltro>();
  limpiar = output<void>();
  alternar = output<void>();

  campos = computed(() => CAMPOS.filter((c) => !c.restringido || this.esAdmin()));
  contador = computed(() => this.chips().filter((c) => c.clave !== 'busqueda').length);

  emitir(clave: ClaveFiltro, evento: Event): void {
    this.cambio.emit({ clave, valor: (evento.target as HTMLInputElement).value });
  }
}
