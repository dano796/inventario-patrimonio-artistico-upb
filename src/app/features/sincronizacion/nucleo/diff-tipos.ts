import { AvisoFila, Campo, CamposObra, CasillaImagen } from './hoja-obras';
import { ValorCampo } from './foto';
import type { ImagenPegada, ImagenRechazada } from './importacion';

export type Lado = 'hoja' | 'base';

export interface ImagenBase {
  id: number;
  url: string;
}

export interface ResponsableBase {
  id: number;
  nombre: string;
  cargo: string | null;
}

export interface CambioPropuesto {
  obraId: number;
  fila: number;
  campo: Campo;
  destino: Lado;
  hoja: ValorCampo;
  base: ValorCampo;
  foto: ValorCampo;
}

export interface Conflicto {
  obraId: number;
  fila: number;
  campo: Campo;
  hoja: ValorCampo;
  base: ValorCampo;
  foto: ValorCampo | undefined;
}

/** Los dos lados ya coinciden pero la foto no: solo hay que ponerla al día. */
export interface Convergencia {
  obraId: number;
  clave: string;
  valor: ValorCampo;
}

export interface FilaPersona {
  fila: number;
  obraId: number;
  cargo: string | null;
  combinada: boolean;
}

export interface CambioCargo {
  clave: string;
  nombre: string;
  destino: Lado;
  hoja: string | null;
  base: string | null;
  foto: ValorCampo;
  filas: FilaPersona[];
}

export interface ConflictoCargo {
  clave: string;
  nombre: string;
  opciones: (string | null)[];
  base: string | null;
  foto: ValorCampo | undefined;
  filas: FilaPersona[];
}

export interface CambioImagen {
  obraId: number;
  fila: number;
  casilla: number;
  accion: 'escribir' | 'vaciar';
  imagen: ImagenBase | null;
  leida: CasillaImagen;
}

/** `url_externa`: la imagen de la web no está en el bucket y no se puede escribir como =IMAGE(). */
export type MotivoAvisoImagen = 'reemplazada' | 'borrada' | 'casilla_con_texto' | 'url_externa';

export interface AvisoImagen {
  obraId: number;
  fila: number;
  casilla: number;
  motivo: MotivoAvisoImagen;
  imagen: ImagenBase | null;
  leida: CasillaImagen;
}

export interface AltaBase {
  fila: number;
  campos: CamposObra;
  imagenes: ImagenPegada[];
  imagenesRechazadas: ImagenRechazada[];
}

export interface AltaHoja {
  obraId: number;
}

export type AvisoSincronizacion =
  | { tipo: 'fila'; aviso: AvisoFila }
  | { tipo: 'id_duplicado'; idWeb: number; filas: number[] }
  | { tipo: 'id_desconocido'; idWeb: number; fila: number }
  | { tipo: 'obra_borrada_en_web'; idWeb: number; fila: number }
  | { tipo: 'fila_borrada'; obraId: number }
  | { tipo: 'celda_combinada'; obraId: number; fila: number; campo: Campo }
  | { tipo: 'cargo_sin_responsable'; obraId: number; fila: number };

export interface Diff {
  cambios: CambioPropuesto[];
  conflictos: Conflicto[];
  convergencias: Convergencia[];
  cargos: CambioCargo[];
  conflictosCargo: ConflictoCargo[];
  imagenes: CambioImagen[];
  avisosImagen: AvisoImagen[];
  altasBase: AltaBase[];
  altasHoja: AltaHoja[];
  avisos: AvisoSincronizacion[];
}

export const diffVacio = (): Diff => ({
  cambios: [],
  conflictos: [],
  convergencias: [],
  cargos: [],
  conflictosCargo: [],
  imagenes: [],
  avisosImagen: [],
  altasBase: [],
  altasHoja: [],
  avisos: [],
});
