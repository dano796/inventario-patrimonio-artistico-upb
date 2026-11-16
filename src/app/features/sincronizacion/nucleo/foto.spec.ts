import { camposFoto, normalizarCampo, valoresFoto } from './foto';
import { camposVacios } from './pruebas/fabricas';

describe('normalizarCampo', () => {
  it('recorta y colapsa espacios, y trata «No registra» como NULL', () => {
    expect(normalizarCampo('titulo', '  Retrato   del  Fundador ')).toBe('Retrato del Fundador');
    expect(normalizarCampo('ubicacion', 'No registra')).toBeNull();
  });

  it('compara el responsable sin mayúsculas ni espacios de más', () => {
    expect(normalizarCampo('responsable', 'Jobany  Alonso Tobon Peña')).toBe(
      normalizarCampo('responsable', 'JOBANY ALONSO TOBON PEÑA')
    );
  });

  it('respeta mayúsculas y acentos del texto libre', () => {
    expect(normalizarCampo('titulo', 'Óleo')).not.toBe(normalizarCampo('titulo', 'oleo'));
  });

  it('deja los números como están', () => {
    expect(normalizarCampo('valor', 1200000)).toBe(1200000);
  });
});

describe('valoresFoto', () => {
  it('guarda cada campo normalizado y el id de la imagen de cada casilla', () => {
    const foto = valoresFoto({ ...camposVacios(), titulo: ' Paisaje ', responsable: 'Ana  Pérez', valor: 5 }, [80]);
    expect(foto).toEqual({
      ...camposFoto(camposVacios()),
      titulo: 'Paisaje',
      responsable: 'ANA PÉREZ',
      valor: 5,
      imagen_1: 80,
      imagen_2: null,
      imagen_3: null,
    });
  });
});
