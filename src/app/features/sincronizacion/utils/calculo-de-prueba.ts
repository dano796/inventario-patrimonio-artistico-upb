import { Calculo } from '../services/sincronizacion.service';
import { Diff, diffVacio } from '../nucleo/diff-tipos';
import { FilaHoja } from '../nucleo/hoja-obras';
import { ObraBase } from '../nucleo/importacion';

export function calculoDePrueba(diff: Partial<Diff>, opciones: { filas?: FilaHoja[]; obras?: ObraBase[] } = {}): Calculo {
  return {
    hoja: { drive_id: 'd', item_id: 'i', nombre_hoja: 'Inventario Obras', fecha_ultima: null, etag: null, url: null },
    lectura: { columnas: {} as never, columnasImagen: [], columnaIdWeb: 17, filas: opciones.filas ?? [], avisos: [] },
    obras: opciones.obras ?? [],
    diff: { ...diffVacio(), ...diff },
    medios: new Map(),
  };
}
