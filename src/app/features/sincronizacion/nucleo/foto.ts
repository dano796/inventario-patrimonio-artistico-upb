import { CAMPOS, CamposObra } from './hoja-obras';
import { claveNombre, normalizarTexto } from './normalizacion';

export const CASILLAS_IMAGEN = 3;

export type ValoresFoto = Record<string, string | number | null>;

/**
 * Forma de `sincronizacion_estado.valores`. La escribe la importación y la
 * sincronización compara contra ella: cambiarla invalida las fotos guardadas.
 */
export function valoresFoto(campos: CamposObra, imagenIds: readonly (number | null)[]): ValoresFoto {
  const foto: ValoresFoto = {};
  for (const campo of CAMPOS) {
    const valor = campos[campo];
    foto[campo] =
      typeof valor !== 'string' ? valor : campo === 'responsable' ? claveNombre(valor) : normalizarTexto(valor);
  }
  for (let i = 0; i < CASILLAS_IMAGEN; i++) foto[`imagen_${i + 1}`] = imagenIds[i] ?? null;
  return foto;
}
