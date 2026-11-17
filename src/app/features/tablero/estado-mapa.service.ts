import { Injectable, signal } from '@angular/core';

/** Lo que la persona dejó abierto en /mapa, para encontrarlo igual al volver de una ficha. Solo en memoria. */
@Injectable({ providedIn: 'root' })
export class EstadoMapaService {
  readonly bloque = signal<number | null>(null);
  /** undefined: ninguno abierto; null: el grupo de obras sin ubicación. */
  readonly lugar = signal<string | null | undefined>(undefined);
  desplazamiento = 0;
}
