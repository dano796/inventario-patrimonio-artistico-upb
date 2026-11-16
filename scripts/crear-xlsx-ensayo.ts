import { writeFileSync } from 'node:fs';
import { crearXlsxDePrueba } from '../src/app/features/sincronizacion/nucleo/pruebas/xlsx-de-prueba';

const PNG_1X1 = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
);
const encabezados = [
  'NÚMERO DE INVENTARIO', 'AUTOR', 'TITULO', 'TECNICA', 'DIMENSION (cm)', 'FECHA ELABORACIÓN', 'UBICACIÓN',
  'BLOQUE ASIGNADO', 'VALOR', 'DESCRIPCION', 'RESPONSABLE', 'CARGO', 'OBSERVACIONES', 'IMAGEN 1', 'IMAGEN 2', 'IMAGEN 3',
];
const columna = (i: number) => String.fromCharCode(65 + i);

writeFileSync(
  process.argv[2] ?? 'importacion/ensayo.xlsx',
  crearXlsxDePrueba({
    celdas: [
      ...encabezados.map((texto, i) => ({ ref: `${columna(i)}1`, texto })),
      { ref: 'B2', texto: 'ENSAYO Autor' }, { ref: 'C2', texto: 'ENSAYO Obra con imagen' },
      { ref: 'F2', texto: 'Ca. 1998' }, { ref: 'I2', texto: '$1.200.000' },
      { ref: 'K2', texto: 'ENSAYO RESPONSABLE' }, { ref: 'L2', texto: 'ENSAYO CARGO' },
      { ref: 'N2', imagen: 'image1.png' },
      { ref: 'B3', texto: 'ENSAYO Autor' }, { ref: 'C3', texto: 'ENSAYO Obra en dólares' },
      { ref: 'I3', texto: 'USD 5,000' }, { ref: 'K3', texto: 'ensayo responsable' },
    ],
    medios: { 'image1.png': PNG_1X1 },
  })
);
