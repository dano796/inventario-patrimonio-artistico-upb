import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CasillaComponent } from '../../../../../shared/components/casilla/casilla.component';
import { Lado } from '../../../nucleo/diff-tipos';
import { FilaRevision, GrupoRevision, Opcion, RefDecision } from '../../../utils/revision';

export interface Eleccion {
  ref: RefDecision;
  valor: string | null;
}

const ETIQUETAS: Record<string, string> = {
  autor: 'Autor', titulo: 'Título', tecnica: 'Técnica', dimension: 'Dimensión', ano: 'Año', ubicacion: 'Ubicación',
  bloque_asignado: 'Bloque asignado', valor: 'Valor estimado', descripcion: 'Descripción', responsable: 'Responsable',
  cargo: 'Cargo', observaciones: 'Observaciones', imagen_1: 'Imagen 1', imagen_2: 'Imagen 2', imagen_3: 'Imagen 3',
  id_web: 'ID WEB',
};

type Flecha = 'a-base' | 'a-hoja' | 'duda' | 'nada' | 'fuera';

@Component({
  selector: 'app-grupo-revision',
  imports: [CasillaComponent, NgTemplateOutlet, RouterLink],
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

  elegirOpcion(fila: FilaRevision, valor: string): void {
    if (fila.accion.tipo === 'opciones') this.elegir(fila.accion.ref, valor);
  }

  nombreLado(lado: Lado): string {
    return lado === 'hoja' ? 'En el Excel' : 'En la base';
  }

  ocultar(evento: Event): void {
    (evento.target as HTMLElement).style.visibility = 'hidden';
  }

  etiqueta(campo: string): string {
    return ETIQUETAS[campo] ?? campo;
  }

  /** En un conflicto entre la hoja y la base se elige pulsando el valor que se queda. */
  opcionDeLado(fila: FilaRevision, lado: Lado): Opcion | null {
    if (fila.accion.tipo !== 'opciones' || fila.accion.ref.tipo !== 'conflicto') return null;
    return fila.accion.opciones.find((o) => o.valor === lado) ?? null;
  }

  otrasOpciones(fila: FilaRevision): Opcion[] {
    if (fila.accion.tipo !== 'opciones' || fila.accion.ref.tipo === 'conflicto') return [];
    return fila.accion.opciones;
  }

  flecha(fila: FilaRevision): Flecha {
    if (fila.accion.tipo === 'fuera') return 'fuera';
    if (fila.accion.tipo === 'casilla' && !fila.accion.incluido) return 'nada';
    if (fila.accion.tipo === 'opciones' && fila.accion.ref.tipo === 'imagen' && fila.gana === 'hoja') return 'nada';
    if (fila.gana === 'hoja') return 'a-base';
    if (fila.gana === 'base') return 'a-hoja';
    return fila.pendiente ? 'duda' : 'nada';
  }

  estado(fila: FilaRevision): { texto: string; clase: string } {
    switch (fila.accion.tipo) {
      case 'casilla':
        return fila.accion.incluido
          ? { texto: this.textoDestino(fila.accion.destino), clase: 'text-acento-tinta' }
          : { texto: 'No se aplica', clase: 'text-tinta-5' };
      case 'opciones':
        if (fila.pendiente) return { texto: 'Pendiente de elegir el valor', clase: 'text-ambar' };
        if (fila.accion.ref.tipo === 'cargo') return { texto: 'Se aplica el cargo elegido', clase: 'text-acento-tinta' };
        if (fila.accion.ref.tipo === 'imagen' && fila.gana === 'hoja') return { texto: 'El Excel conserva la suya', clase: 'text-tinta-4' };
        if (fila.accion.ref.tipo === 'imagen' && !fila.gana && fila.accion.opciones.length > 1) {
          return { texto: 'Pendiente de decisión', clase: 'text-ambar' };
        }
        if (fila.gana === 'hoja') return { texto: 'Se escribe en la base', clase: 'text-acento-tinta' };
        if (fila.gana === 'base') return { texto: 'Se escribe en el Excel', clase: 'text-acento-tinta' };
        return { texto: 'El Excel no cambia', clase: 'text-tinta-5' };
      case 'fuera':
        return { texto: fila.accion.enlaceObra ? 'No se puede copiar' : 'Queda fuera', clase: 'text-tinta-4' };
    }
  }

  private textoDestino(destino: Lado): string {
    const texto = destino === 'base' ? 'Se escribe en la base' : 'Se escribe en el Excel';
    const obras = this.grupo().obras;
    if (!obras || obras < 2) return texto;
    return `${texto}, en sus ${obras} ${destino === 'base' ? 'obras' : 'filas'}`;
  }

  claseValor(fila: FilaRevision, lado: Lado): string {
    if (fila.accion.tipo === 'fuera') return 'text-tinta-4';
    if (fila.gana === lado) return 'font-bold text-tinta';
    if (fila.gana) return 'text-tinta-4';
    return 'text-tinta';
  }

  claseCaja(fila: FilaRevision, lado: Lado): string {
    if (this.opcionDeLado(fila, lado)) {
      return fila.gana === lado
        ? 'bg-acento-tenue-2 shadow-tarjeta'
        : `cursor-pointer hover:bg-acento-tenue ${fila.pendiente ? 'bg-superficie shadow-tarjeta' : 'bg-sub'}`;
    }
    if (fila.accion.tipo !== 'fuera' && fila.gana === lado) return 'bg-acento-tenue';
    return 'bg-sub';
  }
}
