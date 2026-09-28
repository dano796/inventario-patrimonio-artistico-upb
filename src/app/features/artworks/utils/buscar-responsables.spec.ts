import { Responsable } from '../../../shared/models/responsable.model';
import { buscarPorNombre, filtrarResponsables, responsablesParecidos } from './buscar-responsables';

const r = (id: number, nombre: string, cargo: string | null = null): Responsable => ({ id, nombre, cargo });
const LISTA = [
  r(1, 'JOBANY ALONSO TOBON PEÑA', 'COORDINADOR ADMINISTRATIVO SISTEMA DE BIBLIOTECAS'),
  r(2, 'MARIA ISABEL URIBE ALZATE', 'AUXILIAR RECTORIA GENERAL'),
  r(3, 'RUBY MILENA OCAMPO TANGARIFE', 'COORDINADORA DE BIBLIOTECA ESCOLAR'),
  r(4, 'Lina María Cardona Gallo', 'Gestión de contenidos'),
];

describe('filtrarResponsables', () => {
  it('encuentra por cualquier palabra del nombre o del cargo, sin tildes ni mayúsculas', () => {
    expect(filtrarResponsables('tobón', LISTA).map((x) => x.id)).toEqual([1]);
    expect(filtrarResponsables('biblio', LISTA).map((x) => x.id)).toEqual([1, 3]);
    expect(filtrarResponsables('maria gallo', LISTA).map((x) => x.id)).toEqual([4]);
  });

  it('con el texto vacío devuelve todos, ordenados por nombre', () => {
    expect(filtrarResponsables('  ', LISTA).map((x) => x.id)).toEqual([1, 4, 2, 3]);
  });
});

describe('responsablesParecidos', () => {
  it('sugiere personas que comparten alguna palabra del nombre', () => {
    expect(responsablesParecidos('maria camila restrepo', LISTA).map((x) => x.id)).toEqual([4, 2]);
  });

  it('ignora palabras cortas y no sugiere nada sin coincidencias', () => {
    expect(responsablesParecidos('de la', LISTA)).toEqual([]);
    expect(responsablesParecidos('Pedro Pérez', LISTA)).toEqual([]);
  });
});

describe('buscarPorNombre', () => {
  it('reconoce el mismo nombre con otras mayúsculas o espacios, como el índice único', () => {
    expect(buscarPorNombre('  lina maría   cardona gallo', LISTA)?.id).toBe(4);
    expect(buscarPorNombre('Lina Cardona', LISTA)).toBeUndefined();
  });
});
