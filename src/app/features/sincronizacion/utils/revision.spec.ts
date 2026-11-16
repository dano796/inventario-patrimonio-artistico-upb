import { aDecisiones, construirRevision, elegir, estadoInicial, EstadoRevision, GrupoRevision, textoValor } from './revision';
import { calculoDePrueba } from './calculo-de-prueba';
import { Diff, diffVacio } from '../nucleo/diff-tipos';
import { filaHoja, obraBase } from '../nucleo/pruebas/fabricas';

const URL = 'https://x.supabase.co/storage/v1/object/public/imagenes-obras/a.jpg';

const calculo = calculoDePrueba;

const cambio = (obraId: number, campo: 'ubicacion' | 'valor', destino: 'hoja' | 'base', hoja: string | number | null, base: string | number | null) =>
  ({ obraId, fila: obraId + 1, campo, destino, hoja, base, foto: destino === 'base' ? base : hoja });
const conflicto = (obraId: number, foto: string | undefined = 'Bloque 6') =>
  ({ obraId, fila: obraId + 1, campo: 'ubicacion' as const, hoja: 'Bloque 11', base: 'Bloque 3', foto });
const grupo = (r: { grupos: GrupoRevision[] }, clave: string) => r.grupos.find((g) => g.clave === clave)!;

describe('textoValor', () => {
  it('muestra un guion si no hay valor, el valor en pesos y el resto tal cual', () => {
    expect(textoValor('ubicacion', null)).toEqual({ texto: '—', vacio: true });
    expect(textoValor('valor', 1200000)).toEqual({ texto: '$1.200.000', vacio: false });
    expect(textoValor('ano', 1998)).toEqual({ texto: '1998', vacio: false });
  });
});

describe('construirRevision: obras', () => {
  const obras = [obraBase(14, { titulo: 'Retrato del Fundador' }), obraBase(31, { titulo: null })];

  it('un cambio es una fila con casilla marcada que da por buena la copia que cambió', () => {
    const r = construirRevision(calculo({ cambios: [cambio(14, 'ubicacion', 'base', 'Bloque 11', 'Bloque 6')] }, { obras }), estadoInicial());

    const g = grupo(r, 'obra|14');
    expect([g.numero, g.titulo, g.etiqueta, g.tono]).toEqual(['N.º 14', 'Retrato del Fundador', '1 cambio', 'acento']);
    const fila = g.filas[0];
    expect(fila.accion).toEqual({ tipo: 'casilla', destino: 'base', incluido: true, ref: { tipo: 'descartado', clave: '14|ubicacion' } });
    expect([fila.hoja.texto, fila.base.texto, fila.gana]).toEqual(['Bloque 11', 'Bloque 6', 'hoja']);
  });

  it('un cambio desmarcado no da por buena ninguna copia', () => {
    const estado = elegir(estadoInicial(), { tipo: 'descartado', clave: '14|valor' }, null);
    const r = construirRevision(calculo({ cambios: [cambio(14, 'valor', 'hoja', 1200000, 1500000)] }, { obras }), estado);

    const fila = grupo(r, 'obra|14').filas[0];
    expect(fila.accion).toEqual(jasmine.objectContaining({ incluido: false }));
    expect(fila.gana).toBeNull();
    expect([fila.hoja.texto, fila.base.texto]).toEqual(['$1.200.000', '$1.500.000']);
  });

  it('un conflicto ofrece los dos lados, recuerda la foto y queda pendiente', () => {
    const r = construirRevision(calculo({ conflictos: [conflicto(31)] }, { obras }), estadoInicial());

    const g = grupo(r, 'obra|31');
    expect([g.titulo, g.etiqueta, g.tono, g.pendiente]).toEqual(['Sin título', '1 conflicto', 'ambar', true]);
    const fila = g.filas[0];
    expect(fila.accion).toEqual({
      tipo: 'opciones',
      ref: { tipo: 'conflicto', clave: '31|ubicacion' },
      opciones: [
        { valor: 'hoja', etiqueta: 'Dejar la hoja', elegida: false },
        { valor: 'base', etiqueta: 'Dejar la base', elegida: false },
      ],
    });
    expect(fila.nota).toBe('En la última sincronización era «Bloque 6». Cambió en las dos copias.');
    expect(fila.notaAmbar).toBeTrue();
    expect(r.pendientes).toEqual({ conflictos: 1, altas: 0 });
  });

  it('un conflicto sin foto lo dice', () => {
    const r = construirRevision(calculo({ conflictos: [{ ...conflicto(31), foto: undefined }] }, { obras }), estadoInicial());
    expect(grupo(r, 'obra|31').filas[0].nota).toBe('Sin versión acordada: las dos copias difieren.');
  });

  it('elegir un lado del conflicto lo resuelve', () => {
    const estado = elegir(estadoInicial(), { tipo: 'conflicto', clave: '31|ubicacion' }, 'base');
    const r = construirRevision(calculo({ conflictos: [conflicto(31)] }, { obras }), estado);

    const g = grupo(r, 'obra|31');
    expect(g.pendiente).toBeFalse();
    expect(g.filas[0].gana).toBe('base');
    expect(r.pendientes.conflictos).toBe(0);
    expect(r.resumen.haciaHoja).toBe(1);
  });

  it('una imagen que va a la hoja es una fila con casilla y la miniatura de la web', () => {
    const imagen = { obraId: 14, fila: 15, casilla: 1, accion: 'escribir' as const, imagen: { id: 80, url: URL }, leida: { tipo: 'vacia' as const } };
    const r = construirRevision(calculo({ imagenes: [imagen] }, { obras }), estadoInicial());

    const fila = grupo(r, 'obra|14').filas[0];
    expect(fila.campo).toBe('imagen_1');
    expect(fila.hoja).toEqual({ texto: 'Vacía', vacio: true });
    expect(fila.base.miniatura).toBe(URL);
    expect(fila.accion).toEqual(jasmine.objectContaining({ tipo: 'casilla', destino: 'hoja', ref: { tipo: 'descartado', clave: '14|imagen_1' } }));
  });

  it('cada aviso de imagen ofrece lo que el núcleo admite y nunca bloquea', () => {
    const aviso = (casilla: number, motivo: 'reemplazada' | 'borrada' | 'casilla_con_texto' | 'url_externa') => ({
      obraId: 14, fila: 15, casilla, motivo,
      imagen: motivo === 'borrada' ? null : { id: 80 + casilla, url: URL },
      leida: motivo === 'casilla_con_texto' ? { tipo: 'texto' as const, valor: 'Ubicación no corresponde' } : { tipo: 'pegada' as const, archivo: null },
    });
    const r = construirRevision(
      calculo({ avisosImagen: [aviso(1, 'reemplazada'), aviso(2, 'borrada'), aviso(3, 'casilla_con_texto')] }, { obras }),
      estadoInicial()
    );
    const etiquetas = (i: number) => {
      const accion = grupo(r, 'obra|14').filas[i].accion;
      return accion.tipo === 'opciones' ? accion.opciones.map((o) => `${o.valor}:${o.etiqueta}`) : accion.tipo;
    };

    expect(etiquetas(0)).toEqual(['reemplazar:Reemplazar en la hoja', 'dejar:Dejar la de la hoja']);
    expect(etiquetas(1)).toEqual(['reemplazar:Vaciar en la hoja', 'dejar:Dejar la de la hoja']);
    expect(etiquetas(2)).toEqual(['dejar:No volver a avisar']);
    expect(grupo(r, 'obra|14').filas[2].hoja.texto).toBe('Ubicación no corresponde');
    expect(grupo(r, 'obra|14').pendiente).toBeFalse();
    expect(grupo(r, 'obra|14').filtros).toContain('avisos');
    expect(r.pendientes).toEqual({ conflictos: 0, altas: 0 });
  });

  it('una obra cuyo único aviso es una imagen externa tiene tarjeta, con enlace a su ficha y sin bloquear', () => {
    const aviso = { obraId: 31, fila: 32, casilla: 1, motivo: 'url_externa' as const, imagen: { id: 9, url: 'https://otro.sitio/a.jpg' }, leida: { tipo: 'vacia' as const } };
    const r = construirRevision(calculo({ avisosImagen: [aviso] }, { obras }), estadoInicial());

    const g = grupo(r, 'obra|31');
    expect([g.etiqueta, g.tono, g.pendiente]).toEqual(['Aviso', 'neutro', false]);
    expect(g.filas[0].accion).toEqual({ tipo: 'fuera', enlaceObra: 31 });
    expect(g.filtros).toEqual(['todo', 'avisos']);
  });

  it('celda combinada, cargo sin responsable y valor no convertible quedan fuera en la tarjeta de su obra', () => {
    const filas = [filaHoja(15, { ubicacion: 'Bloque 9', cargo: 'RECTOR' }, { idWeb: 14 })];
    const r = construirRevision(
      calculo(
        {
          avisos: [
            { tipo: 'celda_combinada', obraId: 14, fila: 15, campo: 'ubicacion' },
            { tipo: 'cargo_sin_responsable', obraId: 14, fila: 15 },
            { tipo: 'fila', aviso: { fila: 15, campo: 'valor', motivo: 'el valor está en otra moneda', original: 'USD 5,000' } },
          ],
        },
        { obras, filas }
      ),
      estadoInicial()
    );

    const g = grupo(r, 'obra|14');
    expect(g.filas.map((f) => [f.campo, f.accion.tipo])).toEqual([['ubicacion', 'fuera'], ['cargo', 'fuera'], ['valor', 'fuera']]);
    expect(g.filas[0].hoja.texto).toBe('Bloque 9');
    expect(g.filas[2].nota).toBe('«USD 5,000»: el valor está en otra moneda. Este campo no se sincroniza en esta ejecución.');
  });
});

describe('construirRevision: personas', () => {
  it('un cambio de cargo se agrupa por persona y dice a cuántas obras afecta', () => {
    const r = construirRevision(
      calculo({
        cargos: [{
          clave: 'JOBANY', nombre: 'JOBANY ALONSO TOBON PEÑA', destino: 'base', hoja: 'COORDINADOR', base: 'DIRECTOR', foto: 'DIRECTOR',
          filas: [1, 2, 3].map((n) => ({ fila: n, obraId: n, cargo: 'COORDINADOR', combinada: false })),
        }],
      }),
      estadoInicial()
    );

    const g = grupo(r, 'persona|JOBANY');
    expect([g.tipo, g.titulo, g.etiqueta]).toEqual(['persona', 'JOBANY ALONSO TOBON PEÑA · cargo', 'Afecta a 3 obras']);
    expect(g.filas[0].accion).toEqual(jasmine.objectContaining({ tipo: 'casilla', ref: { tipo: 'descartado', clave: 'cargo|JOBANY' } }));
    expect(r.resumen.haciaBase).toBe(1);
  });

  it('un conflicto de cargo ofrece un botón por cargo, también el vacío', () => {
    const r = construirRevision(
      calculo({
        conflictosCargo: [{
          clave: 'ANA', nombre: 'ANA', opciones: ['RECTORA', null], base: 'RECTORA', foto: undefined,
          filas: [{ fila: 2, obraId: 1, cargo: 'RECTORA', combinada: false }, { fila: 3, obraId: 2, cargo: null, combinada: false }],
        }],
      }),
      estadoInicial()
    );

    const fila = grupo(r, 'persona|ANA').filas[0];
    expect(fila.accion).toEqual(jasmine.objectContaining({
      ref: { tipo: 'cargo', clave: 'ANA' },
      opciones: [{ valor: 'RECTORA', etiqueta: 'RECTORA', elegida: false }, { valor: '', etiqueta: 'Vacío', elegida: false }],
    }));
    expect(r.pendientes.conflictos).toBe(1);

    const resuelto = construirRevision(calculo({ conflictosCargo: [{
      clave: 'ANA', nombre: 'ANA', opciones: ['RECTORA', null], base: 'RECTORA', foto: undefined, filas: [],
    }] }), elegir(estadoInicial(), { tipo: 'cargo', clave: 'ANA' }, ''));
    const accion = grupo(resuelto, 'persona|ANA').filas[0].accion;
    expect(accion.tipo === 'opciones' && accion.opciones[1].elegida).toBeTrue();
    expect(resuelto.pendientes.conflictos).toBe(0);
  });
});

describe('construirRevision: altas, bajas y lo que no se toca', () => {
  it('una fila sin ID WEB pide elegir entre crearla o ignorarla, y lleva sus avisos', () => {
    const filas = [filaHoja(212, { titulo: 'Naturaleza muerta' })];
    const diff: Partial<Diff> = {
      altasBase: [{ fila: 212, campos: filas[0].campos, imagenes: [], imagenesRechazadas: [] }],
      avisos: [{ tipo: 'fila', aviso: { fila: 212, campo: 'ano', motivo: 'tiene más de un año', original: '1950-1955' } }],
    };
    const r = construirRevision(calculo(diff, { filas }), estadoInicial());

    const g = grupo(r, 'alta-base|212');
    expect([g.numero, g.titulo, g.etiqueta, g.pendiente, g.tono]).toEqual(['Fila 212', 'Naturaleza muerta', 'Solo está en la hoja', true, 'ambar']);
    expect(g.opciones.map((o) => o.etiqueta)).toEqual(['Crear en la base', 'Ignorar']);
    expect(g.filas.map((f) => f.campo)).toEqual(['ano']);
    expect(r.pendientes.altas).toBe(1);
    expect(r.noSeTocan).toEqual([]);

    const creada = construirRevision(calculo(diff, { filas }), elegir(estadoInicial(), { tipo: 'altaBase', fila: 212 }, 'crear'));
    expect(creada.pendientes.altas).toBe(0);
    expect(creada.resumen.haciaBase).toBe(1);
  });

  it('el alta dice qué imágenes pegadas se subirán y cuáles no', () => {
    const filas = [filaHoja(536, { titulo: 'Nueva' })];
    const alta = (imagenes: number, rechazadas: { casilla: number; motivo: string }[]): Partial<Diff> => ({
      altasBase: [{
        fila: 536, campos: filas[0].campos,
        imagenes: Array.from({ length: imagenes }, (_, i) => ({ casilla: i + 1, archivo: `xl/media/image${i}.jpeg` })),
        imagenesRechazadas: rechazadas.map((r) => ({ fila: 536, archivo: null, ...r })),
      }],
    });
    const resumen = (d: Partial<Diff>) => grupo(construirRevision(calculo(d, { filas }), estadoInicial()), 'alta-base|536').resumen;

    expect(resumen(alta(0, []))).not.toContain('imagen');
    expect(resumen(alta(1, []))).toContain('Se subirá 1 imagen pegada.');
    expect(resumen(alta(2, [{ casilla: 3, motivo: 'supera los 5 MB del bucket' }]))).toContain(
      'Se subirán 2 imágenes pegadas. La imagen 3 no se subirá: supera los 5 MB del bucket.'
    );
  });

  it('una obra sin fila se añade a la hoja salvo que se ignore', () => {
    const obras = [obraBase(118, { titulo: 'Cristo de los Andes' })];
    const r = construirRevision(calculo({ altasHoja: [{ obraId: 118 }] }, { obras }), estadoInicial());

    const g = grupo(r, 'alta-hoja|118');
    expect([g.numero, g.titulo, g.etiqueta, g.pendiente]).toEqual(['N.º 118', 'Cristo de los Andes', 'Solo está en la base', false]);
    expect(g.opciones).toEqual([
      { valor: 'anadir', etiqueta: 'Añadir fila a la hoja', elegida: true },
      { valor: 'ignorar', etiqueta: 'Ignorar', elegida: false },
    ]);
    expect(r.resumen.filasNuevas).toBe(1);
    const ignorada = construirRevision(calculo({ altasHoja: [{ obraId: 118 }] }, { obras }), elegir(estadoInicial(), { tipo: 'altaHoja', obraId: 118 }, 'ignorar'));
    expect(ignorada.resumen.filasNuevas).toBe(0);
  });

  it('los borrados solo se reportan, sin opciones', () => {
    const obras = [obraBase(89, { titulo: 'Bodegón con frutas' })];
    const filas = [filaHoja(140, { titulo: 'Mujer con cántaro' }, { idWeb: 102 })];
    const r = construirRevision(
      calculo({ avisos: [{ tipo: 'fila_borrada', obraId: 89 }, { tipo: 'obra_borrada_en_web', idWeb: 102, fila: 140 }] }, { obras, filas }),
      estadoInicial()
    );

    expect(grupo(r, 'fila-borrada|89')).toEqual(jasmine.objectContaining({ etiqueta: 'Desapareció de la hoja', opciones: [], ref: null }));
    expect(grupo(r, 'borrada-web|102')).toEqual(jasmine.objectContaining({ titulo: 'Mujer con cántaro', etiqueta: 'Borrada en la base', opciones: [] }));
    expect(r.resumen).toEqual({ haciaBase: 0, haciaHoja: 0, filasNuevas: 0, pendientes: 0 });
  });

  it('«No se tocarán» recoge ID duplicados, ID desconocidos y celdas de filas sin obra', () => {
    const filas = [filaHoja(71, {}, { idWeb: 66 }), filaHoja(140, {}, { idWeb: 66 }), filaHoja(300, {})];
    const r = construirRevision(
      calculo(
        {
          avisos: [
            { tipo: 'id_duplicado', idWeb: 66, filas: [71, 140] },
            { tipo: 'id_desconocido', idWeb: 999, fila: 88 },
            { tipo: 'fila', aviso: { fila: 140, campo: 'valor', motivo: 'el valor está en otra moneda', original: 'USD 1' } },
            { tipo: 'fila', aviso: { fila: 300, campo: 'id_web', motivo: 'el ID WEB no es un número entero positivo', original: 'abc' } },
          ],
        },
        { filas }
      ),
      estadoInicial()
    );

    expect(r.noSeTocan.map((x) => [x.tipo, x.titulo, x.detalle])).toEqual([
      ['ID duplicado', 'ID WEB 66 aparece 2 veces', 'Filas 71 y 140 de la hoja. Ninguna se toca.'],
      ['ID desconocido', 'ID WEB 999 no existe en el inventario', 'Fila 88 de la hoja. Puede ser una obra borrada o un ID tecleado a mano.'],
      ['Celda ilegible', 'Fila 140 · VALOR', 'el valor está en otra moneda: «USD 1»'],
      ['Celda ilegible', 'Fila 300 · ID WEB', 'el ID WEB no es un número entero positivo: «abc»'],
    ]);
    expect(r.grupos).toEqual([]);
  });

  it('los filtros cuentan las tarjetas y «Avisos» solo aparece si hay alguno', () => {
    const obras = [obraBase(14, {}), obraBase(31, {})];
    const r = construirRevision(
      calculo({ cambios: [cambio(14, 'ubicacion', 'hoja', 'a', 'b')], conflictos: [conflicto(31)], altasHoja: [{ obraId: 14 }] }, { obras }),
      estadoInicial()
    );

    expect(r.filtros.map((f) => `${f.etiqueta} · ${f.cuenta}`)).toEqual(['Todo · 3', 'Conflictos · 1', 'A la base · 0', 'A la hoja · 1', 'Altas y bajas · 1']);
  });
});

describe('aDecisiones', () => {
  it('traduce lo elegido en pantalla a las decisiones del núcleo', () => {
    let estado: EstadoRevision = estadoInicial();
    estado = elegir(estado, { tipo: 'conflicto', clave: '31|ubicacion' }, 'hoja');
    estado = elegir(estado, { tipo: 'cargo', clave: 'ANA' }, 'RECTORA');
    estado = elegir(estado, { tipo: 'imagen', clave: '14|imagen_1' }, 'dejar');
    estado = elegir(estado, { tipo: 'altaBase', fila: 212 }, 'crear');
    estado = elegir(estado, { tipo: 'altaBase', fila: 213 }, 'ignorar');
    estado = elegir(estado, { tipo: 'altaHoja', obraId: 118 }, 'ignorar');
    estado = elegir(estado, { tipo: 'descartado', clave: '14|valor' }, null);

    const decisiones = aDecisiones(estado, { ...diffVacio(), altasHoja: [{ obraId: 118 }, { obraId: 119 }] });

    expect([...decisiones.conflictos]).toEqual([['31|ubicacion', 'hoja']]);
    expect([...decisiones.conflictosCargo]).toEqual([['ANA', 'RECTORA']]);
    expect([...decisiones.avisosImagen]).toEqual([['14|imagen_1', 'dejar']]);
    expect([...decisiones.altasBase]).toEqual([212]);
    expect([...decisiones.altasHoja]).toEqual([119]);
    expect([...decisiones.descartados]).toEqual(['14|valor']);
  });

  it('elegir no modifica el estado anterior y volver a marcar una casilla la incluye', () => {
    const antes = estadoInicial();
    const desmarcado = elegir(antes, { tipo: 'descartado', clave: '14|valor' }, null);

    expect(antes.descartados.size).toBe(0);
    expect(elegir(desmarcado, { tipo: 'descartado', clave: '14|valor' }, null).descartados.size).toBe(0);
  });
});
