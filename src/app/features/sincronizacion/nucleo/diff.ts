import { ResultadoHoja } from './hoja-obras';
import { ValoresFoto } from './foto';
import { clasificarImagenes, ObraBase } from './importacion';
import { AvisoSincronizacion, Diff, diffVacio, ResponsableBase } from './diff-tipos';
import { indexarPorIdWeb } from './diff-filas';
import { diffCamposObra } from './diff-campos';
import { diffCargos } from './diff-responsables';
import { diffImagenes } from './diff-imagenes';

export interface EntradaDiff {
  lectura: ResultadoHoja;
  obras: ObraBase[];
  responsables: ResponsableBase[];
  fotos: ReadonlyMap<number, ValoresFoto>;
  prefijoBucket: string;
  tamanos: Record<string, number>;
}

export function calcularDiff(entrada: EntradaDiff): Diff {
  const idsIlegibles = new Set(entrada.lectura.avisos.filter((a) => a.campo === 'id_web').map((a) => a.fila));
  const indice = indexarPorIdWeb(entrada.lectura.filas, entrada.obras, entrada.fotos, idsIlegibles);
  const diff = diffVacio();
  const filas = new Map(entrada.lectura.filas.map((f) => [f.fila, f]));
  for (const alta of indice.altasBase) {
    const { aceptadas, rechazadas } = clasificarImagenes(filas.get(alta.fila)!, entrada.tamanos);
    diff.altasBase.push({ ...alta, imagenes: aceptadas, imagenesRechazadas: rechazadas });
  }
  diff.altasHoja.push(...indice.altasHoja);
  diff.avisos.push(
    ...entrada.lectura.avisos.map((aviso): AvisoSincronizacion => ({ tipo: 'fila', aviso })),
    ...indice.avisos
  );

  for (const { fila, obra } of indice.pares) {
    const foto = entrada.fotos.get(obra.id);
    const campos = diffCamposObra(fila, obra, foto);
    const imagenes = diffImagenes(fila, obra, foto, entrada.prefijoBucket);
    diff.cambios.push(...campos.cambios);
    diff.conflictos.push(...campos.conflictos);
    diff.convergencias.push(...campos.convergencias, ...imagenes.convergencias);
    diff.avisos.push(...campos.avisos);
    diff.imagenes.push(...imagenes.imagenes);
    diff.avisosImagen.push(...imagenes.avisosImagen);
  }

  const cargos = diffCargos(indice.pares, entrada.responsables, entrada.fotos);
  diff.cargos.push(...cargos.cargos);
  diff.conflictosCargo.push(...cargos.conflictosCargo);
  diff.convergencias.push(...cargos.convergencias);
  diff.avisos.push(...cargos.avisos);
  diff.avisos = sinCombinadasRepetidas(diff.avisos);
  return diff;
}

/** Un CARGO combinado lo detectan a la vez el cambio de responsable y el de cargo. */
function sinCombinadasRepetidas(avisos: AvisoSincronizacion[]): AvisoSincronizacion[] {
  const vistas = new Set<string>();
  return avisos.filter((aviso) => {
    if (aviso.tipo !== 'celda_combinada') return true;
    const clave = `${aviso.obraId}|${aviso.fila}|${aviso.campo}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

export function hayCambios(diff: Diff): boolean {
  return [
    diff.cambios, diff.conflictos, diff.cargos, diff.conflictosCargo,
    diff.imagenes, diff.avisosImagen, diff.altasBase, diff.altasHoja,
  ].some((lista) => lista.length > 0);
}
