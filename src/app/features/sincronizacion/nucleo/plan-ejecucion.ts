import { Campo, CAMPOS, CamposObra, CasillaImagen, FilaHoja } from './hoja-obras';
import { CASILLAS_IMAGEN, claveImagen, normalizarCampo, ValorCampo, ValoresFoto, valoresFoto } from './foto';
import { ObraBase } from './importacion';
import { normalizarTexto } from './normalizacion';
import { formulaImagen, valorParaHoja } from './celdas-hoja';
import { AvisoImagen, CambioImagen, Diff, Lado } from './diff-tipos';

export type DecisionImagen = 'reemplazar' | 'dejar';

export const claveCampo = (obraId: number, campo: string) => `${obraId}|${campo}`;
export const claveCargo = (clave: string) => `cargo|${clave}`;

export interface Decisiones {
  /** Por conflicto (`claveCampo`), el lado que se queda. */
  conflictos: ReadonlyMap<string, Lado>;
  /** Por persona, el cargo elegido. */
  conflictosCargo: ReadonlyMap<string, string | null>;
  avisosImagen: ReadonlyMap<string, DecisionImagen>;
  altasBase: ReadonlySet<number>;
  altasHoja: ReadonlySet<number>;
  /** Cambios no conflictivos que la persona desmarcó (`claveCampo` o `claveCargo`). */
  descartados: ReadonlySet<string>;
}

export function decisionesPorDefecto(diff: Diff): Decisiones {
  return {
    conflictos: new Map(),
    conflictosCargo: new Map(),
    avisosImagen: new Map(),
    altasBase: new Set(),
    altasHoja: new Set(diff.altasHoja.map((a) => a.obraId)),
    descartados: new Set(),
  };
}

export interface CampoABase {
  obra_id: number;
  campo: Campo;
  esperado: ValorCampo;
  nuevo: ValorCampo;
  cargo: string | null;
  foto: ValoresFoto;
}

export interface CargoABase {
  clave: string;
  esperado: string | null;
  nuevo: string | null;
  obras: number[];
  foto: ValoresFoto;
}

export interface AltaABase {
  fila: number;
  campos: CamposObra;
  foto: ValoresFoto;
}

export interface FotoDirecta {
  obra_id: number;
  valores: ValoresFoto;
}

export interface PeticionSincronizacion {
  campos: CampoABase[];
  cargos: CargoABase[];
  altas: AltaABase[];
  fotos: FotoDirecta[];
  hoja?: { etag: string };
}

export type DestinoHoja = { tipo: 'campo'; campo: Campo } | { tipo: 'imagen'; casilla: number } | { tipo: 'id_web' };

export interface EscrituraHoja {
  obraId: number;
  fila: number;
  destino: DestinoHoja;
  valor: string | number;
  leido: ValorCampo | CasillaImagen;
  foto: ValoresFoto;
}

export interface AltaEnHoja {
  obraId: number;
  celdas: { destino: DestinoHoja; valor: string | number }[];
  foto: ValoresFoto;
}

export interface PlanEjecucion {
  peticion: PeticionSincronizacion;
  escrituras: EscrituraHoja[];
  altasHoja: AltaEnHoja[];
  pendientes: number;
}

export interface ContextoPlan {
  obras: ReadonlyMap<number, ObraBase>;
  filas: ReadonlyMap<number, FilaHoja>;
  prefijoBucket: string;
}

interface CampoDecidido {
  obraId: number;
  fila: number;
  campo: Campo;
  hoja: ValorCampo;
  base: ValorCampo;
}

const enCampo = (campo: Campo): DestinoHoja => ({ tipo: 'campo', campo });

/**
 * La foto de lo que va a la hoja se registra solo después de escribirlo
 * (tarea 11): si la escritura falla, el campo reaparece en la siguiente
 * ejecución en vez de darse por sincronizado.
 */
export function planificarEjecucion(diff: Diff, decisiones: Decisiones, contexto: ContextoPlan): PlanEjecucion {
  const plan: PlanEjecucion = {
    peticion: { campos: [], cargos: [], altas: [], fotos: [] },
    escrituras: [],
    altasHoja: [],
    pendientes: 0,
  };
  const fotos = new Map<number, ValoresFoto>();
  const anotarFoto = (obraId: number, clave: string, valor: ValorCampo) =>
    fotos.set(obraId, { ...fotos.get(obraId), [clave]: valor });

  const escribirCampo = (obraId: number, fila: number, campo: Campo, valor: ValorCampo, leido: ValorCampo) =>
    plan.escrituras.push({
      obraId, fila, destino: enCampo(campo), valor: valorParaHoja(valor), leido,
      foto: { [campo]: normalizarCampo(campo, valor) },
    });

  const aplicarCampo = (c: CampoDecidido, destino: Lado) => {
    const cargoEnHoja = contexto.filas.get(c.fila)?.campos.cargo ?? null;
    if (destino === 'base') {
      plan.peticion.campos.push({
        obra_id: c.obraId, campo: c.campo, esperado: c.base, nuevo: c.hoja,
        cargo: c.campo === 'responsable' ? cargoEnHoja : null,
        foto: { [c.campo]: normalizarCampo(c.campo, c.hoja) },
      });
      return;
    }
    escribirCampo(c.obraId, c.fila, c.campo, c.base, c.hoja);
    if (c.campo === 'responsable' && !contexto.filas.get(c.fila)?.combinados.includes('cargo')) {
      escribirCampo(c.obraId, c.fila, 'cargo', contexto.obras.get(c.obraId)?.campos.cargo ?? null, cargoEnHoja);
    }
  };

  for (const cambio of diff.cambios) {
    if (!decisiones.descartados.has(claveCampo(cambio.obraId, cambio.campo))) aplicarCampo(cambio, cambio.destino);
  }
  for (const conflicto of diff.conflictos) {
    const seQueda = decisiones.conflictos.get(claveCampo(conflicto.obraId, conflicto.campo));
    if (seQueda === undefined) plan.pendientes++;
    else aplicarCampo(conflicto, seQueda === 'hoja' ? 'base' : 'hoja');
  }
  for (const c of diff.convergencias) anotarFoto(c.obraId, c.clave, c.valor);

  for (const cargo of diff.cargos) {
    if (decisiones.descartados.has(claveCargo(cargo.clave))) continue;
    if (cargo.destino === 'base') {
      plan.peticion.cargos.push({
        clave: cargo.clave, esperado: cargo.base, nuevo: cargo.hoja,
        obras: cargo.filas.map((f) => f.obraId), foto: { cargo: normalizarTexto(cargo.hoja) },
      });
    } else {
      for (const f of cargo.filas) escribirCampo(f.obraId, f.fila, 'cargo', cargo.base, f.cargo);
    }
  }
  for (const conflicto of diff.conflictosCargo) {
    if (!decisiones.conflictosCargo.has(conflicto.clave)) {
      plan.pendientes++;
      continue;
    }
    const elegido = decisiones.conflictosCargo.get(conflicto.clave) ?? null;
    const normalizado = normalizarTexto(elegido);
    const conElElegido = conflicto.filas.filter((f) => normalizarTexto(f.cargo) === normalizado);
    if (normalizarTexto(conflicto.base) !== normalizado) {
      plan.peticion.cargos.push({
        clave: conflicto.clave, esperado: conflicto.base, nuevo: elegido,
        obras: conElElegido.map((f) => f.obraId), foto: { cargo: normalizado },
      });
    } else {
      for (const f of conElElegido) anotarFoto(f.obraId, 'cargo', normalizado);
    }
    for (const f of conflicto.filas) {
      if (normalizarTexto(f.cargo) !== normalizado && !f.combinada) escribirCampo(f.obraId, f.fila, 'cargo', elegido, f.cargo);
    }
  }

  const escribirImagen = (i: CambioImagen | AvisoImagen) =>
    plan.escrituras.push({
      obraId: i.obraId, fila: i.fila, destino: { tipo: 'imagen', casilla: i.casilla },
      valor: i.imagen ? formulaImagen(i.imagen.url, contexto.prefijoBucket) : '',
      leido: i.leida, foto: { [claveImagen(i.casilla)]: i.imagen?.id ?? null },
    });
  for (const imagen of diff.imagenes) {
    if (!decisiones.descartados.has(claveCampo(imagen.obraId, claveImagen(imagen.casilla)))) escribirImagen(imagen);
  }
  for (const aviso of diff.avisosImagen) {
    const decision = decisiones.avisosImagen.get(claveCampo(aviso.obraId, claveImagen(aviso.casilla)));
    if (decision === 'dejar') anotarFoto(aviso.obraId, claveImagen(aviso.casilla), aviso.imagen?.id ?? null);
    else if (decision === 'reemplazar' && aviso.motivo !== 'casilla_con_texto') escribirImagen(aviso);
  }

  for (const alta of diff.altasBase) {
    if (decisiones.altasBase.has(alta.fila)) {
      plan.peticion.altas.push({ fila: alta.fila, campos: alta.campos, foto: valoresFoto(alta.campos, []) });
    }
  }
  for (const { obraId } of diff.altasHoja) {
    const obra = contexto.obras.get(obraId);
    if (!obra || !decisiones.altasHoja.has(obraId)) continue;
    const imagenes = [...obra.imagenes].sort((a, b) => a.id - b.id).slice(0, CASILLAS_IMAGEN);
    plan.altasHoja.push({
      obraId,
      celdas: [
        ...CAMPOS.map((campo) => ({ destino: enCampo(campo), valor: valorParaHoja(obra.campos[campo]) })),
        ...imagenes.map((im, i) => ({
          destino: { tipo: 'imagen', casilla: i + 1 } as DestinoHoja,
          valor: formulaImagen(im.url, contexto.prefijoBucket),
        })),
      ],
      foto: valoresFoto(obra.campos, imagenes.map((im) => im.id)),
    });
  }

  plan.peticion.fotos = [...fotos].map(([obra_id, valores]) => ({ obra_id, valores }));
  return plan;
}
