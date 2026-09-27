import { strToU8 } from 'fflate';
import { descomprimirXlsx, ErrorXlsx, leerHoja, tamanosDeMedios } from './leer-xlsx';
import { crearXlsxDePrueba, OpcionesXlsx } from './pruebas/xlsx-de-prueba';
import {
  agruparFilasContiguas,
  columnaALetra,
  expandirRango,
  letraAColumna,
  separarReferencia,
} from './rangos';

const parser = new DOMParser();
const leer = (opciones: OpcionesXlsx) =>
  leerHoja(descomprimirXlsx(crearXlsxDePrueba(opciones)), 'Inventario Obras', parser);

describe('leerHoja', () => {
  it('lee la pestaña por su nombre, no por su posición', () => {
    const hoja = leer({ celdas: [{ ref: 'A1', texto: 'AUTOR' }] });
    expect(hoja.celdas.get('A1')).toEqual({ tipo: 'texto', valor: 'AUTOR' });
  });

  it('distingue texto, número, fórmula y error', () => {
    const hoja = leer({
      celdas: [
        { ref: 'A2', formula: 'ROW(A1)', valorFormula: 1 },
        { ref: 'B2', texto: 'Cruz Típica de Lituania' },
        { ref: 'F2', numero: 2002 },
        { ref: 'O2', formula: '_xlfn.IMAGE("https://x.test/a.jpg")', valorFormula: '#VALUE!' },
        { ref: 'Q2', error: '#N/A' },
      ],
    });
    expect(hoja.celdas.get('A2')).toEqual({ tipo: 'formula', formula: 'ROW(A1)', valor: 1 });
    expect(hoja.celdas.get('B2')).toEqual({ tipo: 'texto', valor: 'Cruz Típica de Lituania' });
    expect(hoja.celdas.get('F2')).toEqual({ tipo: 'numero', valor: 2002 });
    expect(hoja.celdas.get('O2')).toEqual({
      tipo: 'formula',
      formula: '_xlfn.IMAGE("https://x.test/a.jpg")',
      valor: '#VALUE!',
    });
    expect(hoja.celdas.get('Q2')).toEqual({ tipo: 'error', valor: '#N/A' });
  });

  it('resuelve cada imagen en celda a su archivo dentro del zip', () => {
    const hoja = leer({
      celdas: [
        { ref: 'N2', imagen: 'image7.jpeg' },
        { ref: 'N3', imagen: 'image2.png' },
      ],
    });
    expect(hoja.celdas.get('N2')).toEqual({ tipo: 'imagen', archivo: 'xl/media/image7.jpeg' });
    expect(hoja.celdas.get('N3')).toEqual({ tipo: 'imagen', archivo: 'xl/media/image2.png' });
  });

  it('devuelve las celdas combinadas', () => {
    const hoja = leer({ celdas: [{ ref: 'I3', numero: 1 }], combinadas: ['I3:I5', 'J3:J4'] });
    expect(hoja.combinadas).toEqual(['I3:I5', 'J3:J4']);
  });

  it('falla con un mensaje claro si la pestaña no existe', () => {
    const archivos = descomprimirXlsx(crearXlsxDePrueba({ nombreHoja: 'Otra cosa', celdas: [] }));
    expect(() => leerHoja(archivos, 'Inventario Obras', parser)).toThrowError(ErrorXlsx, /Inventario Obras/);
  });
});

describe('descomprimirXlsx', () => {
  it('omite xl/media salvo que se pidan, y aun así informa de su tamaño', () => {
    const datos = crearXlsxDePrueba({ celdas: [], medios: { 'image1.jpeg': strToU8('12345') } });
    expect(descomprimirXlsx(datos)['xl/media/image1.jpeg']).toBeUndefined();
    expect(descomprimirXlsx(datos, true)['xl/media/image1.jpeg']).toBeDefined();
    expect(tamanosDeMedios(datos)).toEqual({ 'xl/media/image1.jpeg': 5 });
  });
});

describe('rangos', () => {
  it('convierte entre letras y números de columna', () => {
    expect(letraAColumna('A')).toBe(1);
    expect(letraAColumna('Z')).toBe(26);
    expect(letraAColumna('AA')).toBe(27);
    expect(columnaALetra(18)).toBe('R');
    expect(columnaALetra(27)).toBe('AA');
    expect(separarReferencia('N12')).toEqual({ columna: 14, fila: 12 });
    expect(expandirRango('I128:I132')).toEqual({
      desde: { columna: 9, fila: 128 },
      hasta: { columna: 9, fila: 132 },
    });
  });

  it('agrupa filas contiguas en rangos', () => {
    expect(agruparFilasContiguas([5, 3, 4, 9, 10, 3])).toEqual([
      { inicio: 3, fin: 5 },
      { inicio: 9, fin: 10 },
    ]);
    expect(agruparFilasContiguas([])).toEqual([]);
  });
});
