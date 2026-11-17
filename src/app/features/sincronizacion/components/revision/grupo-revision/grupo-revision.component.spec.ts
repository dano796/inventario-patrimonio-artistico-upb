import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GrupoRevisionComponent } from './grupo-revision.component';
import { FilaRevision, GrupoRevision, RefDecision } from '../../../utils/revision';

const fila = (f: Partial<FilaRevision>): FilaRevision => ({
  clave: 'f', campo: 'ubicacion', hoja: { texto: 'Bloque 11', vacio: false }, base: { texto: 'Bloque 6', vacio: false },
  gana: 'hoja', accion: { tipo: 'casilla', destino: 'base', incluido: true, ref: { tipo: 'descartado', clave: '14|ubicacion' } },
  nota: null, notaAmbar: false, pendiente: false, ...f,
});

const grupo = (g: Partial<GrupoRevision>): GrupoRevision => ({
  clave: 'obra|14', tipo: 'obra', numero: 'N.º 14', titulo: 'Retrato del Fundador', etiqueta: '1 cambio', tono: 'acento',
  pendiente: false, filas: [fila({})], resumen: null, opciones: [], ref: null, filtros: ['todo'], ...g,
});

function montar(g: GrupoRevision) {
  TestBed.configureTestingModule({ imports: [GrupoRevisionComponent], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(GrupoRevisionComponent);
  fixture.componentRef.setInput('grupo', g);
  const emitidos: { ref: RefDecision; valor: string | null }[] = [];
  fixture.componentInstance.elegido.subscribe((e) => emitidos.push(e));
  fixture.detectChanges();
  return { html: fixture.nativeElement as HTMLElement, emitidos };
}

const boton = (html: HTMLElement, texto: string) =>
  [...html.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === texto) as HTMLButtonElement;

describe('GrupoRevisionComponent', () => {
  it('pinta el número, el título, la etiqueta y la acción del cambio', () => {
    const { html } = montar(grupo({}));

    expect(html.textContent).toContain('N.º 14');
    expect(html.textContent).toContain('Retrato del Fundador');
    expect(html.textContent).toContain('1 cambio');
    expect(html.textContent).toContain('Se escribe en la base');
    expect(html.querySelector('[data-gana]')?.textContent?.trim()).toBe('Bloque 11');
    expect(html.querySelector('[data-pierde]')?.textContent?.trim()).toBe('Bloque 6');
  });

  it('la casilla de un cambio emite su decisión', () => {
    const { html, emitidos } = montar(grupo({}));
    const casilla = html.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(casilla.checked).toBeTrue();
    casilla.click();

    expect(emitidos).toEqual([{ ref: { tipo: 'descartado', clave: '14|ubicacion' }, valor: null }]);
  });

  it('los botones de un conflicto emiten el lado elegido y marcan el que está elegido', () => {
    const conflicto = fila({
      gana: null, pendiente: true, nota: 'Cambió en las dos copias.', notaAmbar: true,
      accion: {
        tipo: 'opciones', ref: { tipo: 'conflicto', clave: '31|ubicacion' },
        opciones: [{ valor: 'hoja', etiqueta: 'Dejar el Excel', elegida: true }, { valor: 'base', etiqueta: 'Dejar la base', elegida: false }],
      },
    });
    const { html, emitidos } = montar(grupo({ filas: [conflicto], pendiente: true }));

    expect(boton(html, 'Dejar el Excel').getAttribute('aria-pressed')).toBe('true');
    expect(boton(html, 'Dejar la base').getAttribute('aria-pressed')).toBe('false');
    boton(html, 'Dejar la base').click();

    expect(emitidos).toEqual([{ ref: { tipo: 'conflicto', clave: '31|ubicacion' }, valor: 'base' }]);
    expect(html.textContent).toContain('Cambió en las dos copias.');
  });

  it('una fila que queda fuera enlaza a la ficha de la obra y la miniatura no repite el texto', () => {
    const fuera = fila({
      campo: 'imagen_1', gana: null, accion: { tipo: 'fuera', enlaceObra: 31 },
      base: { texto: 'Imagen de la web', vacio: false, miniatura: 'https://x/a.jpg' }, nota: 'Vuelve a subirla desde la ficha.',
    });
    const { html } = montar(grupo({ filas: [fuera] }));

    expect(html.textContent).toContain('No se puede copiar');
    expect(html.querySelector('a')?.getAttribute('href')).toBe('/obra/31');
    expect(html.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('una tarjeta de alta muestra su resumen y emite la opción elegida', () => {
    const { html, emitidos } = montar(grupo({
      clave: 'alta-base|212', tipo: 'presencia', numero: 'Fila 212', etiqueta: 'Solo está en el Excel', filas: [],
      resumen: 'Requiere una elección.', ref: { tipo: 'altaBase', fila: 212 }, pendiente: true,
      opciones: [{ valor: 'crear', etiqueta: 'Crear en la base', elegida: false }, { valor: 'ignorar', etiqueta: 'Ignorar', elegida: false }],
    }));

    expect(html.textContent).toContain('Requiere una elección.');
    boton(html, 'Crear en la base').click();

    expect(emitidos).toEqual([{ ref: { tipo: 'altaBase', fila: 212 }, valor: 'crear' }]);
  });
});
