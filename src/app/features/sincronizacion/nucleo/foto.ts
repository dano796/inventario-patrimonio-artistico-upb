import { Campo, CAMPOS, CamposObra } from './hoja-obras';
import { claveNombre, normalizarTexto } from './normalizacion';

export const CASILLAS_IMAGEN = 3;

export type ValorCampo = string | number | null;
export type ValoresFoto = Record<string, ValorCampo>;

export function normalizarCampo(campo: Campo, valor: ValorCampo): ValorCampo {
  if (typeof valor !== 'string') return valor;
  return campo === 'responsable' ? claveNombre(valor) : normalizarTexto(valor);
}

export function camposFoto(campos: CamposObra): ValoresFoto {
  const foto: ValoresFoto = {};
  for (const campo of CAMPOS) foto[campo] = normalizarCampo(campo, campos[campo]);
  return foto;
}

export const claveImagen = (casilla: number) => `imagen_${casilla}`;

/**
 * Forma de `sincronizacion_estado.valores`. La escribe la importación y la
 * sincronización compara contra ella: cambiarla invalida las fotos guardadas.
 */
export function valoresFoto(campos: CamposObra, imagenIds: readonly (number | null)[]): ValoresFoto {
  const foto = camposFoto(campos);
  for (let i = 0; i < CASILLAS_IMAGEN; i++) foto[claveImagen(i + 1)] = imagenIds[i] ?? null;
  return foto;
}
