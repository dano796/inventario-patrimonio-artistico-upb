export interface ObraTablero {
  id: number;
  titulo: string | null;
  autor: string | null;
  tecnica: string | null;
  ubicacion: string | null;
  responsable: string | null;
  fechaCreacion: string | null;
  imagenes: number;
}

export type Pendiente = 'autor' | 'tecnica' | 'responsable' | 'imagen';

export const PENDIENTES: readonly { clave: Pendiente; etiqueta: string }[] = [
  { clave: 'autor', etiqueta: 'Sin autor registrado' },
  { clave: 'tecnica', etiqueta: 'Sin técnica' },
  { clave: 'responsable', etiqueta: 'Sin responsable asignado' },
  { clave: 'imagen', etiqueta: 'Sin imagen' },
];

export interface UbicacionContada {
  nombre: string;
  obras: number;
  proporcion: number;
}

export interface ResumenTablero {
  total: number;
  nuevasEsteMes: number;
  ubicaciones: number;
  incompletas: number;
  porcentajeIncompletas: number;
  sinImagen: number;
  porUbicacion: UbicacionContada[];
  pendientes: Record<Pendiente, ObraTablero[]>;
}

const UBICACIONES_VISIBLES = 7;
const vacio = (valor: string | null) => valor === null || valor.trim() === '';

export function calcularTablero(obras: readonly ObraTablero[], hoy: Date): ResumenTablero {
  const pendientes: Record<Pendiente, ObraTablero[]> = { autor: [], tecnica: [], responsable: [], imagen: [] };
  const porUbicacion = new Map<string, number>();
  let nuevasEsteMes = 0;
  let incompletas = 0;

  for (const obra of obras) {
    const faltas: Pendiente[] = [];
    if (vacio(obra.autor)) faltas.push('autor');
    if (vacio(obra.tecnica)) faltas.push('tecnica');
    if (vacio(obra.responsable)) faltas.push('responsable');
    if (obra.imagenes === 0) faltas.push('imagen');
    faltas.forEach((falta) => pendientes[falta].push(obra));
    if (faltas.length) incompletas++;

    if (!vacio(obra.ubicacion)) {
      const nombre = obra.ubicacion!.trim().replace(/\s+/g, ' ');
      porUbicacion.set(nombre, (porUbicacion.get(nombre) ?? 0) + 1);
    }

    if (obra.fechaCreacion) {
      const fecha = new Date(obra.fechaCreacion);
      if (fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth()) nuevasEsteMes++;
    }
  }

  const ordenadas = [...porUbicacion].sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b, 'es'));
  const maximo = ordenadas[0]?.[1] ?? 0;
  return {
    total: obras.length,
    nuevasEsteMes,
    ubicaciones: porUbicacion.size,
    incompletas,
    porcentajeIncompletas: obras.length ? Math.round((incompletas * 100) / obras.length) : 0,
    sinImagen: pendientes.imagen.length,
    porUbicacion: ordenadas
      .slice(0, UBICACIONES_VISIBLES)
      .map(([nombre, n]) => ({ nombre, obras: n, proporcion: maximo ? n / maximo : 0 })),
    pendientes,
  };
}
