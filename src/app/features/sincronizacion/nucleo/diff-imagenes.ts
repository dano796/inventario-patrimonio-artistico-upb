import { CasillaImagen, FilaHoja } from './hoja-obras';
import { CASILLAS_IMAGEN, claveImagen, ValoresFoto } from './foto';
import { ObraBase } from './importacion';
import { AvisoImagen, CambioImagen, Convergencia, ImagenBase } from './diff-tipos';
import { esUrlEscribible } from './celdas-hoja';

export const esUrlDelBucket = (url: string | null, prefijo: string): url is string =>
  url !== null && url.startsWith(prefijo);

export interface DiffImagenesObra {
  imagenes: CambioImagen[];
  avisosImagen: AvisoImagen[];
  convergencias: Convergencia[];
}

/**
 * Una imagen pegada a mano es opaca: no se puede comparar con la de la web,
 * así que nunca se sobrescribe sin una decisión explícita.
 */
export function diffImagenes(
  fila: FilaHoja,
  obra: ObraBase,
  foto: ValoresFoto | undefined,
  prefijoBucket: string
): DiffImagenesObra {
  const r: DiffImagenesObra = { imagenes: [], avisosImagen: [], convergencias: [] };
  const enBase = [...obra.imagenes].sort((a, b) => a.id - b.id);
  for (let casilla = 1; casilla <= CASILLAS_IMAGEN; casilla++) {
    const leida: CasillaImagen = fila.imagenes[casilla - 1] ?? { tipo: 'vacia' };
    const imagen: ImagenBase | null = enBase[casilla - 1] ?? null;
    const clave = claveImagen(casilla);
    const fotoId = foto?.[clave] ?? null;
    const idBase = imagen?.id ?? null;
    const comun = { obraId: obra.id, fila: fila.fila, casilla, imagen, leida };
    const converger = () => {
      if (fotoId !== idBase) r.convergencias.push({ obraId: obra.id, clave, valor: idBase });
    };
    const escribir = (imagen: ImagenBase) => {
      if (esUrlEscribible(imagen.url, prefijoBucket)) r.imagenes.push({ ...comun, accion: 'escribir' });
      else r.avisosImagen.push({ ...comun, motivo: 'url_externa' });
    };

    if (leida.tipo === 'texto') {
      if (imagen && imagen.id !== fotoId) r.avisosImagen.push({ ...comun, motivo: 'casilla_con_texto' });
    } else if (leida.tipo === 'vacia') {
      if (imagen) escribir(imagen);
      else converger();
    } else if (leida.tipo === 'formula' && esUrlDelBucket(leida.url, prefijoBucket)) {
      if (!imagen) r.imagenes.push({ ...comun, accion: 'vaciar' });
      else if (leida.url !== imagen.url) escribir(imagen);
      else converger();
    } else if (idBase !== fotoId) {
      const motivo = !imagen ? 'borrada' : esUrlEscribible(imagen.url, prefijoBucket) ? 'reemplazada' : 'url_externa';
      r.avisosImagen.push({ ...comun, motivo });
    }
  }
  return r;
}
