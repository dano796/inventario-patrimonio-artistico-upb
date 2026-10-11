import { CAMPOS, CamposObra, FilaHoja } from '../hoja-obras';
import { ObraBase } from '../importacion';

export const camposVacios = (): CamposObra =>
  Object.fromEntries(CAMPOS.map((c) => [c, null])) as unknown as CamposObra;

export const filaHoja = (fila: number, campos: Partial<CamposObra>, extra: Partial<FilaHoja> = {}): FilaHoja => ({
  fila,
  idWeb: null,
  campos: { ...camposVacios(), ...campos },
  noConvertibles: [],
  combinados: [],
  heredados: [],
  imagenes: [{ tipo: 'vacia' }, { tipo: 'vacia' }, { tipo: 'vacia' }],
  ...extra,
});

export const obraBase = (id: number, campos: Partial<CamposObra>, imagenes: { id: number; url: string }[] = []): ObraBase => ({
  id,
  campos: { ...camposVacios(), ...campos },
  imagenes,
});
