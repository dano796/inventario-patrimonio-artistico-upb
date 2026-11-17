import { indexarPorIdWeb } from './diff-filas';
import { ValoresFoto } from './foto';
import { filaHoja, obraBase } from './pruebas/fabricas';

const conId = (fila: number, idWeb: number | null) => filaHoja(fila, { titulo: `Fila ${fila}` }, { idWeb });
const fotos = (...ids: number[]) => new Map<number, ValoresFoto>(ids.map((id) => [id, {}]));

describe('indexarPorIdWeb', () => {
  it('empareja cada fila con su obra por ID WEB, aunque el Excel esté reordenada', () => {
    const r = indexarPorIdWeb([conId(2, 11), conId(3, 10)], [obraBase(10, {}), obraBase(11, {})], fotos(10, 11));
    expect(r.pares.map((p) => [p.fila.fila, p.obra.id])).toEqual([[2, 11], [3, 10]]);
    expect(r.avisos).toEqual([]);
  });

  it('un ID WEB repetido se reporta y no se toca ninguna de las filas ni la obra', () => {
    const r = indexarPorIdWeb([conId(88, 140), conId(301, 140)], [obraBase(140, {})], fotos(140));
    expect(r.pares).toEqual([]);
    expect(r.avisos).toEqual([{ tipo: 'id_duplicado', idWeb: 140, filas: [88, 301] }]);
    expect(r.altasHoja).toEqual([]);
  });

  it('distingue una obra borrada en la web de un ID tecleado a mano', () => {
    const r = indexarPorIdWeb([conId(5, 57), conId(6, 999)], [], fotos(57));
    expect(r.avisos).toEqual([
      { tipo: 'obra_borrada_en_web', idWeb: 57, fila: 5 },
      { tipo: 'id_desconocido', idWeb: 999, fila: 6 },
    ]);
  });

  it('una fila sin ID WEB se propone como alta en la base', () => {
    const r = indexarPorIdWeb([conId(9, null)], [], fotos());
    expect(r.altasBase.map((a) => a.fila)).toEqual([9]);
  });

  it('no propone como alta una fila cuyo ID WEB no se pudo leer', () => {
    const r = indexarPorIdWeb([conId(9, null)], [], fotos(), new Set([9]));
    expect(r.altasBase).toEqual([]);
  });

  it('una obra sin fila: con foto es una fila borrada; sin foto, un alta en el Excel', () => {
    const r = indexarPorIdWeb([], [obraBase(20, {}), obraBase(21, {})], fotos(20));
    expect(r.avisos).toEqual([{ tipo: 'fila_borrada', obraId: 20 }]);
    expect(r.altasHoja).toEqual([{ obraId: 21 }]);
  });
});
