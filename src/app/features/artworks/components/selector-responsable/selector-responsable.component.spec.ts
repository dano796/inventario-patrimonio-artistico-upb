import { TestBed } from '@angular/core/testing';
import { SelectorResponsableComponent } from './selector-responsable.component';
import { Responsable } from '../../../../shared/models/responsable.model';

const RESPONSABLES: Responsable[] = [
  { id: 1, nombre: 'ANA LUCÍA RESTREPO MESA', cargo: 'JEFE DE CENTRO' },
  { id: 2, nombre: 'BERNARDO GIRALDO PÉREZ', cargo: 'DIRECTOR FINANCIERO' },
  { id: 3, nombre: 'CAROLINA OSPINA RÍOS', cargo: null },
] as Responsable[];

describe('SelectorResponsableComponent', () => {
  const montar = () => {
    const fixture = TestBed.createComponent(SelectorResponsableComponent);
    fixture.componentRef.setInput('responsables', RESPONSABLES);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const abrir = () => {
      (raiz.querySelector('#responsable') as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    const dialogo = () => raiz.querySelector('[role="dialog"]');
    const opciones = () => [...raiz.querySelectorAll('[role="dialog"] li button')] as HTMLButtonElement[];
    return { fixture, raiz, abrir, dialogo, opciones, componente: fixture.componentInstance };
  };

  it('la lista no se abre como desplegable sobre el formulario: el campo abre una ventana', () => {
    const { abrir, dialogo, raiz } = montar();
    expect(dialogo()).toBeNull();
    expect(raiz.querySelector('#responsable')?.getAttribute('aria-haspopup')).toBe('dialog');
    abrir();
    expect(dialogo()?.getAttribute('aria-modal')).toBe('true');
  });

  it('muestra todos los responsables y filtra por nombre o cargo', () => {
    const { abrir, opciones, fixture, raiz } = montar();
    abrir();
    expect(opciones().length).toBe(3);
    const buscador = raiz.querySelector('[role="dialog"] input') as HTMLInputElement;
    buscador.value = 'financ';
    buscador.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(opciones().map((o) => o.textContent?.trim().split(/\s+/)[0])).toEqual(['BERNARDO']);
  });

  it('elegir una persona la selecciona y cierra la ventana', () => {
    const { abrir, opciones, fixture, dialogo, componente } = montar();
    abrir();
    opciones()[0].click();
    fixture.detectChanges();
    expect(componente.seleccion()).toEqual({ tipo: 'existente', responsable: RESPONSABLES[0] });
    expect(dialogo()).toBeNull();
  });

  it('Escape cierra la ventana sin elegir', () => {
    const { abrir, fixture, dialogo, componente } = montar();
    abrir();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(dialogo()).toBeNull();
    expect(componente.seleccion()).toBeNull();
  });

  it('crear un responsable nuevo se hace dentro de la ventana', () => {
    const { abrir, fixture, raiz, componente } = montar();
    abrir();
    const nuevo = [...raiz.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent?.includes('Nuevo responsable')) as HTMLButtonElement;
    nuevo.click();
    fixture.detectChanges();
    const nombre = raiz.querySelector('#responsable-nombre') as HTMLInputElement;
    nombre.value = 'DIEGO MARÍN CANO';
    nombre.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    componente.confirmarCreacion();
    expect(componente.seleccion()).toEqual({ tipo: 'nuevo', nombre: 'DIEGO MARÍN CANO', cargo: null });
  });

  it('con alguien elegido el campo es de una línea: el nombre, la X para quitar y pulsar vuelve a abrir la ventana', () => {
    const { fixture, raiz, componente, dialogo } = montar();
    componente.seleccion.set({ tipo: 'existente', responsable: RESPONSABLES[1] });
    fixture.detectChanges();
    const campo = raiz.querySelector('#responsable') as HTMLButtonElement;
    expect(campo.classList).toContain('campo');
    expect(campo.textContent?.trim()).toBe('BERNARDO GIRALDO PÉREZ');
    expect(campo.title).toBe('Cargo: DIRECTOR FINANCIERO');
    campo.click();
    fixture.detectChanges();
    expect(dialogo()).not.toBeNull();
    componente.cerrar();
    fixture.detectChanges();
    (raiz.querySelector('[aria-label="Quitar responsable"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(componente.seleccion()).toBeNull();
    expect((raiz.querySelector('#responsable') as HTMLElement).textContent?.trim()).toBe('Elegir responsable');
  });
});
