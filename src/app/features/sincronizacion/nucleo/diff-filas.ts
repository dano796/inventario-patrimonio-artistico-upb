import { FilaHoja } from './hoja-obras';
import { ValoresFoto } from './foto';
import { ObraBase } from './importacion';
import { AltaBase, AltaHoja, AvisoSincronizacion } from './diff-tipos';

export interface Par {
  fila: FilaHoja;
  obra: ObraBase;
}

export interface Indice {
  pares: Par[];
  altasBase: Pick<AltaBase, 'fila' | 'campos'>[];
  altasHoja: AltaHoja[];
  avisos: AvisoSincronizacion[];
}

/** Una ausencia nunca borra: una obra sin fila con foto solo se reporta. */
export function indexarPorIdWeb(
  filas: FilaHoja[],
  obras: ObraBase[],
  fotos: ReadonlyMap<number, ValoresFoto>,
  excluir: ReadonlySet<number> = new Set()
): Indice {
  const indice: Indice = { pares: [], altasBase: [], altasHoja: [], avisos: [] };
  const obraDe = new Map(obras.map((o) => [o.id, o]));
  const filasDe = new Map<number, FilaHoja[]>();
  for (const fila of filas) {
    if (fila.idWeb !== null) filasDe.set(fila.idWeb, [...(filasDe.get(fila.idWeb) ?? []), fila]);
    else if (!excluir.has(fila.fila)) indice.altasBase.push({ fila: fila.fila, campos: fila.campos });
  }

  for (const [idWeb, conEseId] of [...filasDe].sort(([a], [b]) => a - b)) {
    if (conEseId.length > 1) {
      indice.avisos.push({ tipo: 'id_duplicado', idWeb, filas: conEseId.map((f) => f.fila) });
      continue;
    }
    const fila = conEseId[0];
    const obra = obraDe.get(idWeb);
    if (obra) indice.pares.push({ fila, obra });
    else
      indice.avisos.push({
        tipo: fotos.has(idWeb) ? 'obra_borrada_en_web' : 'id_desconocido',
        idWeb,
        fila: fila.fila,
      });
  }

  for (const obra of [...obras].sort((a, b) => a.id - b.id)) {
    if (filasDe.has(obra.id)) continue;
    if (fotos.has(obra.id)) indice.avisos.push({ tipo: 'fila_borrada', obraId: obra.id });
    else indice.altasHoja.push({ obraId: obra.id });
  }

  indice.pares.sort((a, b) => a.fila.fila - b.fila.fila);
  return indice;
}
