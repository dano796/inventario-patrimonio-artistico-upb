import { borrarBorrador, CLAVE_BORRADOR, guardarBorrador, restaurarBorrador } from './borrador';
import { elegir, estadoInicial, EstadoRevision } from './revision';
import { Diff, diffVacio } from '../nucleo/diff-tipos';
import { camposVacios } from '../nucleo/pruebas/fabricas';

const diff = (): Diff => ({
  ...diffVacio(),
  cambios: [{ obraId: 14, fila: 15, campo: 'valor', destino: 'hoja', hoja: 1200000, base: 1500000, foto: 1200000 }],
  conflictos: [{ obraId: 31, fila: 32, campo: 'ubicacion', hoja: 'Bloque 11', base: 'Bloque 3', foto: 'Bloque 6' }],
  conflictosCargo: [{ clave: 'JOBANY ALONSO', nombre: 'JOBANY ALONSO', opciones: ['RECTOR', 'DECANO'], base: 'RECTOR', foto: undefined, filas: [] }],
  avisosImagen: [{ obraId: 14, fila: 15, casilla: 1, motivo: 'reemplazada', imagen: { id: 80, url: 'u' }, leida: { tipo: 'pegada', archivo: null } }],
  altasBase: [{ fila: 212, campos: { ...camposVacios(), titulo: 'Naturaleza muerta' }, imagenes: [], imagenesRechazadas: [] }],
  altasHoja: [{ obraId: 118 }],
});

function decidido(): EstadoRevision {
  let estado = estadoInicial();
  estado = elegir(estado, { tipo: 'descartado', clave: '14|valor' }, null);
  estado = elegir(estado, { tipo: 'conflicto', clave: '31|ubicacion' }, 'base');
  estado = elegir(estado, { tipo: 'cargo', clave: 'JOBANY ALONSO' }, 'DECANO');
  estado = elegir(estado, { tipo: 'imagen', clave: '14|imagen_1' }, 'dejar');
  estado = elegir(estado, { tipo: 'altaBase', fila: 212 }, 'crear');
  return elegir(estado, { tipo: 'altaHoja', obraId: 118 }, 'ignorar');
}

describe('borrador de decisiones', () => {
  afterEach(() => borrarBorrador());

  it('restaura todas las decisiones si el diff no cambió', () => {
    guardarBorrador('item', diff(), decidido());

    const restaurado = restaurarBorrador('item', diff())!;

    expect([restaurado.recuperadas, restaurado.total]).toEqual([6, 6]);
    expect(restaurado.estado).toEqual(decidido());
  });

  it('no recupera una decisión cuyo elemento cambió desde que se tomó', () => {
    guardarBorrador('item', diff(), decidido());
    const cambiado = diff();
    cambiado.conflictos[0] = { ...cambiado.conflictos[0], base: 'Bloque 4' };

    const restaurado = restaurarBorrador('item', cambiado)!;

    expect([restaurado.recuperadas, restaurado.total]).toEqual([5, 6]);
    expect(restaurado.estado.conflictos.size).toBe(0);
  });

  it('no recupera la decisión de un alta si cambiaron sus imágenes', () => {
    guardarBorrador('item', diff(), decidido());
    const cambiado = diff();
    cambiado.altasBase[0] = { ...cambiado.altasBase[0], imagenes: [{ casilla: 1, archivo: 'xl/media/image1.jpeg' }] };

    const restaurado = restaurarBorrador('item', cambiado)!;

    expect([restaurado.recuperadas, restaurado.total]).toEqual([5, 6]);
    expect(restaurado.estado.altasBase.size).toBe(0);
  });

  it('no recupera decisiones de otra hoja', () => {
    guardarBorrador('item', diff(), decidido());
    expect(restaurarBorrador('otra', diff())).toBeNull();
  });

  it('no guarda en claro ningún valor del Excel ni de la base', () => {
    guardarBorrador('item', diff(), decidido());

    const guardado = sessionStorage.getItem(CLAVE_BORRADOR)!;

    for (const texto of ['Bloque', 'JOBANY', 'DECANO', 'RECTOR', 'Naturaleza', '1200000']) expect(guardado).not.toContain(texto);
  });

  it('sin borrador o con uno ilegible no restaura nada', () => {
    expect(restaurarBorrador('item', diff())).toBeNull();
    sessionStorage.setItem(CLAVE_BORRADOR, '{roto');
    expect(restaurarBorrador('item', diff())).toBeNull();
  });
});
