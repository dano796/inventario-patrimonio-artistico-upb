import { TestBed } from '@angular/core/testing';
import { ConfirmModalComponent } from './confirm-modal.component';

function montar(entradas: Record<string, unknown>) {
  TestBed.configureTestingModule({ imports: [ConfirmModalComponent] });
  const fixture = TestBed.createComponent(ConfirmModalComponent);
  for (const [clave, valor] of Object.entries(entradas)) fixture.componentRef.setInput(clave, valor);
  const respuestas: boolean[] = [];
  fixture.componentInstance.confirmar.subscribe((r) => respuestas.push(r));
  fixture.detectChanges();
  return { fixture, respuestas, html: fixture.nativeElement as HTMLElement };
}

describe('ConfirmModalComponent', () => {
  it('cerrado no pinta nada', () => {
    expect(montar({ abierto: false }).html.querySelector('[role="dialog"]')).toBeNull();
  });

  it('abierto muestra título, mensaje y el texto del botón', () => {
    const { html } = montar({ abierto: true, titulo: 'Eliminar obra del inventario', mensaje: '«X» se eliminará.', textoConfirmar: 'Sí, eliminar' });
    expect(html.querySelector('[role="dialog"]')?.textContent).toContain('Eliminar obra del inventario');
    expect(html.textContent).toContain('«X» se eliminará.');
    expect(html.textContent).toContain('Sí, eliminar');
  });

  it('responde true al confirmar y false al cancelar o con Escape', () => {
    const { html, respuestas } = montar({ abierto: true, textoConfirmar: 'Sí, eliminar' });
    const boton = (texto: string) => [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)!;
    boton('Sí, eliminar').click();
    boton('Cancelar').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(respuestas).toEqual([true, false, false]);
  });

  it('mientras carga no se puede cerrar y muestra el error si lo hay', () => {
    const { html, respuestas } = montar({ abierto: true, cargando: true, error: 'No se pudo eliminar.' });
    [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Cancelar')!.click();
    expect(respuestas).toEqual([]);
    expect(html.textContent).toContain('No se pudo eliminar.');
  });

  it('al abrirse lleva el foco a Cancelar y al cerrarse lo devuelve a quien lo abrió', () => {
    const disparador = document.body.appendChild(document.createElement('button'));
    disparador.focus();
    const { fixture, html } = montar({ abierto: false, textoConfirmar: 'Sí, eliminar' });
    fixture.componentRef.setInput('abierto', true);
    fixture.detectChanges();
    expect(document.activeElement?.textContent?.trim()).toBe('Cancelar');
    expect(html.contains(document.activeElement)).toBeTrue();
    fixture.componentRef.setInput('abierto', false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(disparador);
    disparador.remove();
  });

  it('Tab y Mayús+Tab no sacan el foco del diálogo', () => {
    const { fixture, html } = montar({ abierto: false, textoConfirmar: 'Sí, eliminar' });
    fixture.componentRef.setInput('abierto', true);
    fixture.detectChanges();
    const [cancelar, confirmar] = [...html.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')];
    const tab = (shiftKey: boolean) => {
      const evento = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      document.activeElement!.dispatchEvent(evento);
      return evento.defaultPrevented;
    };
    expect(tab(true)).toBeTrue();
    expect(document.activeElement).toBe(confirmar);
    expect(tab(false)).toBeTrue();
    expect(document.activeElement).toBe(cancelar);
  });

  it('si los botones se desactivan al cargar, el foco se queda en el diálogo', () => {
    const { fixture, html } = montar({ abierto: false, textoConfirmar: 'Sí, eliminar' });
    fixture.componentRef.setInput('abierto', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('cargando', true);
    fixture.detectChanges();
    expect(document.activeElement).toBe(html.querySelector('[role="dialog"]'));
  });

  it('mientras carga muestra el texto de carga que se le pasa', () => {
    const { html } = montar({ abierto: true, cargando: true, textoCargando: 'Guardando…' });
    expect(html.textContent).toContain('Guardando…');
    expect(html.textContent).not.toContain('Eliminando…');
  });
});
