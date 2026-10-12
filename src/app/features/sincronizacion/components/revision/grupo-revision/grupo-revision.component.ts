import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FilaRevision, GrupoRevision, RefDecision } from '../../../utils/revision';

export interface Eleccion {
  ref: RefDecision;
  valor: string | null;
}

@Component({
  selector: 'app-grupo-revision',
  imports: [RouterLink],
  templateUrl: './grupo-revision.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrupoRevisionComponent {
  grupo = input.required<GrupoRevision>();
  elegido = output<Eleccion>();

  readonly lados = ['hoja', 'base'] as const;

  readonly tonos: Record<GrupoRevision['tono'], string> = {
    acento: 'bg-acento-tenue-2 text-acento-tinta',
    ambar: 'bg-ambar-suave text-ambar',
    neutro: 'bg-linea-suave text-tinta-3',
  };

  elegir(ref: RefDecision, valor: string | null): void {
    this.elegido.emit({ ref, valor });
  }

  claseValor(fila: FilaRevision, lado: 'hoja' | 'base'): string {
    if (fila.accion.tipo === 'fuera') return 'text-tinta-4';
    if (fila.gana === lado) return 'font-bold text-tinta';
    if (fila.gana) return 'text-tinta-5 line-through';
    return 'text-tinta';
  }
}
