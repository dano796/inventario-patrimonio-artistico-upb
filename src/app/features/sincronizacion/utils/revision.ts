import { Calculo } from '../services/sincronizacion.service';
import { AvisoImagen, CambioCargo, CambioImagen, Conflicto, ConflictoCargo, Diff, Lado } from '../nucleo/diff-tipos';
import { AvisoFila, Campo, CAMPOS, CasillaImagen, ENCABEZADO_ID_WEB, ENCABEZADOS, FilaHoja } from '../nucleo/hoja-obras';
import { claveImagen, ValorCampo } from '../nucleo/foto';
import { ObraBase } from '../nucleo/importacion';
import { claveCampo, claveCargo, DecisionImagen, Decisiones } from '../nucleo/plan-ejecucion';
import { normalizarTexto } from '../nucleo/normalizacion';

export interface EstadoRevision {
  descartados: ReadonlySet<string>;
  /** Por conflicto, el lado que se queda. */
  conflictos: ReadonlyMap<string, Lado>;
  conflictosCargo: ReadonlyMap<string, string | null>;
  avisosImagen: ReadonlyMap<string, DecisionImagen>;
  /** Una fila ausente está sin decidir: a diferencia de `Decisiones`, aquí bloquea. */
  altasBase: ReadonlyMap<number, boolean>;
  altasHojaIgnoradas: ReadonlySet<number>;
}

export const estadoInicial = (): EstadoRevision => ({
  descartados: new Set(),
  conflictos: new Map(),
  conflictosCargo: new Map(),
  avisosImagen: new Map(),
  altasBase: new Map(),
  altasHojaIgnoradas: new Set(),
});

export type RefDecision =
  | { tipo: 'descartado'; clave: string }
  | { tipo: 'conflicto'; clave: string }
  | { tipo: 'cargo'; clave: string }
  | { tipo: 'imagen'; clave: string }
  | { tipo: 'altaBase'; fila: number }
  | { tipo: 'altaHoja'; obraId: number };

export interface Opcion {
  valor: string;
  etiqueta: string;
  elegida: boolean;
}

export interface Celda {
  texto: string;
  vacio: boolean;
  miniatura?: string;
}

export type AccionFila =
  | { tipo: 'casilla'; destino: Lado; incluido: boolean; ref: RefDecision }
  | { tipo: 'opciones'; opciones: Opcion[]; ref: RefDecision }
  | { tipo: 'fuera'; enlaceObra?: number };

export interface FilaRevision {
  clave: string;
  campo: string;
  hoja: Celda;
  base: Celda;
  gana: Lado | null;
  accion: AccionFila;
  nota: string | null;
  notaAmbar: boolean;
  pendiente: boolean;
}

export type Filtro = 'todo' | 'conflictos' | 'base' | 'hoja' | 'presencia' | 'avisos';

export interface GrupoRevision {
  clave: string;
  tipo: 'obra' | 'persona' | 'presencia';
  numero: string;
  titulo: string;
  etiqueta: string;
  tono: 'acento' | 'ambar' | 'neutro';
  pendiente: boolean;
  filas: FilaRevision[];
  resumen: string | null;
  opciones: Opcion[];
  ref: RefDecision | null;
  filtros: Filtro[];
}

export interface NoSeToca {
  clave: string;
  tipo: string;
  titulo: string;
  detalle: string;
}

export interface Revision {
  grupos: GrupoRevision[];
  noSeTocan: NoSeToca[];
  resumen: { haciaBase: number; haciaHoja: number; filasNuevas: number; pendientes: number };
  pendientes: { conflictos: number; altas: number };
  filtros: { filtro: Filtro; etiqueta: string; cuenta: number }[];
}

const ETIQUETAS_FILTRO: Record<Filtro, string> = {
  todo: 'Todo', conflictos: 'Conflictos', base: 'A la base', hoja: 'A la hoja', presencia: 'Altas y bajas', avisos: 'Avisos',
};

const ORDEN_NO_SE_TOCA = ['ID duplicado', 'ID desconocido', 'Celda ilegible'];
const VACIO: Celda = { texto: '—', vacio: true };
const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? '' : 's'}`;
const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export function textoValor(campo: string, valor: ValorCampo | undefined): Celda {
  if (valor === null || valor === undefined || valor === '') return VACIO;
  if (campo === 'valor' && typeof valor === 'number') return { texto: `$${pesos.format(valor)}`, vacio: false };
  return { texto: String(valor), vacio: false };
}

function textoCasilla(leida: CasillaImagen): Celda {
  switch (leida.tipo) {
    case 'vacia': return { texto: 'Vacía', vacio: true };
    case 'formula': return { texto: 'Imagen escrita por la sincronización', vacio: false };
    case 'pegada': return { texto: 'Imagen pegada a mano', vacio: false };
    case 'texto': return { texto: leida.valor, vacio: false };
  }
}

const encabezado = (campo: AvisoFila['campo']) =>
  campo === 'id_web' ? ENCABEZADO_ID_WEB : campo.startsWith('imagen_') ? `IMAGEN ${campo.slice(7)}` : ENCABEZADOS[campo as Campo];

const tituloObra = (obra: ObraBase | undefined, fila?: FilaHoja) =>
  obra?.campos.titulo?.trim() || fila?.campos.titulo?.trim() || 'Sin título';

const esCampo = (campo: string): campo is Campo => (CAMPOS as readonly string[]).includes(campo);

export function construirRevision(calculo: Calculo, estado: EstadoRevision): Revision {
  const { diff } = calculo;
  const obraDe = new Map(calculo.obras.map((o) => [o.id, o]));
  const filaDe = new Map(calculo.lectura.filas.map((f) => [f.fila, f]));
  const duplicados = new Set(diff.avisos.flatMap((a) => (a.tipo === 'id_duplicado' ? [a.idWeb] : [])));
  const filasAlta = new Set(diff.altasBase.map((a) => a.fila));
  const resumen = { haciaBase: 0, haciaHoja: 0, filasNuevas: 0, pendientes: 0 };
  const pendientes = { conflictos: 0, altas: 0 };
  const contar = (lado: Lado) => (lado === 'base' ? resumen.haciaBase++ : resumen.haciaHoja++);

  const filasObra = new Map<number, FilaRevision[]>();
  const anadirAObra = (obraId: number, fila: FilaRevision) => filasObra.set(obraId, [...(filasObra.get(obraId) ?? []), fila]);
  const filasDeAlta = new Map<number, FilaRevision[]>();
  const noSeTocan: NoSeToca[] = [];

  const filaCambio = (clave: string, campo: string, destino: Lado, hoja: Celda, base: Celda): FilaRevision => {
    const incluido = !estado.descartados.has(clave);
    if (incluido) contar(destino);
    return {
      clave, campo, hoja, base, gana: incluido ? (destino === 'base' ? 'hoja' : 'base') : null,
      accion: { tipo: 'casilla', destino, incluido, ref: { tipo: 'descartado', clave } },
      nota: null, notaAmbar: false, pendiente: false,
    };
  };
  const filaFuera = (clave: string, campo: string, hoja: Celda, base: Celda, nota: string, enlaceObra?: number): FilaRevision => ({
    clave, campo, hoja, base, gana: null, accion: enlaceObra ? { tipo: 'fuera', enlaceObra } : { tipo: 'fuera' },
    nota, notaAmbar: false, pendiente: false,
  });

  for (const c of diff.cambios) {
    anadirAObra(c.obraId, filaCambio(claveCampo(c.obraId, c.campo), c.campo, c.destino, textoValor(c.campo, c.hoja), textoValor(c.campo, c.base)));
  }
  for (const c of diff.conflictos) anadirAObra(c.obraId, filaConflicto(c, estado, contar, pendientes));
  for (const i of diff.imagenes) anadirAObra(i.obraId, filaImagen(i, filaCambio));
  for (const a of diff.avisosImagen) anadirAObra(a.obraId, filaAvisoImagen(a, estado, contar, filaFuera));

  for (const aviso of diff.avisos) {
    if (aviso.tipo === 'celda_combinada' || aviso.tipo === 'cargo_sin_responsable') {
      const campo: Campo = aviso.tipo === 'celda_combinada' ? aviso.campo : 'cargo';
      const nota = aviso.tipo === 'celda_combinada'
        ? 'La celda está combinada en la hoja: el cambio de la web no se escribe en ella.'
        : 'La fila tiene cargo pero no responsable: el cargo no se sincroniza.';
      anadirAObra(aviso.obraId, filaFuera(
        `${aviso.tipo}|${aviso.obraId}|${campo}`, campo,
        textoValor(campo, filaDe.get(aviso.fila)?.campos[campo]), textoValor(campo, obraDe.get(aviso.obraId)?.campos[campo]), nota
      ));
    } else if (aviso.tipo === 'fila') {
      const a = aviso.aviso;
      const fila = filaDe.get(a.fila);
      const obra = fila?.idWeb != null && !duplicados.has(fila.idWeb) ? obraDe.get(fila.idWeb) : undefined;
      const destinoAlta = filasAlta.has(a.fila);
      if (a.campo !== 'id_web' && (obra || destinoAlta)) {
        const nueva = filaFuera(
          `fila|${a.fila}|${a.campo}`, a.campo, { texto: a.original, vacio: false },
          obra && esCampo(a.campo) ? textoValor(a.campo, obra.campos[a.campo]) : VACIO,
          `«${a.original}»: ${a.motivo}. Este campo no se sincroniza en esta ejecución.`
        );
        if (obra) anadirAObra(obra.id, nueva);
        else filasDeAlta.set(a.fila, [...(filasDeAlta.get(a.fila) ?? []), nueva]);
      } else {
        noSeTocan.push({
          clave: `fila|${a.fila}|${a.campo}`, tipo: 'Celda ilegible',
          titulo: `Fila ${a.fila} · ${encabezado(a.campo)}`, detalle: `${a.motivo}: «${a.original}»`,
        });
      }
    } else if (aviso.tipo === 'id_duplicado') {
      noSeTocan.push({
        clave: `id_duplicado|${aviso.idWeb}`, tipo: 'ID duplicado',
        titulo: `ID WEB ${aviso.idWeb} aparece ${aviso.filas.length} veces`,
        detalle: `Filas ${unirFilas(aviso.filas)} de la hoja. Ninguna se toca.`,
      });
    } else if (aviso.tipo === 'id_desconocido') {
      noSeTocan.push({
        clave: `id_desconocido|${aviso.idWeb}`, tipo: 'ID desconocido',
        titulo: `ID WEB ${aviso.idWeb} no existe en el inventario`,
        detalle: `Fila ${aviso.fila} de la hoja. Puede ser una obra borrada o un ID tecleado a mano.`,
      });
    }
  }

  const grupos: GrupoRevision[] = [...filasObra]
    .sort(([a], [b]) => a - b)
    .map(([obraId, filas]) => grupoObra(obraId, filas, obraDe.get(obraId)));

  for (const c of diff.cargos) grupos.push(grupoPersona(c, [filaCargo(c, filaCambio)]));
  for (const c of diff.conflictosCargo) grupos.push(grupoPersona(c, [filaConflictoCargo(c, estado, contar, pendientes)]));

  for (const alta of diff.altasBase) {
    const decidida = estado.altasBase.get(alta.fila);
    if (decidida === undefined) pendientes.altas++;
    else if (decidida) resumen.haciaBase++;
    grupos.push(grupoPresencia({
      clave: `alta-base|${alta.fila}`, numero: `Fila ${alta.fila}`, titulo: alta.campos.titulo?.trim() || 'Sin título',
      etiqueta: 'Solo está en la hoja',
      resumen: 'Puede ser un alta real o una fila copiada a la que alguien borró el ID WEB. Requiere una elección.',
      ref: { tipo: 'altaBase', fila: alta.fila }, pendiente: decidida === undefined,
      opciones: [
        { valor: 'crear', etiqueta: 'Crear en la base', elegida: decidida === true },
        { valor: 'ignorar', etiqueta: 'Ignorar', elegida: decidida === false },
      ],
      filas: filasDeAlta.get(alta.fila) ?? [],
    }));
  }
  for (const { obraId } of diff.altasHoja) {
    const ignorada = estado.altasHojaIgnoradas.has(obraId);
    if (!ignorada) resumen.filasNuevas++;
    grupos.push(grupoPresencia({
      clave: `alta-hoja|${obraId}`, numero: `N.º ${obraId}`, titulo: tituloObra(obraDe.get(obraId)),
      etiqueta: 'Solo está en la base', resumen: 'La obra existe en el inventario y no tiene fila en la hoja.',
      ref: { tipo: 'altaHoja', obraId }, pendiente: false,
      opciones: [
        { valor: 'anadir', etiqueta: 'Añadir fila a la hoja', elegida: !ignorada },
        { valor: 'ignorar', etiqueta: 'Ignorar', elegida: ignorada },
      ],
      filas: [],
    }));
  }
  for (const aviso of diff.avisos) {
    if (aviso.tipo === 'fila_borrada') {
      grupos.push(grupoPresencia({
        clave: `fila-borrada|${aviso.obraId}`, numero: `N.º ${aviso.obraId}`, titulo: tituloObra(obraDe.get(aviso.obraId)),
        etiqueta: 'Desapareció de la hoja',
        resumen: 'Estaba en la última sincronización y alguien borró la fila. Una ausencia nunca borra una obra: si corresponde, bórrala a mano en la web.',
        ref: null, pendiente: false, opciones: [], filas: [],
      }));
    } else if (aviso.tipo === 'obra_borrada_en_web') {
      grupos.push(grupoPresencia({
        clave: `borrada-web|${aviso.idWeb}`, numero: `N.º ${aviso.idWeb}`, titulo: tituloObra(undefined, filaDe.get(aviso.fila)),
        etiqueta: 'Borrada en la base',
        resumen: `La obra se eliminó del inventario pero su fila sigue en la hoja (fila ${aviso.fila}). Bórrala a mano en la hoja si corresponde.`,
        ref: null, pendiente: false, opciones: [], filas: [],
      }));
    }
  }

  noSeTocan.sort((a, b) => ORDEN_NO_SE_TOCA.indexOf(a.tipo) - ORDEN_NO_SE_TOCA.indexOf(b.tipo));
  resumen.pendientes = pendientes.conflictos + pendientes.altas;
  const filtros = (Object.keys(ETIQUETAS_FILTRO) as Filtro[])
    .map((filtro) => ({ filtro, etiqueta: ETIQUETAS_FILTRO[filtro], cuenta: grupos.filter((g) => g.filtros.includes(filtro)).length }))
    .filter((f) => f.filtro !== 'avisos' || f.cuenta > 0);
  return { grupos, noSeTocan, resumen, pendientes, filtros };
}

function unirFilas(filas: number[]): string {
  return filas.length === 1 ? String(filas[0]) : `${filas.slice(0, -1).join(', ')} y ${filas[filas.length - 1]}`;
}

function filaConflicto(
  c: Conflicto, estado: EstadoRevision, contar: (lado: Lado) => void, pendientes: { conflictos: number }
): FilaRevision {
  const clave = claveCampo(c.obraId, c.campo);
  const elegido = estado.conflictos.get(clave);
  if (elegido) contar(elegido === 'hoja' ? 'base' : 'hoja');
  else pendientes.conflictos++;
  return {
    clave, campo: c.campo, hoja: textoValor(c.campo, c.hoja), base: textoValor(c.campo, c.base), gana: elegido ?? null,
    accion: {
      tipo: 'opciones', ref: { tipo: 'conflicto', clave },
      opciones: [
        { valor: 'hoja', etiqueta: 'Dejar la hoja', elegida: elegido === 'hoja' },
        { valor: 'base', etiqueta: 'Dejar la base', elegida: elegido === 'base' },
      ],
    },
    nota: c.foto === undefined
      ? 'Sin versión acordada: las dos copias difieren.'
      : `En la última sincronización era «${textoValor(c.campo, c.foto).texto}». Cambió en las dos copias.`,
    notaAmbar: true, pendiente: !elegido,
  };
}

type HacerCambio = (clave: string, campo: string, destino: Lado, hoja: Celda, base: Celda) => FilaRevision;
type HacerFuera = (clave: string, campo: string, hoja: Celda, base: Celda, nota: string, enlaceObra?: number) => FilaRevision;

const celdaImagen = (imagen: { url: string } | null): Celda =>
  imagen ? { texto: 'Imagen de la web', vacio: false, miniatura: imagen.url } : VACIO;

function filaImagen(i: CambioImagen, hacer: HacerCambio): FilaRevision {
  const campo = claveImagen(i.casilla);
  return hacer(claveCampo(i.obraId, campo), campo, 'hoja', textoCasilla(i.leida), celdaImagen(i.imagen));
}

const NOTAS_IMAGEN: Record<AvisoImagen['motivo'], string> = {
  reemplazada: 'La imagen cambió en la web desde la última sincronización. La hoja conserva la anterior.',
  borrada: 'La imagen se borró en la web. La hoja conserva la suya.',
  casilla_con_texto: 'La casilla tiene texto en la hoja y nunca se sobrescribe. La web tiene una imagen nueva.',
  url_externa: 'La imagen de la web no está en el almacenamiento del inventario y no se puede llevar a la hoja. Vuelve a subirla desde la ficha.',
};

function filaAvisoImagen(a: AvisoImagen, estado: EstadoRevision, contar: (lado: Lado) => void, fuera: HacerFuera): FilaRevision {
  const campo = claveImagen(a.casilla);
  const clave = claveCampo(a.obraId, campo);
  const hoja = textoCasilla(a.leida);
  const base = celdaImagen(a.imagen);
  if (a.motivo === 'url_externa') return fuera(clave, campo, hoja, base, NOTAS_IMAGEN.url_externa, a.obraId);
  const decision = estado.avisosImagen.get(clave);
  const opcion = (valor: DecisionImagen, etiqueta: string) => ({ valor, etiqueta, elegida: decision === valor });
  const opciones = a.motivo === 'casilla_con_texto'
    ? [opcion('dejar', 'No volver a avisar')]
    : [opcion('reemplazar', a.motivo === 'borrada' ? 'Vaciar en la hoja' : 'Reemplazar en la hoja'), opcion('dejar', 'Dejar la de la hoja')];
  if (decision === 'reemplazar' && a.motivo !== 'casilla_con_texto') contar('hoja');
  return {
    clave, campo, hoja, base, gana: decision === 'reemplazar' ? 'base' : decision === 'dejar' ? 'hoja' : null,
    accion: { tipo: 'opciones', ref: { tipo: 'imagen', clave }, opciones },
    nota: NOTAS_IMAGEN[a.motivo], notaAmbar: false, pendiente: false,
  };
}

function filaCargo(c: CambioCargo, hacer: HacerCambio): FilaRevision {
  return hacer(claveCargo(c.clave), 'cargo', c.destino, textoValor('cargo', c.hoja), textoValor('cargo', c.base));
}

function filaConflictoCargo(
  c: ConflictoCargo, estado: EstadoRevision, contar: (lado: Lado) => void, pendientes: { conflictos: number }
): FilaRevision {
  const decidido = estado.conflictosCargo.has(c.clave);
  const elegido = estado.conflictosCargo.get(c.clave) ?? null;
  if (!decidido) pendientes.conflictos++;
  else contar(normalizarTexto(elegido) === normalizarTexto(c.base) ? 'hoja' : 'base');
  const contraBase = c.opciones.length === 2 && c.opciones[1] === c.base;
  const enHoja = contraBase ? [c.opciones[0]] : c.opciones;
  return {
    clave: claveCargo(c.clave), campo: 'cargo',
    hoja: { texto: enHoja.map((o) => o ?? 'Vacío').join(' / '), vacio: false }, base: textoValor('cargo', c.base),
    gana: null,
    accion: {
      tipo: 'opciones', ref: { tipo: 'cargo', clave: c.clave },
      opciones: c.opciones.map((o) => ({ valor: o ?? '', etiqueta: o ?? 'Vacío', elegida: decidido && elegido === o })),
    },
    nota: contraBase && c.foto !== undefined
      ? `En la última sincronización era «${textoValor('cargo', c.foto).texto}». Cambió en las dos copias.`
      : 'Las filas de esta persona no coinciden en el cargo. Elige el que vale para todas.',
    notaAmbar: true, pendiente: !decidido,
  };
}

const decideCon = (f: FilaRevision, tipo: RefDecision['tipo']) => f.accion.tipo === 'opciones' && f.accion.ref.tipo === tipo;

function grupoObra(obraId: number, filas: FilaRevision[], obra: ObraBase | undefined): GrupoRevision {
  const conflictos = filas.filter((f) => decideCon(f, 'conflicto')).length;
  const cambios = filas.filter((f) => f.accion.tipo === 'casilla').length;
  const destinos = new Set(filas.flatMap((f) => (f.accion.tipo === 'casilla' ? [f.accion.destino] : [])));
  const conAvisos = filas.some((f) => f.accion.tipo === 'fuera' || decideCon(f, 'imagen'));
  const filtros: Filtro[] = ['todo'];
  if (conflictos) filtros.push('conflictos');
  if (destinos.has('base')) filtros.push('base');
  if (destinos.has('hoja')) filtros.push('hoja');
  if (conAvisos) filtros.push('avisos');
  return {
    clave: `obra|${obraId}`, tipo: 'obra', numero: `N.º ${obraId}`, titulo: tituloObra(obra),
    etiqueta: conflictos ? plural(conflictos, 'conflicto') : cambios ? plural(cambios, 'cambio') : 'Aviso',
    tono: conflictos ? 'ambar' : cambios ? 'acento' : 'neutro',
    pendiente: filas.some((f) => f.pendiente), filas, resumen: null, opciones: [], ref: null, filtros,
  };
}

function grupoPersona(c: CambioCargo | ConflictoCargo, filas: FilaRevision[]): GrupoRevision {
  const pendiente = filas.some((f) => f.pendiente);
  const conflicto = filas.some((f) => decideCon(f, 'cargo'));
  const filtros: Filtro[] = ['todo'];
  if (conflicto) filtros.push('conflictos');
  else filtros.push((c as CambioCargo).destino);
  return {
    clave: `persona|${c.clave}`, tipo: 'persona', numero: '', titulo: `${c.nombre} · cargo`,
    etiqueta: `Afecta a ${plural(c.filas.length, 'obra')}`, tono: conflicto ? 'ambar' : 'acento',
    pendiente, filas, resumen: null, opciones: [], ref: null, filtros,
  };
}

function grupoPresencia(g: Omit<GrupoRevision, 'tipo' | 'tono' | 'filtros'>): GrupoRevision {
  return { ...g, tipo: 'presencia', tono: g.pendiente ? 'ambar' : 'neutro', filtros: ['todo', 'presencia'] };
}

export function elegir(estado: EstadoRevision, ref: RefDecision, valor: string | null): EstadoRevision {
  switch (ref.tipo) {
    case 'descartado': {
      const descartados = new Set(estado.descartados);
      if (!descartados.delete(ref.clave)) descartados.add(ref.clave);
      return { ...estado, descartados };
    }
    case 'conflicto':
      return { ...estado, conflictos: new Map(estado.conflictos).set(ref.clave, valor as Lado) };
    case 'cargo':
      return { ...estado, conflictosCargo: new Map(estado.conflictosCargo).set(ref.clave, valor || null) };
    case 'imagen':
      return { ...estado, avisosImagen: new Map(estado.avisosImagen).set(ref.clave, valor as DecisionImagen) };
    case 'altaBase':
      return { ...estado, altasBase: new Map(estado.altasBase).set(ref.fila, valor === 'crear') };
    case 'altaHoja': {
      const ignoradas = new Set(estado.altasHojaIgnoradas);
      if (valor === 'ignorar') ignoradas.add(ref.obraId);
      else ignoradas.delete(ref.obraId);
      return { ...estado, altasHojaIgnoradas: ignoradas };
    }
  }
}

export function aDecisiones(estado: EstadoRevision, diff: Diff): Decisiones {
  return {
    conflictos: estado.conflictos,
    conflictosCargo: estado.conflictosCargo,
    avisosImagen: estado.avisosImagen,
    altasBase: new Set([...estado.altasBase].flatMap(([fila, crear]) => (crear ? [fila] : []))),
    altasHoja: new Set(diff.altasHoja.map((a) => a.obraId).filter((id) => !estado.altasHojaIgnoradas.has(id))),
    descartados: estado.descartados,
  };
}

