import { Campo, CAMPOS, FilaHoja } from './hoja-obras';
import { normalizarCampo, ValorCampo, ValoresFoto } from './foto';
import { ObraBase } from './importacion';
import { AvisoSincronizacion, CambioPropuesto, Conflicto, Convergencia, Lado } from './diff-tipos';

/** El cargo es de la persona, no de la obra: lo compara `diffCargos`. */
export const CAMPOS_POR_OBRA: readonly Campo[] = CAMPOS.filter((c) => c !== 'cargo');

export type Comparacion =
  | { tipo: 'igual' }
  | { tipo: 'convergido'; valor: ValorCampo }
  | { tipo: 'cambio'; destino: Lado }
  | { tipo: 'conflicto' };

export function compararCampo(
  campo: Campo,
  hoja: ValorCampo,
  base: ValorCampo,
  foto: ValorCampo | undefined
): Comparacion {
  const h = normalizarCampo(campo, hoja);
  const b = normalizarCampo(campo, base);
  if (foto === undefined) return h === b ? { tipo: 'convergido', valor: h } : { tipo: 'conflicto' };
  const cambioHoja = h !== foto;
  const cambioBase = b !== foto;
  if (!cambioHoja && !cambioBase) return { tipo: 'igual' };
  if (cambioHoja && !cambioBase) return { tipo: 'cambio', destino: 'base' };
  if (!cambioHoja && cambioBase) return { tipo: 'cambio', destino: 'hoja' };
  return h === b ? { tipo: 'convergido', valor: h } : { tipo: 'conflicto' };
}

export interface DiffObra {
  cambios: CambioPropuesto[];
  conflictos: Conflicto[];
  convergencias: Convergencia[];
  avisos: AvisoSincronizacion[];
}

export function diffCamposObra(fila: FilaHoja, obra: ObraBase, foto: ValoresFoto | undefined): DiffObra {
  const r: DiffObra = { cambios: [], conflictos: [], convergencias: [], avisos: [] };
  for (const campo of CAMPOS_POR_OBRA) {
    if (fila.noConvertibles.includes(campo)) continue;
    const hoja = fila.campos[campo];
    const base = obra.campos[campo];
    const fotoCampo = foto && campo in foto ? foto[campo] : undefined;
    const comparacion = compararCampo(campo, hoja, base, fotoCampo);
    const combinada = fila.combinados.includes(campo);
    const avisarCombinada = () =>
      r.avisos.push({ tipo: 'celda_combinada', obraId: obra.id, fila: fila.fila, campo });

    if (comparacion.tipo === 'convergido') {
      r.convergencias.push({ obraId: obra.id, clave: campo, valor: comparacion.valor });
    } else if (comparacion.tipo === 'cambio') {
      if (comparacion.destino === 'hoja' && combinada) avisarCombinada();
      else {
        r.cambios.push({
          obraId: obra.id, fila: fila.fila, campo, destino: comparacion.destino, hoja, base, foto: fotoCampo ?? null,
        });
        if (campo === 'responsable' && comparacion.destino === 'hoja' && fila.combinados.includes('cargo')) {
          r.avisos.push({ tipo: 'celda_combinada', obraId: obra.id, fila: fila.fila, campo: 'cargo' });
        }
      }
    } else if (comparacion.tipo === 'conflicto') {
      if (combinada) avisarCombinada();
      else r.conflictos.push({ obraId: obra.id, fila: fila.fila, campo, hoja, base, foto: fotoCampo });
    }
  }
  return r;
}
