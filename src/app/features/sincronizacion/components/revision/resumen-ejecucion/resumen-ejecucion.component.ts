import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Revision } from '../../../utils/revision';

const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? '' : 's'}`;

@Component({
  selector: 'app-resumen-ejecucion',
  templateUrl: './resumen-ejecucion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenEjecucionComponent {
  revision = input.required<Revision>();
  aplicando = input(false);
  aprobar = output<void>();
  comparar = output<void>();

  lineas = computed(() => {
    const r = this.revision().resumen;
    return [
      { etiqueta: 'Cambios hacia la base', cifra: r.haciaBase },
      { etiqueta: 'Cambios hacia la hoja', cifra: r.haciaHoja },
      { etiqueta: 'Filas nuevas en la hoja', cifra: r.filasNuevas },
    ];
  });

  faltan = computed(() => {
    const { conflictos, altas } = this.revision().pendientes;
    const partes = [conflictos ? plural(conflictos, 'conflicto') : '', altas ? plural(altas, 'alta') : ''].filter(Boolean);
    return partes.length ? `Falta decidir ${partes.join(' y ')} antes de aplicar.` : null;
  });
}
