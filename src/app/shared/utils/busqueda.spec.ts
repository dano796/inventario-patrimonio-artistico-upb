import { patronSinTildes } from './busqueda';

const coincide = (busqueda: string, texto: string) => new RegExp(patronSinTildes(busqueda), 'i').test(texto);

describe('patronSinTildes', () => {
  it('encuentra el texto con o sin tilde, escriba quien busca con o sin ella', () => {
    for (const busqueda of ['oleo', 'óleo', 'ÓLEO']) {
      for (const texto of ['Óleo sobre tela', 'oleo sobre lienzo', 'OLEO']) {
        expect(coincide(busqueda, texto)).withContext(`${busqueda} en ${texto}`).toBeTrue();
      }
    }
    expect(coincide('Gomez', 'Pedro Nel Gómez')).toBeTrue();
    expect(coincide('Peña', 'TOBON PENA')).toBeTrue();
    expect(coincide('pena', 'Tobón Peña')).toBeTrue();
  });

  it('no deja de distinguir las letras', () => {
    expect(coincide('oleo', 'olea')).toBeFalse();
  });

  it('trata los caracteres especiales como texto', () => {
    expect(coincide('1.5', '125')).toBeFalse();
    expect(coincide('1.5', 'Mide 1.5 m')).toBeTrue();
    expect(coincide('(c)', 'Obra (c) 1990')).toBeTrue();
    expect(coincide('a+b', 'aab')).toBeFalse();
  });
});
