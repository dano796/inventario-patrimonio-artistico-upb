/**
 * La sincronización lleva las fotos a la hoja oficial como =IMAGE(), y Excel
 * para la web no muestra WEBP. Se guardan como JPG para que se vean allí.
 */
export async function aJpeg(file: File, calidad = 0.9): Promise<File> {
  if (file.type !== 'image/webp') return file;
  const mapa = await createImageBitmap(file);
  const lienzo = document.createElement('canvas');
  lienzo.width = mapa.width;
  lienzo.height = mapa.height;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(mapa, 0, 0);
  mapa.close();
  const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/jpeg', calidad));
  if (!blob) throw new Error('No se pudo convertir la imagen a JPG.');
  return new File([blob], file.name.replace(/\.webp$/i, '') + '.jpg', { type: 'image/jpeg' });
}
