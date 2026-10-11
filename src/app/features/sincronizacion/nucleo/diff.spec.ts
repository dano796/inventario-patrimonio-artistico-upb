import { calcularDiff, hayCambios } from './diff';
import { Diff, diffVacio, ResponsableBase } from './diff-tipos';
import { ValoresFoto, valoresFoto } from './foto';
import { AvisoFila, FilaHoja, ResultadoHoja } from './hoja-obras';
import { notaOtraMoneda, ObraBase, planificarImportacion } from './importacion';
import { claveNombre, MOTIVO_OTRA_MONEDA } from './normalizacion';
import { filaHoja, obraBase } from './pruebas/fabricas';

const PREFIJO = 'https://x.supabase.co/storage/v1/object/public/imagenes-obras/';

const lectura = (filas: FilaHoja[], avisos: AvisoFila[] = []): ResultadoHoja => ({
  columnas: {} as ResultadoHoja['columnas'],
  columnasImagen: [14, 15, 16],
  columnaIdWeb: 18,
  filas,
  avisos,
});

/** Lo mismo que hizo scripts/importar-hoja.ts: obras desde la hoja y foto con los valores de la hoja. */
function importar(filas: FilaHoja[], avisos: AvisoFila[]) {
  const plan = planificarImportacion({
    filas,
    avisos,
    emparejamientos: filas.map((f) => ({
      fila: f.fila, autor: null, titulo: null, obraId: null, metodo: 'nueva' as const, candidatos: [], revisado: true,
    })),
    obras: [],
    obrasSinFila: [],
  });
  const responsables: ResponsableBase[] = plan.responsables.map((r, i) => ({ id: i + 1, nombre: r.nombre, cargo: r.cargo }));
  const porClave = new Map(plan.responsables.map((r, i) => [r.clave, responsables[i]]));
  let siguienteImagen = 500;
  const obras: ObraBase[] = [];
  const fotos = new Map<number, ValoresFoto>();
  const conId: FilaHoja[] = [];
  plan.altas.forEach((alta, i) => {
    const id = 100 + i;
    const fila = filas.find((f) => f.fila === alta.fila)!;
    const imagenes = plan.imagenes
      .filter((im) => im.fila === alta.fila)
      .map(() => {
        const n = siguienteImagen++;
        return { id: n, url: `${PREFIJO}importacion/${id}-${n}.jpg` };
      });
    const persona = alta.valores.responsable ? porClave.get(claveNombre(alta.valores.responsable)!)! : null;
    obras.push({ id, campos: { ...alta.valores, responsable: persona?.nombre ?? null, cargo: persona?.cargo ?? null }, imagenes });
    fotos.set(id, valoresFoto(fila.campos, imagenes.map((im) => im.id)));
    conId.push({ ...fila, idWeb: id });
  });
  return { obras, fotos, responsables, filas: conId };
}

describe('calcularDiff', () => {
  it('justo después de la importación no hay nada que sincronizar, salvo la nota del valor en otra moneda', () => {
    const filas = [
      filaHoja(
        2,
        { autor: 'Alex Kuilvietis', titulo: 'Cruz Típica', ano: 2002, responsable: 'JORGE IVÁN ÁLVAREZ GÓMEZ', cargo: 'COORDINADOR TEMPLO' },
        { imagenes: [{ tipo: 'pegada', archivo: 'xl/media/image1.jpeg' }, { tipo: 'texto', valor: 'Ubicación no corresponde' }, { tipo: 'vacia' }] }
      ),
      filaHoja(3, { titulo: 'Retrato  del Fundador', ubicacion: 'Bloque 6', valor: 1200000, responsable: 'Jorge Iván Álvarez Gómez ', cargo: 'COORDINADOR TEMPLO' }),
      filaHoja(4, { descripcion: 'Mosaico de egresados' }),
      filaHoja(135, { titulo: 'Obra en dólares' }, { noConvertibles: ['valor'] }),
      filaHoja(217, { titulo: 'Autor con imagen' }, { noConvertibles: ['autor'] }),
    ];
    const avisos: AvisoFila[] = [
      { fila: 135, campo: 'valor', motivo: MOTIVO_OTRA_MONEDA, original: 'USD 5,000' },
      { fila: 217, campo: 'autor', motivo: 'la celda contiene una imagen', original: '(imagen)' },
    ];
    const base = importar(filas, avisos);

    const diff = calcularDiff({
      lectura: lectura(base.filas, avisos), obras: base.obras, responsables: base.responsables, fotos: base.fotos, prefijoBucket: PREFIJO,
    });

    expect(diff.cambios).toEqual([
      { obraId: 103, fila: 135, campo: 'observaciones', destino: 'hoja', hoja: null, base: notaOtraMoneda('USD 5,000'), foto: null },
    ]);
    expect<Diff>({ ...diff, cambios: [], avisos: [] }).toEqual(diffVacio());
    expect(diff.avisos.map((a) => a.tipo)).toEqual(['fila', 'fila']);
  });

  it('no propone como alta una fila cuyo ID WEB no se pudo leer', () => {
    const diff = calcularDiff({
      lectura: lectura([filaHoja(9, { titulo: 'Con ID roto' })], [{ fila: 9, campo: 'id_web', motivo: 'la celda tiene un error de Excel', original: '#REF!' }]),
      obras: [], responsables: [], fotos: new Map(), prefijoBucket: PREFIJO,
    });
    expect(diff.altasBase).toEqual([]);
  });

  it('reúne los cambios de campos, cargos e imágenes de todas las filas', () => {
    const responsables = [{ id: 1, nombre: 'ANA PÉREZ', cargo: 'DECANA' }];
    const diff = calcularDiff({
      lectura: lectura([
        filaHoja(2, { titulo: 'Uno', ubicacion: 'Bloque 11', responsable: 'ANA PÉREZ', cargo: 'DIRECTORA' }, { idWeb: 10 }),
        filaHoja(3, { titulo: 'Dos' }, { idWeb: 11 }),
      ]),
      obras: [
        obraBase(10, { titulo: 'Uno', ubicacion: 'Bloque 6', responsable: 'ANA PÉREZ', cargo: 'DECANA' }),
        obraBase(11, { titulo: 'Dos' }, [{ id: 80, url: `${PREFIJO}a.jpg` }]),
      ],
      responsables,
      fotos: new Map([
        [10, valoresFoto({ ...obraBase(10, { titulo: 'Uno', ubicacion: 'Bloque 6', responsable: 'ANA PÉREZ', cargo: 'DECANA' }).campos }, [])],
        [11, valoresFoto(obraBase(11, { titulo: 'Dos' }).campos, [])],
      ]),
      prefijoBucket: PREFIJO,
    });
    expect(diff.cambios.map((c) => [c.obraId, c.campo, c.destino])).toEqual([[10, 'ubicacion', 'base']]);
    expect(diff.cargos.map((c) => [c.clave, c.destino])).toEqual([['ANA PÉREZ', 'base']]);
    expect(diff.imagenes.map((i) => [i.obraId, i.casilla, i.accion])).toEqual([[11, 1, 'escribir']]);
    expect(hayCambios(diff)).toBeTrue();
  });

  it('un diff sin propuestas no tiene cambios aunque tenga avisos', () => {
    expect(hayCambios({ ...diffVacio(), avisos: [{ tipo: 'fila_borrada', obraId: 1 }] })).toBeFalse();
  });
});
