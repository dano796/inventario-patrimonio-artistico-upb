import { Responsable } from '../../../shared/models/responsable.model';
import { claveEmparejamiento, claveNombre } from '../../sincronizacion/nucleo/normalizacion';

const palabras = (texto: string | null) => claveEmparejamiento(texto).split(' ').filter(Boolean);
const porNombre = (a: Responsable, b: Responsable) => claveEmparejamiento(a.nombre).localeCompare(claveEmparejamiento(b.nombre));

export function filtrarResponsables(texto: string, responsables: Responsable[]): Responsable[] {
  const buscadas = palabras(texto);
  return responsables
    .filter((r) => {
      const propias = palabras(`${r.nombre} ${r.cargo ?? ''}`);
      return buscadas.every((b) => propias.some((p) => p.startsWith(b)));
    })
    .sort(porNombre);
}

export function responsablesParecidos(nombre: string, responsables: Responsable[], maximo = 3): Responsable[] {
  const buscadas = new Set(palabras(nombre).filter((p) => p.length >= 3));
  if (buscadas.size === 0) return [];
  return responsables
    .map((r) => ({ r, comunes: palabras(r.nombre).filter((p) => buscadas.has(p)).length }))
    .filter((x) => x.comunes > 0)
    .sort((a, b) => b.comunes - a.comunes || porNombre(a.r, b.r))
    .slice(0, maximo)
    .map((x) => x.r);
}

export function buscarPorNombre(nombre: string, responsables: Responsable[]): Responsable | undefined {
  const clave = claveNombre(nombre);
  return clave === null ? undefined : responsables.find((r) => claveNombre(r.nombre) === clave);
}
