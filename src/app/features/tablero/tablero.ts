import { DATOS_FALTANTES, DatoFaltante } from '../../shared/models/artwork.model';

export interface ObraTablero {
  id: number;
  titulo: string | null;
  autor: string | null;
  tecnica: string | null;
  ano: number | null;
  valor: number | null;
  ubicacion: string | null;
  bloque: string | null;
  responsable: string | null;
  fechaCreacion: string | null;
  imagenes: number;
}

export type Pendiente = DatoFaltante;

export const PENDIENTES: readonly { clave: Pendiente; campo: string; etiqueta: string }[] = (
  [['autor', 'Autor'], ['tecnica', 'Técnica'], ['bloque', 'Bloque asignado'], ['responsable', 'Responsable'], ['imagen', 'Imagen']] as const
).map(([clave, campo]) => ({ clave, campo, etiqueta: DATOS_FALTANTES[clave] }));

export interface UbicacionContada {
  /** null agrupa las obras del bloque que no tienen ubicación. */
  nombre: string | null;
  obras: number;
  proporcion: number;
  fichas: ObraTablero[];
}

export interface BloqueContado {
  numero: number;
  nombre: string | null;
  obras: number;
  proporcion: number;
  lugares: UbicacionContada[];
}

/** Bloques que la comunidad conoce por el nombre del edificio y no por el número. */
export const NOMBRES_BLOQUE: Readonly<Record<number, string>> = {
  1: 'Templo Universitario',
  3: 'Bloque Rectoral',
  4: 'Colegio UPB',
  15: 'Biblioteca Central',
};

/** La hoja escribe «BLOQUE 15», y a veces con erratas («BLOOQUE 3»). */
export function numeroDeBloque(valor: string | null): number | null {
  const numero = valor?.match(/^\s*b\S*\s*(\d+)\s*$/i);
  return numero ? Number(numero[1]) : null;
}

export interface ResumenTablero {
  total: number;
  nuevasEsteMes: number;
  incompletas: number;
  porcentajeIncompletas: number;
  sinImagen: number;
  porBloque: BloqueContado[];
  sinBloque: number;
  pendientes: Record<Pendiente, ObraTablero[]>;
  valorTotal: number;
  sinValor: number;
  coleccion: Coleccion;
}

export interface Conteo {
  nombre: string;
  obras: number;
  /** Respecto al grupo más grande, para el largo de la barra. */
  proporcion: number;
}

export interface Ranking {
  primeros: Conteo[];
  /** Grupos que no entran en los primeros. */
  resto: number;
  /** Obras que tienen el dato. */
  conDato: number;
}

export interface Coleccion {
  tecnicas: Ranking;
  autores: Ranking;
  /** En orden cronológico; la primera puede agrupar todas las décadas antiguas. */
  epocas: Conteo[];
  conAno: number;
}

const EN_RANKING = 6;
const DECADAS_SUELTAS = 5;

const vacio = (valor: string | null) => valor === null || valor.trim() === '';

const porTitulo = (a: ObraTablero, b: ObraTablero) =>
  (a.titulo?.trim() ? 0 : 1) - (b.titulo?.trim() ? 0 : 1) || (a.titulo ?? '').localeCompare(b.titulo ?? '', 'es', { numeric: true }) || a.id - b.id;

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '');
const mayuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);

/** La hoja trae nombres escritos todo en mayúsculas («RICARDO DISEÑO GRAFICO»): se muestran con mayúscula inicial. */
export function sinMayusculasSostenidas(texto: string): string {
  if (texto !== texto.toLocaleUpperCase('es') || !/\p{L}{2}/u.test(texto)) return texto;
  return texto.toLocaleLowerCase('es').replace(/(^|[\s('"-])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase('es'));
}

/**
 * La hoja escribe la misma técnica de muchas formas («Óleo», «Oleo sobre lienzo», «Óleo sobre tela»): se agrupa por su
 * primera palabra, sin tildes ni plural. Lo que no nombra una técnica («No tiene», un año) no cuenta.
 */
export function familiaTecnica(tecnica: string | null): [clave: string, nombre: string] | null {
  if (vacio(tecnica)) return null;
  const texto = tecnica!.trim().toLocaleLowerCase('es');
  if (sinTildes(texto).includes('fotogr')) return ['fotografia', 'Fotografía'];
  const palabra = texto.split(/[\s,.;:()/-]+/).find((p) => p !== '');
  if (!palabra || /^\d+$/.test(palabra) || palabra === 'no') return null;
  const clave = sinTildes(palabra).replace(/s$/, '');
  if (clave === 'mixta') return [clave, 'Técnica mixta'];
  if (clave === 'repoduccion') return ['reproduccion', 'Reproducción'];
  return [clave, mayuscula(palabra.replace(/s$/, ''))];
}

/** Cuenta por clave y nombra cada grupo con la grafía más usada. */
function contar(pares: readonly [clave: string, nombre: string][]): Conteo[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const [clave, nombre] of pares) {
    const grafias = grupos.get(clave) ?? new Map<string, number>();
    grafias.set(nombre, (grafias.get(nombre) ?? 0) + 1);
    grupos.set(clave, grafias);
  }
  const conteos = [...grupos.values()]
    .map((grafias) => ({
      nombre: [...grafias].reduce((masUsada, actual) => (actual[1] > masUsada[1] ? actual : masUsada))[0],
      obras: [...grafias.values()].reduce((suma, n) => suma + n, 0),
    }))
    .sort((a, b) => b.obras - a.obras || a.nombre.localeCompare(b.nombre, 'es'));
  const maximo = conteos[0]?.obras ?? 0;
  return conteos.map((c) => ({ ...c, proporcion: c.obras / maximo }));
}

function ranking(pares: readonly [string, string][]): Ranking {
  const todos = contar(pares);
  return { primeros: todos.slice(0, EN_RANKING), resto: Math.max(0, todos.length - EN_RANKING), conDato: pares.length };
}

/** Las últimas décadas con obras van sueltas; las anteriores se suman en «Antes de …». */
function epocas(anos: readonly number[]): Conteo[] {
  const porDecada = new Map<number, number>();
  for (const ano of anos) porDecada.set(Math.floor(ano / 10) * 10, (porDecada.get(Math.floor(ano / 10) * 10) ?? 0) + 1);
  const decadas = [...porDecada].sort(([a], [b]) => a - b);
  if (!decadas.length) return [];
  const desde = Math.max(decadas[0][0], decadas[decadas.length - 1][0] - (DECADAS_SUELTAS - 1) * 10);
  const antiguas = decadas.filter(([d]) => d < desde).reduce((suma, [, n]) => suma + n, 0);
  const lista = [
    ...(antiguas ? [{ nombre: `Antes de ${desde}`, obras: antiguas }] : []),
    ...decadas.filter(([d]) => d >= desde).map(([d, n]) => ({ nombre: String(d), obras: n })),
  ];
  const maximo = Math.max(...lista.map((e) => e.obras));
  return lista.map((e) => ({ ...e, proporcion: e.obras / maximo }));
}

/** Agrupa por ubicación sin distinguir mayúsculas ni espacios y nombra cada grupo con la grafía más usada; las obras sin ubicación van al final. */
function agruparLugares(obras: readonly ObraTablero[]): UbicacionContada[] {
  const grupos = new Map<string, { grafias: Map<string, number>; fichas: ObraTablero[] }>();
  const sinUbicacion: ObraTablero[] = [];
  for (const obra of obras) {
    if (vacio(obra.ubicacion)) {
      sinUbicacion.push(obra);
      continue;
    }
    const nombre = obra.ubicacion!.trim().replace(/\s+/g, ' ');
    const clave = nombre.toLocaleLowerCase('es');
    const grupo = grupos.get(clave) ?? { grafias: new Map<string, number>(), fichas: [] };
    grupo.grafias.set(nombre, (grupo.grafias.get(nombre) ?? 0) + 1);
    grupo.fichas.push(obra);
    grupos.set(clave, grupo);
  }
  const contar = (nombre: string | null, fichas: ObraTablero[]): UbicacionContada => ({
    nombre,
    obras: fichas.length,
    proporcion: fichas.length / obras.length,
    fichas: [...fichas].sort(porTitulo),
  });
  const lugares = [...grupos.values()]
    .map(({ grafias, fichas }) => contar([...grafias].reduce((masUsada, actual) => (actual[1] > masUsada[1] ? actual : masUsada))[0], fichas))
    .sort((a, b) => b.obras - a.obras || a.nombre!.localeCompare(b.nombre!, 'es'));
  return sinUbicacion.length ? [...lugares, contar(null, sinUbicacion)] : lugares;
}

export function calcularTablero(obras: readonly ObraTablero[], hoy: Date): ResumenTablero {
  const pendientes: Record<Pendiente, ObraTablero[]> = { autor: [], tecnica: [], bloque: [], responsable: [], imagen: [] };
  const porBloque = new Map<number, ObraTablero[]>();
  let nuevasEsteMes = 0;
  let incompletas = 0;

  for (const obra of obras) {
    const faltas: Pendiente[] = [];
    if (vacio(obra.autor)) faltas.push('autor');
    if (vacio(obra.tecnica)) faltas.push('tecnica');
    const bloque = numeroDeBloque(obra.bloque);
    if (bloque === null) faltas.push('bloque');
    else porBloque.set(bloque, [...(porBloque.get(bloque) ?? []), obra]);
    if (vacio(obra.responsable)) faltas.push('responsable');
    if (obra.imagenes === 0) faltas.push('imagen');
    faltas.forEach((falta) => pendientes[falta].push(obra));
    if (faltas.length) incompletas++;

    if (obra.fechaCreacion) {
      const fecha = new Date(obra.fechaCreacion);
      if (fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth()) nuevasEsteMes++;
    }
  }

  const bloques = [...porBloque].sort(([a, oa], [b, ob]) => ob.length - oa.length || a - b);
  const maximo = bloques[0]?.[1].length ?? 0;
  return {
    total: obras.length,
    nuevasEsteMes,
    incompletas,
    porcentajeIncompletas: obras.length ? Math.round((incompletas * 100) / obras.length) : 0,
    sinImagen: pendientes.imagen.length,
    porBloque: bloques.map(([numero, suyas]) => {
      return {
        numero,
        nombre: NOMBRES_BLOQUE[numero] ?? null,
        obras: suyas.length,
        proporcion: suyas.length / maximo,
        lugares: agruparLugares(suyas),
      };
    }),
    sinBloque: pendientes.bloque.length,
    pendientes,
    valorTotal: obras.reduce((suma, o) => suma + (o.valor ?? 0), 0),
    sinValor: obras.filter((o) => !o.valor).length,
    coleccion: {
      tecnicas: ranking(obras.map((o) => familiaTecnica(o.tecnica)).filter((p): p is [string, string] => p !== null)),
      autores: ranking(
        obras.filter((o) => !vacio(o.autor)).map((o): [string, string] => {
          const nombre = o.autor!.trim().replace(/\s+/g, ' ');
          return [sinTildes(nombre.toLocaleLowerCase('es')), sinMayusculasSostenidas(nombre)];
        })
      ),
      epocas: epocas(obras.flatMap((o) => (o.ano ? [o.ano] : []))),
      conAno: obras.filter((o) => o.ano).length,
    },
  };
}
