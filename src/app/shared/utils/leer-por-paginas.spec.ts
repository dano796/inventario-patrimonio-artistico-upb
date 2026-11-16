import { leerPorPaginas } from './leer-por-paginas';

describe('leerPorPaginas', () => {
  it('pide páginas hasta que una llega vacía', async () => {
    const paginas = [[1, 2], [3], []];
    const pedidas: [number, number][] = [];
    const filas = await leerPorPaginas<number>(async (desde, hasta) => {
      pedidas.push([desde, hasta]);
      return { data: paginas.shift() ?? [], error: null };
    });
    expect(filas).toEqual([1, 2, 3]);
    expect(pedidas).toEqual([[0, 999], [2, 1001], [3, 1002]]);
  });

  it('propaga el error de una página', async () => {
    await expectAsync(leerPorPaginas(async () => ({ data: null, error: new Error('sin permiso') }))).toBeRejectedWithError('sin permiso');
  });
});
