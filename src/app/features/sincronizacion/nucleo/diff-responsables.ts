import { Par } from './diff-filas';
import { compararCampo } from './diff-campos';
import {
  AvisoSincronizacion, CambioCargo, ConflictoCargo, Convergencia, FilaPersona, ResponsableBase,
} from './diff-tipos';
import { ValorCampo, ValoresFoto } from './foto';
import { claveNombre, normalizarTexto } from './normalizacion';

export interface DiffCargos {
  cargos: CambioCargo[];
  conflictosCargo: ConflictoCargo[];
  convergencias: Convergencia[];
  avisos: AvisoSincronizacion[];
}

interface Persona {
  responsable: ResponsableBase;
  filas: FilaPersona[];
  cargos: Map<string | null, string | null>;
}

export function diffCargos(
  pares: readonly Par[],
  responsables: readonly ResponsableBase[],
  fotos: ReadonlyMap<number, ValoresFoto>
): DiffCargos {
  const r: DiffCargos = { cargos: [], conflictosCargo: [], convergencias: [], avisos: [] };
  const enBase = new Map<string, ResponsableBase>();
  for (const responsable of responsables) {
    const clave = claveNombre(responsable.nombre);
    if (clave !== null) enBase.set(clave, responsable);
  }

  const personas = new Map<string, Persona>();
  for (const { fila, obra } of pares) {
    if (fila.noConvertibles.includes('responsable') || fila.noConvertibles.includes('cargo')) continue;
    const clave = claveNombre(fila.campos.responsable);
    if (clave === null) {
      if (normalizarTexto(fila.campos.cargo) !== null) {
        r.avisos.push({ tipo: 'cargo_sin_responsable', obraId: obra.id, fila: fila.fila });
      }
      continue;
    }
    const responsable = enBase.get(clave);
    if (!responsable) continue;
    const persona: Persona = personas.get(clave) ?? { responsable, filas: [], cargos: new Map() };
    persona.filas.push({
      fila: fila.fila, obraId: obra.id, cargo: fila.campos.cargo, combinada: fila.combinados.includes('cargo'),
    });
    const normalizado = normalizarTexto(fila.campos.cargo);
    if (!persona.cargos.has(normalizado)) persona.cargos.set(normalizado, fila.campos.cargo);
    personas.set(clave, persona);
  }

  const avisarCombinadas = (filas: readonly FilaPersona[]) => {
    for (const f of filas.filter((f) => f.combinada)) {
      r.avisos.push({ tipo: 'celda_combinada', obraId: f.obraId, fila: f.fila, campo: 'cargo' });
    }
  };

  for (const [clave, persona] of [...personas].sort(([a], [b]) => a.localeCompare(b))) {
    const nombre = persona.responsable.nombre;
    const base = persona.responsable.cargo;
    const foto = cargoEnFoto(clave, persona.filas, fotos);
    if (persona.cargos.size > 1) {
      r.conflictosCargo.push({ clave, nombre, opciones: [...persona.cargos.values()], base, foto, filas: persona.filas });
      avisarCombinadas(persona.filas);
      continue;
    }
    const hoja = [...persona.cargos.values()][0] ?? null;
    const comparacion = compararCampo('cargo', hoja, base, foto);
    if (comparacion.tipo === 'convergido') {
      for (const f of persona.filas) r.convergencias.push({ obraId: f.obraId, clave: 'cargo', valor: comparacion.valor });
    } else if (comparacion.tipo === 'conflicto') {
      r.conflictosCargo.push({ clave, nombre, opciones: [hoja, base], base, foto, filas: persona.filas });
      avisarCombinadas(persona.filas);
    } else if (comparacion.tipo === 'cambio') {
      let filas = persona.filas;
      if (comparacion.destino === 'hoja') {
        avisarCombinadas(filas);
        filas = filas.filter((f) => !f.combinada);
      }
      r.cargos.push({ clave, nombre, destino: comparacion.destino, hoja, base, foto: foto ?? null, filas });
    }
  }
  return r;
}

/** Solo cuentan las fotos de obras que la foto ya atribuía a esta persona. */
function cargoEnFoto(
  clave: string,
  filas: readonly FilaPersona[],
  fotos: ReadonlyMap<number, ValoresFoto>
): ValorCampo | undefined {
  const vistos = new Set<ValorCampo>();
  for (const { obraId } of filas) {
    const foto = fotos.get(obraId);
    if (foto && foto['responsable'] === clave && 'cargo' in foto) vistos.add(foto['cargo']);
  }
  return vistos.size === 1 ? [...vistos][0] : undefined;
}
