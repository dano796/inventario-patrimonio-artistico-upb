import { formulaImagen, valorParaHoja } from './celdas-hoja';

const PREFIJO = 'https://x.supabase.co/storage/v1/object/public/imagenes-obras/';

describe('valorParaHoja', () => {
  it('escribe NULL como «No registra»', () => {
    expect(valorParaHoja(null)).toBe('No registra');
  });

  it('deja los números como números', () => {
    expect(valorParaHoja(1200000)).toBe(1200000);
  });

  it('fuerza como texto lo que Excel tomaría por fórmula', () => {
    expect(valorParaHoja('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(valorParaHoja('+57 300')).toBe("'+57 300");
    expect(valorParaHoja('-')).toBe("'-");
    expect(valorParaHoja('@usuario')).toBe("'@usuario");
    expect(valorParaHoja('Óleo sobre tela')).toBe('Óleo sobre tela');
  });
});

describe('formulaImagen', () => {
  it('escribe =IMAGE con la URL del bucket', () => {
    expect(formulaImagen(`${PREFIJO}a.jpg`, PREFIJO)).toBe(`=IMAGE("${PREFIJO}a.jpg")`);
  });

  it('rechaza una URL que no es del bucket o que podría romper la fórmula', () => {
    expect(() => formulaImagen('https://otra.web/a.jpg', PREFIJO)).toThrowError(/bucket/);
    expect(() => formulaImagen(`${PREFIJO}a".jpg`, PREFIJO)).toThrowError(/bucket/);
  });
});
