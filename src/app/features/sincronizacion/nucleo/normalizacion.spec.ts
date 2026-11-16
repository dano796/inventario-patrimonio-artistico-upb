import {
  claveEmparejamiento,
  claveNombre,
  convertirAno,
  convertirValor,
  limpiarTexto,
  MOTIVO_OTRA_MONEDA,
  normalizarTexto,
} from './normalizacion';

describe('normalizacion', () => {
  describe('limpiarTexto', () => {
    it('trata vacío y «No registra» como NULL', () => {
      expect(limpiarTexto('')).toBeNull();
      expect(limpiarTexto('   ')).toBeNull();
      expect(limpiarTexto('No registra')).toBeNull();
      expect(limpiarTexto(' NO  REGISTRA ')).toBeNull();
      expect(limpiarTexto(null)).toBeNull();
      expect(limpiarTexto(undefined)).toBeNull();
    });

    it('recorta los bordes y conserva los saltos de línea internos', () => {
      expect(limpiarTexto('  Muestra\r\nEscultura \t\n')).toBe('Muestra\nEscultura');
    });

    it('convierte números a texto', () => {
      expect(limpiarTexto(2002)).toBe('2002');
    });
  });

  describe('normalizarTexto', () => {
    it('colapsa espacios internos y respeta mayúsculas y acentos', () => {
      expect(normalizarTexto('Retrato   del\nFundador')).toBe('Retrato del Fundador');
      expect(normalizarTexto('Título')).not.toBe(normalizarTexto('titulo'));
    });
  });

  describe('claveNombre', () => {
    it('iguala mayúsculas y espacios, como el índice único de responsables', () => {
      expect(claveNombre('Lina María  Cardona Gallo ')).toBe('LINA MARÍA CARDONA GALLO');
      expect(claveNombre('jobany alonso tobon peña')).toBe(claveNombre('JOBANY ALONSO TOBON PEÑA'));
      expect(claveNombre('No registra')).toBeNull();
    });
  });

  describe('claveEmparejamiento', () => {
    it('quita acentos, puntuación y mayúsculas', () => {
      expect(claveEmparejamiento('Serie "Soledad del Alma"')).toBe('serie soledad del alma');
      expect(claveEmparejamiento('Bolívar')).toBe(claveEmparejamiento('BOLIVAR'));
      expect(claveEmparejamiento('DIMENSION (cm)')).toBe('dimension cm');
      expect(claveEmparejamiento(null)).toBe('');
    });
  });

  describe('convertirAno', () => {
    const ano = (v: unknown) => convertirAno(v, 2026);

    it('acepta números y extrae el único año de un texto', () => {
      expect(ano(2002)).toEqual({ ok: true, valor: 2002 });
      expect(ano(2002.0000001)).toEqual({ ok: true, valor: 2002 });
      expect(ano('Ca. 1998')).toEqual({ ok: true, valor: 1998 });
      expect(ano('14 de septiembre de 1978')).toEqual({ ok: true, valor: 1978 });
      expect(ano('Agosto de 2006')).toEqual({ ok: true, valor: 2006 });
    });

    it('trata «No registra» y vacío como NULL', () => {
      expect(ano('No registra')).toEqual({ ok: true, valor: null });
      expect(ano(null)).toEqual({ ok: true, valor: null });
    });

    it('rechaza lo que no tiene exactamente un año válido', () => {
      expect(ano('1950-1955').ok).toBeFalse();
      expect(ano('siglo XIX').ok).toBeFalse();
      expect(ano('12345').ok).toBeFalse();
      expect(ano(2030).ok).toBeFalse();
      expect(ano(19.5).ok).toBeFalse();
    });
  });

  describe('convertirValor', () => {
    it('acepta números y los redondea a pesos', () => {
      expect(convertirValor(500000)).toEqual({ ok: true, valor: 500000 });
      expect(convertirValor(1199999.9999999)).toEqual({ ok: true, valor: 1200000 });
    });

    it('quita el símbolo de pesos y los separadores de miles', () => {
      expect(convertirValor('$1.200.000')).toEqual({ ok: true, valor: 1200000 });
      expect(convertirValor('1,200,000')).toEqual({ ok: true, valor: 1200000 });
      expect(convertirValor('$ 800000')).toEqual({ ok: true, valor: 800000 });
    });

    it('trata «No registra» como NULL', () => {
      expect(convertirValor('No registra')).toEqual({ ok: true, valor: null });
    });

    it('rechaza separadores de miles mezclados, que no se sabe si llevan decimales', () => {
      expect(convertirValor('12.000.500')).toEqual({ ok: true, valor: 12000500 });
      expect(convertirValor('12,000.500').ok).toBeFalse();
      expect(convertirValor('1.200,000').ok).toBeFalse();
    });

    it('rechaza otra moneda y los formatos que no reconoce', () => {
      expect(convertirValor('USD 5,000')).toEqual({ ok: false, motivo: MOTIVO_OTRA_MONEDA });
      expect(convertirValor('US$ 300')).toEqual({ ok: false, motivo: MOTIVO_OTRA_MONEDA });
      expect(convertirValor('€ 300')).toEqual({ ok: false, motivo: MOTIVO_OTRA_MONEDA });
      expect(convertirValor('sin avalúo').ok).toBeFalse();
      expect(convertirValor('1.200,50').ok).toBeFalse();
      expect(convertirValor(-5).ok).toBeFalse();
    });
  });
});
