import { TestBed } from '@angular/core/testing';
import { ResumenEjecucionComponent } from './resumen-ejecucion.component';
import { Revision } from '../../../utils/revision';

const revision = (pendientes: { conflictos: number; altas: number }): Revision => ({
  grupos: [], noSeTocan: [], filtros: [],
  resumen: { haciaBase: 3, haciaHoja: 2, filasNuevas: 1, pendientes: pendientes.conflictos + pendientes.altas },
  pendientes,
});

function montar(r: Revision, aplicando = false) {
  TestBed.configureTestingModule({ imports: [ResumenEjecucionComponent] });
  const fixture = TestBed.createComponent(ResumenEjecucionComponent);
  fixture.componentRef.setInput('revision', r);
  fixture.componentRef.setInput('aplicando', aplicando);
  let aprobado = 0;
  let comparado = 0;
  fixture.componentInstance.aprobar.subscribe(() => aprobado++);
  fixture.componentInstance.comparar.subscribe(() => comparado++);
  fixture.detectChanges();
  const html = fixture.nativeElement as HTMLElement;
  const volver = Array.from(html.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Volver a comparar') as HTMLButtonElement;
  return { html, boton: html.querySelector('button') as HTMLButtonElement, volver, aprobados: () => aprobado, comparados: () => comparado };
}

describe('ResumenEjecucionComponent', () => {
  it('con decisiones pendientes no deja aplicar y dice qué falta', () => {
    const { html, boton } = montar(revision({ conflictos: 2, altas: 1 }));

    expect(html.textContent).toContain('Cambios hacia la base');
    expect(html.textContent).toContain('Falta decidir 2 conflictos y 1 alta antes de aplicar.');
    expect(boton.disabled).toBeTrue();
  });

  it('sin pendientes emite aprobar', () => {
    const { html, boton, aprobados } = montar(revision({ conflictos: 0, altas: 0 }));

    expect(html.textContent).not.toContain('Falta decidir');
    boton.click();

    expect(aprobados()).toBe(1);
  });

  it('mientras aplica lo dice y no deja volver a pulsar', () => {
    const { boton } = montar(revision({ conflictos: 0, altas: 0 }), true);

    expect(boton.textContent?.trim()).toBe('Aplicando…');
    expect(boton.disabled).toBeTrue();
  });

  it('deja volver a comparar sin recargar la página', () => {
    const { volver, comparados } = montar(revision({ conflictos: 1, altas: 0 }));

    volver.click();

    expect(comparados()).toBe(1);
  });

  it('mientras aplica no deja volver a comparar', () => {
    const { volver } = montar(revision({ conflictos: 0, altas: 0 }), true);

    expect(volver.disabled).toBeTrue();
  });
});
