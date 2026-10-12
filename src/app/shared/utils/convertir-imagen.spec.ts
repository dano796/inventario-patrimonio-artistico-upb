import { aJpeg } from './convertir-imagen';

async function imagenDePrueba(tipo: string, nombre: string, transparente = false): Promise<File> {
  const lienzo = document.createElement('canvas');
  lienzo.width = 40;
  lienzo.height = 20;
  const ctx = lienzo.getContext('2d')!;
  if (!transparente) {
    ctx.fillStyle = '#c00000';
    ctx.fillRect(0, 0, 40, 20);
  }
  const blob = await new Promise<Blob>((r) => lienzo.toBlob((b) => r(b!), tipo));
  return new File([blob], nombre, { type: tipo });
}

async function pixel(file: File): Promise<number[]> {
  const mapa = await createImageBitmap(file);
  const lienzo = document.createElement('canvas');
  lienzo.width = mapa.width;
  lienzo.height = mapa.height;
  const ctx = lienzo.getContext('2d')!;
  ctx.drawImage(mapa, 0, 0);
  return [...ctx.getImageData(5, 5, 1, 1).data].slice(0, 3);
}

describe('aJpeg', () => {
  it('convierte una imagen WEBP en un JPG con el mismo tamaño y el nombre cambiado', async () => {
    const jpg = await aJpeg(await imagenDePrueba('image/webp', 'retrato.webp'));
    expect(jpg.type).toBe('image/jpeg');
    expect(jpg.name).toBe('retrato.jpg');
    const mapa = await createImageBitmap(jpg);
    expect([mapa.width, mapa.height]).toEqual([40, 20]);
  });

  it('pone fondo blanco a lo transparente, que en JPG saldría negro', async () => {
    const jpg = await aJpeg(await imagenDePrueba('image/webp', 'logo.webp', true));
    const [r, g, b] = await pixel(jpg);
    expect(Math.min(r, g, b)).toBeGreaterThan(240);
  });

  it('deja tal cual las imágenes JPG y PNG', async () => {
    const png = await imagenDePrueba('image/png', 'plano.png');
    expect(await aJpeg(png)).toBe(png);
  });
});
