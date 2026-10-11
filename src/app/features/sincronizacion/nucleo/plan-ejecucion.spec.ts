import { CambioPropuesto, Diff, diffVacio } from './diff-tipos';
import {
  claveCampo, claveCargo, ContextoPlan, Decisiones, decisionesPorDefecto, planificarEjecucion,
} from './plan-ejecucion';
import { filaHoja, obraBase } from './pruebas/fabricas';

const PREFIJO = 'https://x.supabase.co/storage/v1/object/public/imagenes-obras/';
const contexto = (): ContextoPlan => ({
  obras: new Map([[14, obraBase(14, { titulo: 'Paisaje', responsable: 'ANA PÉREZ', cargo: 'DECANA' })]]),
  filas: new Map([[2, filaHoja(2, { titulo: 'Paisaje', responsable: 'LUIS GÓMEZ', cargo: 'RECTOR' }, { idWeb: 14 })]]),
  prefijoBucket: PREFIJO,
});
const cambio = (c: Partial<CambioPropuesto> = {}): CambioPropuesto => ({
  obraId: 14, fila: 2, campo: 'ubicacion', destino: 'base', hoja: 'Bloque 11', base: 'Bloque 6', foto: 'Bloque 6', ...c,
});
const planDe = (diff: Partial<Diff>, decisiones: Partial<Decisiones> = {}) => {
  const completo = { ...diffVacio(), ...diff };
  return planificarEjecucion(completo, { ...decisionesPorDefecto(completo), ...decisiones }, contexto());
};

describe('planificarEjecucion', () => {
  it('un cambio hacia la base lleva el valor que tenía la base y la foto del valor nuevo', () => {
    const plan = planDe({ cambios: [cambio()] });
    expect(plan.peticion.campos).toEqual([
      { obra_id: 14, campo: 'ubicacion', esperado: 'Bloque 6', nuevo: 'Bloque 11', cargo: null, foto: { ubicacion: 'Bloque 11' } },
    ]);
    expect(plan.escrituras).toEqual([]);
  });

  it('un cambio hacia la hoja guarda lo leído para comprobarlo antes de escribir', () => {
    const plan = planDe({ cambios: [cambio({ destino: 'hoja', hoja: 'Bloque 6', base: 'Bloque 3' })] });
    expect(plan.escrituras).toEqual([
      { obraId: 14, fila: 2, destino: { tipo: 'campo', campo: 'ubicacion' }, valor: "'Bloque 3", leido: 'Bloque 6', foto: { ubicacion: 'Bloque 3' } },
    ]);
    expect(plan.peticion.campos).toEqual([]);
  });

  it('un NULL de la base se escribe en la hoja como «No registra»', () => {
    const plan = planDe({ cambios: [cambio({ destino: 'hoja', hoja: 'Bloque 6', base: null })] });
    expect(plan.escrituras.map((e) => [e.valor, e.foto])).toEqual([["'No registra", { ubicacion: null }]]);
  });

  it('un cambio desmarcado no se aplica', () => {
    const plan = planDe({ cambios: [cambio()] }, { descartados: new Set([claveCampo(14, 'ubicacion')]) });
    expect(plan.peticion.campos).toEqual([]);
    expect(plan.escrituras).toEqual([]);
  });

  it('un conflicto sin decidir no se aplica y cuenta como pendiente', () => {
    const conflicto = { obraId: 14, fila: 2, campo: 'ubicacion' as const, hoja: 'Bloque 11', base: 'Bloque 3', foto: 'Bloque 6' };
    expect(planDe({ conflictos: [conflicto] }).pendientes).toBe(1);
    const decidido = planDe({ conflictos: [conflicto] }, { conflictos: new Map([[claveCampo(14, 'ubicacion'), 'hoja' as const]]) });
    expect(decidido.pendientes).toBe(0);
    expect(decidido.peticion.campos.map((c) => [c.esperado, c.nuevo])).toEqual([['Bloque 3', 'Bloque 11']]);
  });

  it('reasignar el responsable en la base lleva el cargo de la fila, por si hay que crear la persona', () => {
    const plan = planDe({ cambios: [cambio({ campo: 'responsable', hoja: 'LUIS GÓMEZ', base: 'ANA PÉREZ', foto: 'ANA PÉREZ' })] });
    expect(plan.peticion.campos).toEqual([
      { obra_id: 14, campo: 'responsable', esperado: 'ANA PÉREZ', nuevo: 'LUIS GÓMEZ', cargo: 'RECTOR', foto: { responsable: 'LUIS GÓMEZ' } },
    ]);
  });

  it('escribir el responsable en la hoja escribe también su cargo', () => {
    const plan = planDe({
      cambios: [cambio({ campo: 'responsable', destino: 'hoja', hoja: 'LUIS GÓMEZ', base: 'ANA PÉREZ', foto: 'LUIS GÓMEZ' })],
    });
    expect(plan.escrituras.map((e) => [e.destino, e.valor, e.leido])).toEqual([
      [{ tipo: 'campo', campo: 'responsable' }, "'ANA PÉREZ", 'LUIS GÓMEZ'],
      [{ tipo: 'campo', campo: 'cargo' }, "'DECANA", 'RECTOR'],
    ]);
  });

  it('escribir el responsable en la hoja no toca un CARGO combinado', () => {
    const conCargoCombinado: ContextoPlan = {
      ...contexto(),
      filas: new Map([[2, filaHoja(2, { responsable: 'LUIS GÓMEZ', cargo: 'RECTOR' }, { idWeb: 14, combinados: ['cargo'] })]]),
    };
    const diff = { ...diffVacio(), cambios: [cambio({ campo: 'responsable', destino: 'hoja', hoja: 'LUIS GÓMEZ', base: 'ANA PÉREZ', foto: 'LUIS GÓMEZ' })] };
    const plan = planificarEjecucion(diff, decisionesPorDefecto(diff), conCargoCombinado);
    expect(plan.escrituras.map((e) => e.destino)).toEqual([{ tipo: 'campo', campo: 'responsable' }]);
  });

  it('si el responsable de la fila va a la hoja, no escribe además el cargo de la persona anterior', () => {
    const plan = planDe({
      cambios: [cambio({ campo: 'responsable', destino: 'hoja', hoja: 'LUIS GÓMEZ', base: 'ANA PÉREZ', foto: 'LUIS GÓMEZ' })],
      cargos: [{
        clave: 'LUIS GÓMEZ', nombre: 'LUIS GÓMEZ', destino: 'hoja', hoja: 'RECTOR', base: 'VICERRECTOR', foto: 'RECTOR',
        filas: [{ fila: 2, obraId: 14, cargo: 'RECTOR', combinada: false }, { fila: 5, obraId: 20, cargo: 'RECTOR', combinada: false }],
      }],
    });
    expect(plan.escrituras.filter((e) => e.fila === 2).map((e) => [e.destino, e.valor])).toEqual([
      [{ tipo: 'campo', campo: 'responsable' }, "'ANA PÉREZ"],
      [{ tipo: 'campo', campo: 'cargo' }, "'DECANA"],
    ]);
    expect(plan.escrituras.filter((e) => e.fila === 5).map((e) => e.valor)).toEqual(["'VICERRECTOR"]);
  });

  it('un cargo cambiado en la hoja actualiza la persona y la foto de todas sus obras', () => {
    const plan = planDe({
      cargos: [{
        clave: 'ANA PÉREZ', nombre: 'ANA PÉREZ', destino: 'base', hoja: 'DIRECTORA', base: 'DECANA', foto: 'DECANA',
        filas: [
          { fila: 2, obraId: 14, cargo: 'DIRECTORA', combinada: false },
          { fila: 3, obraId: 15, cargo: 'DIRECTORA', combinada: false },
        ],
      }],
    });
    expect(plan.peticion.cargos).toEqual([
      { clave: 'ANA PÉREZ', esperado: 'DECANA', nuevo: 'DIRECTORA', obras: [14, 15], foto: { cargo: 'DIRECTORA' } },
    ]);
  });

  it('un cambio de cargo desmarcado no se aplica', () => {
    const plan = planDe(
      { cargos: [{ clave: 'ANA PÉREZ', nombre: 'ANA PÉREZ', destino: 'base', hoja: 'DIRECTORA', base: 'DECANA', foto: 'DECANA', filas: [] }] },
      { descartados: new Set([claveCargo('ANA PÉREZ')]) }
    );
    expect(plan.peticion.cargos).toEqual([]);
  });

  it('un conflicto de cargo resuelto escribe en la hoja solo las filas que no tienen el cargo elegido', () => {
    const plan = planDe(
      {
        conflictosCargo: [{
          clave: 'ANA PÉREZ', nombre: 'ANA PÉREZ', opciones: ['DIRECTORA', 'DECANA'], base: 'DECANA', foto: 'DECANA',
          filas: [
            { fila: 2, obraId: 14, cargo: 'DIRECTORA', combinada: false },
            { fila: 3, obraId: 15, cargo: 'DECANA', combinada: false },
          ],
        }],
      },
      { conflictosCargo: new Map([['ANA PÉREZ', 'DIRECTORA']]) }
    );
    expect(plan.peticion.cargos).toEqual([
      { clave: 'ANA PÉREZ', esperado: 'DECANA', nuevo: 'DIRECTORA', obras: [14], foto: { cargo: 'DIRECTORA' } },
    ]);
    expect(plan.escrituras).toEqual([
      { obraId: 15, fila: 3, destino: { tipo: 'campo', campo: 'cargo' }, valor: "'DIRECTORA", leido: 'DECANA', foto: { cargo: 'DIRECTORA' } },
    ]);
  });

  it('una imagen: «Dejar la de la hoja» solo pone al día la foto; «Reemplazar» escribe =IMAGE()', () => {
    const aviso = {
      obraId: 14, fila: 2, casilla: 1, motivo: 'reemplazada' as const,
      imagen: { id: 81, url: `${PREFIJO}b.jpg` }, leida: { tipo: 'pegada' as const, archivo: null },
    };
    const dejar = planDe({ avisosImagen: [aviso] }, { avisosImagen: new Map([[claveCampo(14, 'imagen_1'), 'dejar' as const]]) });
    expect(dejar.peticion.fotos).toEqual([{ obra_id: 14, valores: { imagen_1: 81 } }]);
    expect(dejar.escrituras).toEqual([]);
    const reemplazar = planDe({ avisosImagen: [aviso] }, { avisosImagen: new Map([[claveCampo(14, 'imagen_1'), 'reemplazar' as const]]) });
    expect(reemplazar.escrituras).toEqual([
      { obraId: 14, fila: 2, destino: { tipo: 'imagen', casilla: 1 }, valor: `=IMAGE("${PREFIJO}b.jpg")`, leido: aviso.leida, foto: { imagen_1: 81 } },
    ]);
  });

  it('nunca reemplaza una casilla con texto', () => {
    const plan = planDe(
      { avisosImagen: [{ obraId: 14, fila: 2, casilla: 2, motivo: 'casilla_con_texto', imagen: { id: 81, url: `${PREFIJO}b.jpg` }, leida: { tipo: 'texto', valor: 'Ubicación no corresponde' } }] },
      { avisosImagen: new Map([[claveCampo(14, 'imagen_2'), 'reemplazar' as const]]) }
    );
    expect(plan.escrituras).toEqual([]);
  });

  it('las altas en la base solo entran si se eligen; las de la hoja, salvo que se desmarquen', () => {
    const diff = { altasBase: [{ fila: 9, campos: filaHoja(9, { titulo: 'Nueva' }).campos }], altasHoja: [{ obraId: 14 }] };
    const porDefecto = planDe(diff);
    expect(porDefecto.peticion.altas).toEqual([]);
    expect(porDefecto.altasHoja.length).toBe(1);
    expect(porDefecto.altasHoja[0].celdas).toContain({ destino: { tipo: 'campo', campo: 'titulo' }, valor: "'Paisaje" });
    expect(porDefecto.altasHoja[0].foto['titulo']).toBe('Paisaje');

    const elegidas = planDe(diff, { altasBase: new Set([9]), altasHoja: new Set() });
    expect(elegidas.peticion.altas.map((a) => [a.fila, a.foto['titulo']])).toEqual([[9, 'Nueva']]);
    expect(elegidas.altasHoja).toEqual([]);
  });

  it('las convergencias van a la foto, agrupadas por obra', () => {
    const plan = planDe({
      convergencias: [
        { obraId: 14, clave: 'titulo', valor: 'Paisaje' },
        { obraId: 14, clave: 'imagen_1', valor: 80 },
      ],
    });
    expect(plan.peticion.fotos).toEqual([{ obra_id: 14, valores: { titulo: 'Paisaje', imagen_1: 80 } }]);
  });
});
