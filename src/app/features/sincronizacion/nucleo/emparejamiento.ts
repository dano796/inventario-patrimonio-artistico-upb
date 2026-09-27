import { FilaHoja } from './hoja-obras';
import { claveEmparejamiento } from './normalizacion';

export interface ObraExistente {
  id: number;
  autor: string | null;
  titulo: string | null;
}

export type Metodo = 'id-web' | 'exacto' | 'titulo' | 'ambiguo' | 'nueva';

export interface Emparejamiento {
  fila: number;
  autor: string | null;
  titulo: string | null;
  obraId: number | null;
  metodo: Metodo;
  candidatos: number[];
  revisado: boolean;
}

export interface ResultadoEmparejamiento {
  emparejamientos: Emparejamiento[];
  obrasSinFila: number[];
}

const GENERICOS = new Set(['', 'no registra', 'sin titulo', 'anonimo']);

type Clave = (autor: string | null, titulo: string | null) => string | null;

const claveAutorTitulo: Clave = (autor, titulo) => {
  const a = claveEmparejamiento(autor);
  const t = claveEmparejamiento(titulo);
  if (t === '' || t === 'no registra') return null;
  if (GENERICOS.has(t) && GENERICOS.has(a)) return null;
  return `${a}|${t}`;
};

const claveTitulo: Clave = (_autor, titulo) => {
  const t = claveEmparejamiento(titulo);
  return GENERICOS.has(t) ? null : t;
};

function agrupar<T>(elementos: T[], clave: (e: T) => string | null): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const e of elementos) {
    const k = clave(e);
    if (k !== null) grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }
  return grupos;
}

export function emparejar(filas: FilaHoja[], obras: ObraExistente[]): ResultadoEmparejamiento {
  const existentes = new Set(obras.map((o) => o.id));
  const asignadas = new Set<number>();
  const enDisputa = new Set<number>();
  const resultado = new Map<number, Emparejamiento>();
  const datos = (f: FilaHoja) => ({ fila: f.fila, autor: f.campos.autor, titulo: f.campos.titulo });

  for (const f of filas) {
    if (f.idWeb !== null && existentes.has(f.idWeb) && !asignadas.has(f.idWeb)) {
      asignadas.add(f.idWeb);
      resultado.set(f.fila, { ...datos(f), obraId: f.idWeb, metodo: 'id-web', candidatos: [], revisado: true });
    }
  }

  const pasada = (clave: Clave, metodo: 'exacto' | 'titulo') => {
    const libres = obras.filter((o) => !asignadas.has(o.id) && !enDisputa.has(o.id));
    const obrasPorClave = agrupar(libres, (o) => clave(o.autor, o.titulo));
    const filasPorClave = agrupar(
      filas.filter((f) => !resultado.has(f.fila)),
      (f) => clave(f.campos.autor, f.campos.titulo)
    );
    for (const [k, filasK] of filasPorClave) {
      const obrasK = obrasPorClave.get(k) ?? [];
      if (obrasK.length === 0) continue;
      if (obrasK.length === 1 && filasK.length === 1) {
        asignadas.add(obrasK[0].id);
        resultado.set(filasK[0].fila, {
          ...datos(filasK[0]), obraId: obrasK[0].id, metodo, candidatos: [], revisado: metodo === 'exacto',
        });
        continue;
      }
      for (const o of obrasK) enDisputa.add(o.id);
      for (const f of filasK) {
        resultado.set(f.fila, {
          ...datos(f), obraId: null, metodo: 'ambiguo', candidatos: obrasK.map((o) => o.id), revisado: false,
        });
      }
    }
  };
  pasada(claveAutorTitulo, 'exacto');
  pasada(claveTitulo, 'titulo');

  for (const f of filas) {
    if (!resultado.has(f.fila)) {
      resultado.set(f.fila, { ...datos(f), obraId: null, metodo: 'nueva', candidatos: [], revisado: true });
    }
  }
  return {
    emparejamientos: filas.map((f) => resultado.get(f.fila)!),
    obrasSinFila: obras.filter((o) => !asignadas.has(o.id) && !enDisputa.has(o.id)).map((o) => o.id),
  };
}

export function validarEmparejamiento(emparejamientos: Emparejamiento[], obras: ObraExistente[]): string[] {
  const existentes = new Set(obras.map((o) => o.id));
  const filaDeObra = new Map<number, number>();
  const errores: string[] = [];
  for (const e of emparejamientos) {
    if (!e.revisado) errores.push(`Fila ${e.fila}: falta revisar el emparejamiento (${e.metodo})`);
    if (e.obraId === null) continue;
    const otra = filaDeObra.get(e.obraId);
    if (otra !== undefined) errores.push(`Filas ${otra} y ${e.fila}: las dos apuntan a la obra ${e.obraId}`);
    else filaDeObra.set(e.obraId, e.fila);
    if (!existentes.has(e.obraId)) errores.push(`Fila ${e.fila}: la obra ${e.obraId} no existe`);
  }
  return errores;
}
