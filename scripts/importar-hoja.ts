/**
 * Importación inicial de la hoja oficial.
 *
 *   npx tsx scripts/importar-hoja.ts respaldar
 *   npx tsx scripts/importar-hoja.ts vaciar    <importacion/respaldo-…> --confirmar
 *   npx tsx scripts/importar-hoja.ts emparejar <copia.xlsx>
 *   npx tsx scripts/importar-hoja.ts simular   <copia.xlsx>
 *   npx tsx scripts/importar-hoja.ts aplicar   <copia.xlsx> --confirmar
 *   npx tsx scripts/importar-hoja.ts revertir  <importacion/registro-….json> --confirmar
 *
 * Usa la clave service_role de .env.importacion, que se salta RLS.
 */
import { DOMParser } from '@xmldom/xmldom';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { descomprimirXlsx, leerHoja, tamanosDeMedios, XmlParser } from '../src/app/features/sincronizacion/nucleo/leer-xlsx';
import { CamposObra, leerFilasObras } from '../src/app/features/sincronizacion/nucleo/hoja-obras';
import { emparejar, Emparejamiento, validarEmparejamiento } from '../src/app/features/sincronizacion/nucleo/emparejamiento';
import { Excepcion, ObraBase, planificarImportacion } from '../src/app/features/sincronizacion/nucleo/importacion';
import { valoresFoto } from '../src/app/features/sincronizacion/nucleo/foto';
import { claveNombre } from '../src/app/features/sincronizacion/nucleo/normalizacion';

const HOJA = 'Inventario Obras';
const BUCKET = 'imagenes-obras';
const SALIDA = join(process.cwd(), 'importacion');
const TIPOS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

interface Registro {
  inicio: string;
  copia: string;
  responsablesCreados: number[];
  cargosAnteriores: { id: number; cargo: string | null }[];
  actualizaciones: { obraId: number; antes: Record<string, unknown> }[];
  obrasCreadas: number[];
  imagenes: { ruta: string; imagenId: number | null }[];
  fotos: number[];
  fotosAnteriores?: { obra_id: number; valores: unknown; fecha: string }[];
  // Mayor id de obras al empezar: revertir detecta obras creadas que no llegaron al registro.
  ultimoIdAntes?: number;
  // Falso hasta que «revertir» termina con éxito: «aplicar» se niega a correr mientras exista un registro sin revertir.
  revertido: boolean;
}

function cargarEntorno(): { url: string; clave: string } {
  const ruta = join(process.cwd(), '.env.importacion');
  if (existsSync(ruta)) {
    for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
      const par = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(linea);
      if (par && process.env[par[1]] === undefined) process.env[par[1]] = par[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  const url = process.env['SUPABASE_URL'];
  const clave = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.importacion');
  return { url, clave };
}

function rutaEnBucket(url: string): string | null {
  const prefijo = `/storage/v1/object/public/${BUCKET}/`;
  const ruta = new URL(url).pathname.split(prefijo)[1];
  return ruta ? decodeURIComponent(ruta) : null;
}
const archivoDeRespaldo = (ruta: string) => encodeURIComponent(ruta);

const guardar = (nombre: string, datos: unknown) =>
  writeFileSync(join(SALIDA, nombre), JSON.stringify(datos, null, 2));
const leerJson = <T>(nombre: string): T => JSON.parse(readFileSync(join(SALIDA, nombre), 'utf8')) as T;

function comprobar<T>(respuesta: { data: T; error: unknown }): T {
  if (respuesta.error) throw respuesta.error;
  return respuesta.data;
}

const PAGINA = 1000;

/** PostgREST corta cada respuesta en max-rows: se pide por páginas hasta que una llega vacía. */
async function todas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; ) {
    const pagina = comprobar(await consulta(desde, desde + PAGINA - 1)) ?? [];
    if (pagina.length === 0) return filas;
    filas.push(...pagina);
    desde += pagina.length;
  }
}

/**
 * Compara dos copias de una tabla por conjunto de ids: cuántas filas son nuevas,
 * cuántas faltan y (si se da `cambio`) cuántas de las que siguen ahí cambiaron.
 * Solo devuelve totales — nunca los datos de la fila — para no filtrar columnas
 * restringidas al reportar la diferencia.
 */
function compararConjunto<T>(
  etiqueta: string,
  idDe: (item: T) => number,
  actuales: T[],
  respaldo: T[],
  cambio?: (actual: T, previo: T) => boolean
): string[] {
  const problemas: string[] = [];
  const idsActuales = new Set(actuales.map(idDe));
  const idsRespaldo = new Set(respaldo.map(idDe));
  const nuevos = [...idsActuales].filter((id) => !idsRespaldo.has(id)).length;
  const borrados = [...idsRespaldo].filter((id) => !idsActuales.has(id)).length;
  if (nuevos) problemas.push(`${etiqueta}: ${nuevos} nuevas desde el respaldo`);
  if (borrados) problemas.push(`${etiqueta}: ${borrados} borradas desde el respaldo`);
  if (cambio) {
    const previoPorId = new Map(respaldo.map((r) => [idDe(r), r]));
    let cambiados = 0;
    for (const a of actuales) {
      const previo = previoPorId.get(idDe(a));
      if (previo && cambio(a, previo)) cambiados++;
    }
    if (cambiados) problemas.push(`${etiqueta}: ${cambiados} modificadas desde el respaldo`);
  }
  return problemas;
}

function leerCopia(ruta: string, incluirMedios: boolean) {
  const datos = new Uint8Array(readFileSync(ruta));
  const archivos = descomprimirXlsx(datos, incluirMedios);
  const resultado = leerFilasObras(leerHoja(archivos, HOJA, new DOMParser() as unknown as XmlParser));
  return { archivos, resultado, tamanos: tamanosDeMedios(datos) };
}

async function obrasDeLaBase(db: SupabaseClient): Promise<ObraBase[]> {
  const filas = await todas<any>((desde, hasta) =>
    db
      .from('obras')
      .select('id, autor, titulo, tecnica, dimension, ano, ubicacion, bloque_asignado, valor, descripcion, observaciones, responsables(nombre, cargo), imagenes(id, url)')
      .order('id')
      .range(desde, hasta)
  );
  return filas.map((o) => ({
    id: o.id,
    campos: {
      autor: o.autor, titulo: o.titulo, tecnica: o.tecnica, dimension: o.dimension, ano: o.ano,
      ubicacion: o.ubicacion, bloque_asignado: o.bloque_asignado,
      valor: o.valor === null ? null : Number(o.valor),
      descripcion: o.descripcion, observaciones: o.observaciones,
      responsable: o.responsables?.nombre ?? null, cargo: o.responsables?.cargo ?? null,
    },
    imagenes: [...(o.imagenes ?? [])].sort((a: { id: number }, b: { id: number }) => a.id - b.id),
  }));
}

async function comandoRespaldar(db: SupabaseClient) {
  const directorio = join(SALIDA, `respaldo-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(join(directorio, 'imagenes'), { recursive: true });
  const obras = await todas<{ id: number }>((d, h) => db.from('obras').select('*').order('id').range(d, h));
  const imagenes = await todas<{ id: number; url: string }>((d, h) => db.from('imagenes').select('*').order('id').range(d, h));
  const responsables = await todas<unknown>((d, h) => db.from('responsables').select('*').order('id').range(d, h));
  const sincronizacionEstado = await todas<{ obra_id: number }>((d, h) =>
    db.from('sincronizacion_estado').select('*').order('obra_id').range(d, h)
  );
  const sincronizacionHoja = comprobar(await db.from('sincronizacion_hoja').select('*')) as { id: number }[];
  writeFileSync(
    join(directorio, 'datos.json'),
    JSON.stringify({ obras, imagenes, responsables, sincronizacionEstado, sincronizacionHoja }, null, 2)
  );
  for (const imagen of imagenes) {
    const ruta = rutaEnBucket(imagen.url);
    if (!ruta) throw new Error(`La imagen ${imagen.id} no está en el bucket ${BUCKET}: ${imagen.url}`);
    const archivo = comprobar(await db.storage.from(BUCKET).download(ruta)) as Blob;
    writeFileSync(join(directorio, 'imagenes', archivoDeRespaldo(ruta)), new Uint8Array(await archivo.arrayBuffer()));
  }
  console.log(
    `Respaldo en ${directorio}: ${obras.length} obras, ${imagenes.length} imágenes, ${responsables.length} responsables, ${sincronizacionEstado.length} estados de sincronización.`
  );
}

async function comandoVaciar(directorio: string, db: SupabaseClient) {
  const { obras, imagenes, sincronizacionEstado, sincronizacionHoja } = JSON.parse(
    readFileSync(join(directorio, 'datos.json'), 'utf8')
  ) as {
    obras: { id: number; fecha_actualizacion: string | null }[];
    imagenes: { id: number; url: string }[];
    sincronizacionEstado: { obra_id: number; fecha: string }[];
    sincronizacionHoja: { id: number; fecha_ultima: string | null; etag: string | null }[];
  };
  const actuales = await todas<{ id: number; fecha_actualizacion: string | null }>((d, h) =>
    db.from('obras').select('id, fecha_actualizacion').order('id').range(d, h)
  );
  const actualesImagenes = await todas<{ id: number }>((d, h) => db.from('imagenes').select('id').order('id').range(d, h));
  const actualesEstado = await todas<{ obra_id: number; fecha: string }>((d, h) =>
    db.from('sincronizacion_estado').select('obra_id, fecha').order('obra_id').range(d, h)
  );
  const actualesHoja = comprobar(
    await db.from('sincronizacion_hoja').select('id, fecha_ultima, etag')
  ) as { id: number; fecha_ultima: string | null; etag: string | null }[];

  // Compara por conjunto de ids, no por recuento: si entre «respaldar» y «vaciar» se
  // borra una fila y se crea otra, el recuento cuadra pero el respaldo ya no sirve.
  const problemas = [
    ...compararConjunto(
      'obras', (o) => o.id, actuales, obras,
      (a, p) => a.fecha_actualizacion !== p.fecha_actualizacion
    ),
    ...compararConjunto('imágenes', (i) => i.id, actualesImagenes, imagenes),
    ...compararConjunto(
      'sincronizacion_estado', (s) => s.obra_id, actualesEstado, sincronizacionEstado,
      (a, p) => a.fecha !== p.fecha
    ),
    ...compararConjunto(
      'sincronizacion_hoja', (h) => h.id, actualesHoja, sincronizacionHoja,
      (a, p) => a.fecha_ultima !== p.fecha_ultima || a.etag !== p.etag
    ),
  ];
  if (problemas.length) {
    throw new Error(`La base cambió desde el respaldo; no se borra nada:\n${problemas.map((p) => `- ${p}`).join('\n')}\nHaz un respaldo nuevo antes de vaciar.`);
  }
  const rutas = imagenes.map((i) => rutaEnBucket(i.url)!);
  const sinCopia = rutas.filter((r) => !existsSync(join(directorio, 'imagenes', archivoDeRespaldo(r))));
  if (sinCopia.length) throw new Error(`Faltan en el respaldo ${sinCopia.length} imágenes: no se vacía nada.`);

  comprobar(await db.from('sincronizacion_estado').delete().gte('obra_id', 0));
  comprobar(await db.from('obras').delete().gte('id', 0));
  for (let i = 0; i < rutas.length; i += 100) {
    comprobar(await db.storage.from(BUCKET).remove(rutas.slice(i, i + 100)));
  }
  console.log(`Vaciado: ${obras.length} obras (sus imágenes caen en cascada) y ${rutas.length} archivos del bucket.`);
}

async function comandoEmparejar(ruta: string, db: SupabaseClient) {
  const { resultado } = leerCopia(ruta, false);
  const obras = await obrasDeLaBase(db);
  const existentes = obras.map((o) => ({ id: o.id, autor: o.campos.autor, titulo: o.campos.titulo }));
  const { emparejamientos, obrasSinFila } = emparejar(resultado.filas, existentes);
  guardar('emparejamiento.json', {
    emparejamientos,
    obrasSinFila: existentes.filter((o) => obrasSinFila.includes(o.id)),
  });
  const cuenta = (m: string) => emparejamientos.filter((e) => e.metodo === m).length;
  console.log(
    `Filas ${resultado.filas.length} · exactas ${cuenta('exacto')} · por ID WEB ${cuenta('id-web')} · por título ${cuenta('titulo')} · ambiguas ${cuenta('ambiguo')} · nuevas ${cuenta('nueva')} · obras sin fila ${obrasSinFila.length}`
  );
  console.log('Revisa importacion/emparejamiento.json: en cada entrada con "revisado": false, pon "obraId" (o null si es nueva) y "revisado": true.');
  console.log('Comprueba también "obrasSinFila": una obra de ahí que esté en la hoja como «nueva» se duplicaría.');
}

async function prepararPlan(ruta: string, db: SupabaseClient, incluirMedios: boolean) {
  const { archivos, resultado, tamanos } = leerCopia(ruta, incluirMedios);
  const obras = await obrasDeLaBase(db);
  const { emparejamientos } = leerJson<{ emparejamientos: Emparejamiento[] }>('emparejamiento.json');
  const errores = validarEmparejamiento(
    emparejamientos,
    obras.map((o) => ({ id: o.id, autor: o.campos.autor, titulo: o.campos.titulo }))
  );
  const filasCopia = new Set(resultado.filas.map((f) => f.fila));
  if (emparejamientos.length !== filasCopia.size || emparejamientos.some((e) => !filasCopia.has(e.fila))) {
    errores.push('El emparejamiento no corresponde a esta copia: vuelve a ejecutar «emparejar».');
  }
  if (errores.length) throw new Error(errores.join('\n'));
  const excepciones = existsSync(join(SALIDA, 'excepciones.json')) ? leerJson<Excepcion[]>('excepciones.json') : [];
  const usadas = new Set(emparejamientos.map((e) => e.obraId));
  const plan = planificarImportacion({
    filas: resultado.filas,
    avisos: resultado.avisos,
    emparejamientos,
    obras,
    obrasSinFila: obras.filter((o) => !usadas.has(o.id)).map((o) => o.id),
    excepciones,
    tamanos,
  });
  return { archivos, resultado, emparejamientos, plan };
}

async function comandoSimular(ruta: string, db: SupabaseClient) {
  const { plan } = await prepararPlan(ruta, db, false);
  guardar('simulacion.json', plan);
  const porCampo = new Map<string, number>();
  for (const a of plan.actualizaciones) for (const c of a.cambios) porCampo.set(c.campo, (porCampo.get(c.campo) ?? 0) + 1);
  console.log(`Obras a actualizar: ${plan.actualizaciones.length}`);
  for (const [campo, n] of porCampo) console.log(`  ${campo}: ${n}`);
  console.log(`Obras nuevas: ${plan.altas.length}`);
  console.log(`Responsables en la hoja: ${plan.responsables.length} · con cargos distintos: ${plan.cargosEnConflicto.length}`);
  console.log(`Imágenes a subir: ${plan.imagenes.length} · rechazadas: ${plan.imagenesRechazadas.length}`);
  console.log(`Campos que la hoja tiene vacíos y se conservan de la base: ${plan.conservados.length}`);
  console.log(`Avisos: ${plan.avisos.length} · obras de la base sin fila: ${plan.obrasSinFila.length}`);
  console.log('Detalle en importacion/simulacion.json. Para conservar el valor de la base en un campo, añádelo a importacion/excepciones.json como { "obraId": 5, "campo": "ubicacion" }.');
}

/** Nombres de `registro-*.json` en importacion/ que no terminaron en un «revertir» exitoso. */
function registrosSinRevertir(): string[] {
  if (!existsSync(SALIDA)) return [];
  return readdirSync(SALIDA).filter((nombre) => {
    if (!/^registro-.*\.json$/.test(nombre)) return false;
    try {
      const registro = JSON.parse(readFileSync(join(SALIDA, nombre), 'utf8')) as Registro;
      return registro.revertido !== true;
    } catch {
      return true; // Ilegible: se trata como pendiente, no se descarta en silencio.
    }
  });
}

async function comandoAplicar(ruta: string, db: SupabaseClient) {
  const pendientes = registrosSinRevertir();
  if (pendientes.length) {
    const comandos = pendientes
      .map((nombre) => `  npx tsx scripts/importar-hoja.ts revertir importacion/${nombre} --confirmar`)
      .join('\n');
    throw new Error(
      `Hay ${pendientes.length} registro(s) de un «aplicar» anterior sin revertir en importacion/ (si no se revierten, el siguiente aplicar duplicaría obras); ejecuta:\n${comandos}`
    );
  }
  const { archivos, resultado, emparejamientos, plan } = await prepararPlan(ruta, db, true);
  if (plan.obrasSinFila.length) {
    console.log(`${plan.obrasSinFila.length} obras de la base no están en la hoja; no se tocan.`);
  }
  if (plan.cargosEnConflicto.length) {
    const rutaDetalle = join(SALIDA, `cargos-en-conflicto-${Date.now()}.json`);
    writeFileSync(rutaDetalle, JSON.stringify(plan.cargosEnConflicto, null, 2));
    throw new Error(
      `${plan.cargosEnConflicto.length} responsable(s) con cargos distintos; corrígelos en la hoja y vuelve a copiarla. Detalle en ${rutaDetalle}`
    );
  }
  const registro: Registro = {
    inicio: new Date().toISOString(), copia: basename(ruta), responsablesCreados: [], cargosAnteriores: [],
    actualizaciones: [], obrasCreadas: [], imagenes: [], fotos: [], revertido: false,
  };
  const nombreRegistro = `registro-${registro.inicio.replace(/[:.]/g, '-')}.json`;
  const anotar = () => guardar(nombreRegistro, registro);
  const ultima = comprobar(
    await db.from('obras').select('id').order('id', { ascending: false }).limit(1).maybeSingle()
  ) as { id: number } | null;
  registro.ultimoIdAntes = ultima?.id ?? 0;
  anotar();
  console.log(`Registro en importacion/${nombreRegistro}`);

  const existentes = await todas<{ id: number; nombre: string; cargo: string | null }>((d, h) =>
    db.from('responsables').select('id, nombre, cargo').order('id').range(d, h)
  );
  const responsables = new Map(existentes.map((r) => [claveNombre(r.nombre)!, r]));
  for (const r of plan.responsables) {
    const actual = responsables.get(r.clave);
    if (!actual) {
      const creado = comprobar(await db.from('responsables').insert({ nombre: r.nombre, cargo: r.cargo }).select('id, nombre, cargo').single()) as { id: number; nombre: string; cargo: string | null };
      responsables.set(r.clave, creado);
      registro.responsablesCreados.push(creado.id);
      anotar();
    } else if (r.cargo !== null && actual.cargo !== r.cargo) {
      registro.cargosAnteriores.push({ id: actual.id, cargo: actual.cargo });
      anotar();
      comprobar(await db.from('responsables').update({ cargo: r.cargo }).eq('id', actual.id));
      actual.cargo = r.cargo;
    }
  }
  const aColumnas = (valores: Partial<CamposObra>): Record<string, unknown> => {
    const { responsable, cargo, ...resto } = valores;
    const columnas: Record<string, unknown> = { ...resto };
    if ('responsable' in valores) {
      columnas['responsable_id'] = responsable ? responsables.get(claveNombre(responsable)!)!.id : null;
    }
    return columnas;
  };

  for (const a of plan.actualizaciones) {
    const columnas = aColumnas(a.valores);
    if (Object.keys(columnas).length === 0) continue;
    const antes = comprobar(
      await db.from('obras').select([...Object.keys(columnas), 'fecha_actualizacion'].join(', ')).eq('id', a.obraId).single()
    ) as unknown as Record<string, unknown>;
    registro.actualizaciones.push({ obraId: a.obraId, antes });
    anotar();
    comprobar(await db.from('obras').update({ ...columnas, fecha_actualizacion: new Date().toISOString() }).eq('id', a.obraId));
  }

  const obraDeFila = new Map(
    emparejamientos.filter((e) => e.obraId !== null).map((e) => [e.fila, e.obraId as number])
  );
  for (const alta of plan.altas) {
    const creada = comprobar(await db.from('obras').insert(aColumnas(alta.valores)).select('id').single()) as { id: number };
    obraDeFila.set(alta.fila, creada.id);
    registro.obrasCreadas.push(creada.id);
    anotar();
  }
  console.log(`Obras: ${plan.actualizaciones.length} actualizadas, ${plan.altas.length} creadas.`);

  // Se suben por fila y casilla: el orden por id de `imagenes` es el orden de las casillas.
  const imagenes = [...plan.imagenes].sort((a, b) => a.fila - b.fila || a.casilla - b.casilla);
  for (const [i, img] of imagenes.entries()) {
    const obraId = img.obraId ?? obraDeFila.get(img.fila)!;
    const extension = img.archivo.split('.').pop()!.toLowerCase();
    const destino = `importacion/${obraId}-${img.casilla}.${extension}`;
    const datos = archivos[img.archivo];
    registro.imagenes.push({ ruta: destino, imagenId: null });
    anotar();
    comprobar(await db.storage.from(BUCKET).upload(destino, datos, { contentType: TIPOS[extension], upsert: false }));
    const url = db.storage.from(BUCKET).getPublicUrl(destino).data.publicUrl;
    const fila = comprobar(await db.from('imagenes').insert({ id_obra: obraId, url, nombre: basename(img.archivo), tamano: datos.length }).select('id').single()) as { id: number };
    registro.imagenes[registro.imagenes.length - 1].imagenId = fila.id;
    anotar();
    if ((i + 1) % 25 === 0) console.log(`Imágenes: ${i + 1}/${imagenes.length}`);
  }

  const imagenesBase = await todas<{ id: number; id_obra: number }>((d, h) =>
    db.from('imagenes').select('id, id_obra').order('id').range(d, h)
  );
  const fotos = resultado.filas
    .filter((f) => obraDeFila.has(f.fila))
    .map((f) => {
      const obraId = obraDeFila.get(f.fila)!;
      const ids = imagenesBase.filter((i) => i.id_obra === obraId).map((i) => i.id);
      return { obra_id: obraId, valores: valoresFoto(f.campos, ids), fecha: new Date().toISOString() };
    });
  const idsFoto = fotos.map((f) => f.obra_id);
  registro.fotosAnteriores = [];
  for (let i = 0; i < idsFoto.length; i += 200) {
    registro.fotosAnteriores.push(
      ...(comprobar(
        await db.from('sincronizacion_estado').select('obra_id, valores, fecha').in('obra_id', idsFoto.slice(i, i + 200))
      ) as { obra_id: number; valores: unknown; fecha: string }[])
    );
  }
  registro.fotos = idsFoto;
  anotar();
  comprobar(await db.from('sincronizacion_estado').upsert(fotos));

  guardar(
    'id-web.json',
    resultado.filas
      .filter((f) => obraDeFila.has(f.fila))
      .map((f) => {
        const comoEnGraph = (campo: 'autor' | 'titulo' | 'tecnica' | 'dimension') =>
          f.heredados.includes(campo) ? null : f.campos[campo];
        return {
          fila: f.fila,
          obraId: obraDeFila.get(f.fila)!,
          autor: comoEnGraph('autor'),
          titulo: comoEnGraph('titulo'),
          tecnica: comoEnGraph('tecnica'),
          dimension: comoEnGraph('dimension'),
        };
      })
  );
  console.log(`Fotos: ${fotos.length}. Siguiente paso: escribir «ID WEB» desde /sincronizacion/vincular con importacion/id-web.json.`);
}

async function comandoRevertir(ruta: string, db: SupabaseClient) {
  const r = JSON.parse(readFileSync(ruta, 'utf8')) as Registro;
  if (r.revertido) throw new Error('Este registro ya está revertido: no se toca nada.');
  if (r.ultimoIdAntes !== undefined) {
    const registradas = new Set(r.obrasCreadas);
    const sinRegistrar = (
      await todas<{ id: number }>((d, h) => db.from('obras').select('id').gt('id', r.ultimoIdAntes!).order('id').range(d, h))
    )
      .map((o) => o.id)
      .filter((id) => !registradas.has(id));
    if (sinRegistrar.length) {
      throw new Error(
        `Hay ${sinRegistrar.length} obra(s) creadas después de empezar «aplicar» que no están en el registro (ids ${sinRegistrar.join(', ')}): ` +
          'pueden venir de un «aplicar» interrumpido o de alguien que creó obras en la web. Revísalas, añade a "obrasCreadas" las de la importación y repite.'
      );
    }
  }
  if (r.fotos.length) comprobar(await db.from('sincronizacion_estado').delete().in('obra_id', r.fotos));
  if (r.fotosAnteriores?.length) comprobar(await db.from('sincronizacion_estado').upsert(r.fotosAnteriores));
  const urls = r.imagenes.map((i) => db.storage.from(BUCKET).getPublicUrl(i.ruta).data.publicUrl);
  for (let i = 0; i < urls.length; i += 100) {
    comprobar(await db.from('imagenes').delete().in('url', urls.slice(i, i + 100)));
  }
  for (let i = 0; i < r.imagenes.length; i += 100) {
    comprobar(await db.storage.from(BUCKET).remove(r.imagenes.slice(i, i + 100).map((img) => img.ruta)));
  }
  if (r.obrasCreadas.length) comprobar(await db.from('obras').delete().in('id', r.obrasCreadas));
  for (const a of [...r.actualizaciones].reverse()) comprobar(await db.from('obras').update(a.antes).eq('id', a.obraId));
  for (const c of r.cargosAnteriores) comprobar(await db.from('responsables').update({ cargo: c.cargo }).eq('id', c.id));
  if (r.responsablesCreados.length) comprobar(await db.from('responsables').delete().in('id', r.responsablesCreados));
  writeFileSync(ruta, JSON.stringify({ ...r, revertido: true }, null, 2));
  console.log(`Revertido: ${r.obrasCreadas.length} obras borradas, ${r.actualizaciones.length} restauradas, ${r.imagenes.length} imágenes retiradas.`);
}

async function main() {
  const [comando, ruta] = process.argv.slice(2);
  const confirmado = process.argv.includes('--confirmar');
  if (!comando || (!ruta && comando !== 'respaldar')) {
    throw new Error('Uso: npx tsx scripts/importar-hoja.ts <respaldar|vaciar|emparejar|simular|aplicar|revertir> <archivo> [--confirmar]');
  }
  mkdirSync(SALIDA, { recursive: true });
  const { url, clave } = cargarEntorno();
  const db = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  if ((comando === 'vaciar' || comando === 'aplicar' || comando === 'revertir') && !confirmado) {
    throw new Error(`«${comando}» escribe en la base: repite el comando con --confirmar.`);
  }
  if (comando === 'respaldar') return comandoRespaldar(db);
  if (comando === 'vaciar') return comandoVaciar(ruta, db);
  if (comando === 'emparejar') return comandoEmparejar(ruta, db);
  if (comando === 'simular') return comandoSimular(ruta, db);
  if (comando === 'aplicar') return comandoAplicar(ruta, db);
  if (comando === 'revertir') return comandoRevertir(ruta, db);
  throw new Error(`Comando desconocido: ${comando}`);
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    // Un error de PostgREST/Postgres no es un Error: puede traer en `details` el
    // valor que violó una restricción (p. ej. el nombre en un unique_violation de
    // responsables). Solo el código y el mensaje van a consola; el resto, a un
    // archivo ignorado por git.
    const e = error as { code?: string; message?: string };
    let rutaDetalle = '(no se pudo escribir)';
    try {
      mkdirSync(SALIDA, { recursive: true });
      rutaDetalle = join(SALIDA, `error-${Date.now()}.json`);
      writeFileSync(rutaDetalle, JSON.stringify(error, null, 2));
    } catch {
      // Si ni siquiera esto se puede escribir, se sigue con el mensaje genérico.
    }
    console.error(`Error de la base (code ${e.code ?? 'desconocido'}): ${e.message ?? 'sin mensaje'}. Detalle completo en ${rutaDetalle}`);
  }
  process.exit(1);
});
