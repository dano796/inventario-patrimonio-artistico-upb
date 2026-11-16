import { Emparejamiento } from './emparejamiento';
import { AvisoFila, Campo, CAMPOS, CamposObra, FilaHoja } from './hoja-obras';
import { claveNombre, MOTIVO_OTRA_MONEDA, normalizarTexto } from './normalizacion';

export interface ObraBase {
  id: number;
  campos: CamposObra;
  imagenes: { id: number; url: string }[];
}
export interface CambioCampo {
  campo: Campo;
  base: string | number | null;
  hoja: string | number | null;
}
export interface Actualizacion {
  fila: number;
  obraId: number;
  valores: Partial<CamposObra>;
  cambios: CambioCampo[];
}
export interface Alta {
  fila: number;
  valores: CamposObra;
}
export interface ImagenAImportar {
  fila: number;
  obraId: number | null;
  casilla: number;
  archivo: string;
}
export interface ImagenRechazada {
  fila: number;
  casilla: number;
  archivo: string | null;
  motivo: string;
}
export interface ResponsableHoja {
  clave: string;
  nombre: string;
  cargo: string | null;
}
export interface CargoEnConflicto {
  nombre: string;
  cargos: string[];
  filas: number[];
}
export interface Excepcion {
  obraId: number;
  campo: Campo;
}
export interface CampoConservado {
  fila: number;
  obraId: number;
  campo: Campo;
}
export interface PlanImportacion {
  responsables: ResponsableHoja[];
  cargosEnConflicto: CargoEnConflicto[];
  actualizaciones: Actualizacion[];
  altas: Alta[];
  imagenes: ImagenAImportar[];
  imagenesRechazadas: ImagenRechazada[];
  conservados: CampoConservado[];
  avisos: AvisoFila[];
  obrasSinFila: number[];
}
export interface EntradaImportacion {
  filas: FilaHoja[];
  avisos: AvisoFila[];
  emparejamientos: Emparejamiento[];
  obras: ObraBase[];
  obrasSinFila: number[];
  excepciones?: Excepcion[];
  tamanos?: Record<string, number>;
}

export const LIMITE_IMAGEN = 5 * 1024 * 1024;
const FORMATOS_BUCKET = /\.(jpe?g|png|webp)$/i;

interface Persona {
  nombre: string;
  cargos: Map<string, string>;
  filas: number[];
}

export function planificarImportacion(entrada: EntradaImportacion): PlanImportacion {
  const obras = new Map(entrada.obras.map((o) => [o.id, o]));
  const destino = new Map(entrada.emparejamientos.map((e) => [e.fila, e.obraId]));
  const excepciones = new Set((entrada.excepciones ?? []).map((e) => `${e.obraId}|${e.campo}`));
  const personas = new Map<string, Persona>();
  const plan: PlanImportacion = {
    responsables: [], cargosEnConflicto: [], actualizaciones: [], altas: [],
    imagenes: [], imagenesRechazadas: [], conservados: [],
    avisos: entrada.avisos, obrasSinFila: entrada.obrasSinFila,
  };

  for (const fila of entrada.filas) {
    const moneda = entrada.avisos.some(
      (a) => a.fila === fila.fila && a.campo === 'valor' && a.motivo === MOTIVO_OTRA_MONEDA
    );
    const valores: CamposObra = { ...fila.campos };
    registrarPersona(personas, fila.fila, valores);

    const obraId = destino.get(fila.fila) ?? null;
    const obra = obraId === null ? undefined : obras.get(obraId);
    if (!obra) {
      plan.altas.push({ fila: fila.fila, valores });
      planificarImagenes(plan, fila, null, entrada.tamanos ?? {});
      continue;
    }

    const aplicar: Partial<CamposObra> = {};
    const cambios: CambioCampo[] = [];
    for (const campo of CAMPOS) {
      const noConvertible = fila.noConvertibles.includes(campo) && !(campo === 'valor' && moneda);
      if (noConvertible || excepciones.has(`${obra.id}|${campo}`)) continue;
      const esOtraMoneda = campo === 'valor' && moneda;
      if (valores[campo] === null && obra.campos[campo] !== null && !esOtraMoneda) {
        plan.conservados.push({ fila: fila.fila, obraId: obra.id, campo });
        continue;
      }
      if (iguales(campo, obra.campos[campo], valores[campo])) continue;
      cambios.push({ campo, base: obra.campos[campo], hoja: valores[campo] });
      (aplicar as Record<Campo, unknown>)[campo] = valores[campo];
    }
    if (cambios.length) plan.actualizaciones.push({ fila: fila.fila, obraId: obra.id, valores: aplicar, cambios });
    if (obra.imagenes.length === 0) planificarImagenes(plan, fila, obra.id, entrada.tamanos ?? {});
  }

  for (const [clave, persona] of personas) {
    const cargos = [...persona.cargos.values()];
    plan.responsables.push({ clave, nombre: persona.nombre, cargo: cargos[0] ?? null });
    if (cargos.length > 1) plan.cargosEnConflicto.push({ nombre: persona.nombre, cargos, filas: persona.filas });
  }
  return plan;
}

function iguales(campo: Campo, a: string | number | null, b: string | number | null): boolean {
  if (typeof a === 'number' || typeof b === 'number') return a === b;
  return campo === 'responsable' ? claveNombre(a) === claveNombre(b) : normalizarTexto(a) === normalizarTexto(b);
}

function registrarPersona(personas: Map<string, Persona>, fila: number, valores: CamposObra): void {
  const clave = claveNombre(valores.responsable);
  if (clave === null || valores.responsable === null) return;
  const persona: Persona = personas.get(clave) ?? { nombre: valores.responsable, cargos: new Map(), filas: [] };
  const cargo = normalizarTexto(valores.cargo);
  if (cargo !== null && valores.cargo !== null && !persona.cargos.has(cargo)) persona.cargos.set(cargo, valores.cargo);
  persona.filas.push(fila);
  personas.set(clave, persona);
}

function planificarImagenes(
  plan: PlanImportacion,
  fila: FilaHoja,
  obraId: number | null,
  tamanos: Record<string, number>
): void {
  const { aceptadas, rechazadas } = clasificarImagenes(fila, tamanos);
  plan.imagenes.push(...aceptadas.map((a) => ({ fila: fila.fila, obraId, ...a })));
  plan.imagenesRechazadas.push(...rechazadas);
}

export interface ImagenPegada {
  casilla: number;
  archivo: string;
}

export function clasificarImagenes(
  fila: FilaHoja,
  tamanos: Record<string, number>
): { aceptadas: ImagenPegada[]; rechazadas: ImagenRechazada[] } {
  const aceptadas: ImagenPegada[] = [];
  const rechazadas: ImagenRechazada[] = [];
  fila.imagenes.forEach((casilla, indice) => {
    if (casilla.tipo !== 'pegada') return;
    const rechazar = (motivo: string) =>
      rechazadas.push({ fila: fila.fila, casilla: indice + 1, archivo: casilla.archivo, motivo });
    if (!casilla.archivo) return void rechazar('no se encontró el archivo de la imagen');
    if (!FORMATOS_BUCKET.test(casilla.archivo)) return void rechazar('formato no admitido por el bucket');
    if ((tamanos[casilla.archivo] ?? 0) > LIMITE_IMAGEN) return void rechazar('supera los 5 MB del bucket');
    aceptadas.push({ casilla: indice + 1, archivo: casilla.archivo });
  });
  return { aceptadas, rechazadas };
}
