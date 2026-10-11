import { diffImagenes } from './diff-imagenes';
import { ValoresFoto } from './foto';
import { CasillaImagen } from './hoja-obras';
import { filaHoja, obraBase } from './pruebas/fabricas';

const PREFIJO = 'https://x.supabase.co/storage/v1/object/public/imagenes-obras/';
const img = (id: number) => ({ id, url: `${PREFIJO}obra-${id}.jpg` });
const VACIA: CasillaImagen = { tipo: 'vacia' };
const conCasillas = (...casillas: CasillaImagen[]) =>
  filaHoja(2, { titulo: 'Paisaje' }, { idWeb: 1, imagenes: [...casillas, VACIA, VACIA, VACIA].slice(0, 3) });
const fotoImagenes = (...ids: (number | null)[]): ValoresFoto => ({
  imagen_1: ids[0] ?? null, imagen_2: ids[1] ?? null, imagen_3: ids[2] ?? null,
});
const diff = (casillas: CasillaImagen[], imagenes: { id: number; url: string }[], foto: ValoresFoto) =>
  diffImagenes(conCasillas(...casillas), obraBase(1, { titulo: 'Paisaje' }, imagenes), foto, PREFIJO);

describe('diffImagenes', () => {
  it('escribe =IMAGE() en una casilla vacía si la web tiene imagen', () => {
    const r = diff([VACIA], [img(80)], fotoImagenes());
    expect(r.imagenes).toEqual([{ obraId: 1, fila: 2, casilla: 1, accion: 'escribir', imagen: img(80), leida: VACIA }]);
  });

  it('actualiza una fórmula de la sincronización cuando la imagen cambió', () => {
    const r = diff([{ tipo: 'formula', url: img(80).url }], [img(81)], fotoImagenes(80));
    expect(r.imagenes.map((i) => [i.accion, i.imagen?.id])).toEqual([['escribir', 81]]);
  });

  it('vacía una fórmula de la sincronización si la imagen se borró en la web', () => {
    const r = diff([{ tipo: 'formula', url: img(80).url }], [], fotoImagenes(80));
    expect(r.imagenes.map((i) => [i.accion, i.imagen])).toEqual([['vaciar', null]]);
  });

  it('no toca una imagen pegada que sigue siendo la de la foto', () => {
    const r = diff([{ tipo: 'pegada', archivo: 'xl/media/image1.jpeg' }], [img(80)], fotoImagenes(80));
    expect(r).toEqual({ imagenes: [], avisosImagen: [], convergencias: [] });
  });

  it('avisa, sin escribir, si la web cambió la imagen y la hoja tiene una pegada a mano', () => {
    const r = diff([{ tipo: 'pegada', archivo: 'xl/media/image1.jpeg' }], [img(81)], fotoImagenes(80));
    expect(r.imagenes).toEqual([]);
    expect(r.avisosImagen.map((a) => [a.casilla, a.motivo])).toEqual([[1, 'reemplazada']]);
  });

  it('avisa si la web borró la imagen y la hoja tiene una pegada a mano', () => {
    const r = diff([{ tipo: 'pegada', archivo: null }], [], fotoImagenes(80));
    expect(r.avisosImagen.map((a) => a.motivo)).toEqual(['borrada']);
  });

  it('trata una fórmula con una URL ajena como una imagen pegada a mano', () => {
    const r = diff([{ tipo: 'formula', url: 'https://otra.web/x.jpg' }], [img(81)], fotoImagenes(80));
    expect(r.imagenes).toEqual([]);
    expect(r.avisosImagen.map((a) => a.motivo)).toEqual(['reemplazada']);
  });

  it('nunca toca una casilla con texto, pero avisa si la web tiene una imagen nueva para ella', () => {
    const r = diff(
      [{ tipo: 'pegada', archivo: null }, { tipo: 'texto', valor: 'Ubicación no corresponde' }],
      [img(80), img(81)],
      fotoImagenes(80)
    );
    expect(r.imagenes).toEqual([]);
    expect(r.avisosImagen.map((a) => [a.casilla, a.motivo])).toEqual([[2, 'casilla_con_texto']]);
  });

  it('la casilla n es la n-ésima imagen de la obra por id', () => {
    const r = diff([VACIA, VACIA], [img(90), img(80)], fotoImagenes());
    expect(r.imagenes.map((i) => [i.casilla, i.imagen?.id])).toEqual([[1, 80], [2, 90]]);
  });

  it('pone al día la foto si la hoja ya tiene la fórmula correcta', () => {
    const r = diff([{ tipo: 'formula', url: img(80).url }], [img(80)], fotoImagenes());
    expect(r.convergencias).toEqual([{ obraId: 1, clave: 'imagen_1', valor: 80 }]);
  });
});
