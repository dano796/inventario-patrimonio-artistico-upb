import { TestBed } from '@angular/core/testing';
import { CasillaComponent } from './casilla.component';

function montar(marcada: boolean) {
  TestBed.configureTestingModule({ imports: [CasillaComponent] });
  const fixture = TestBed.createComponent(CasillaComponent);
  fixture.componentRef.setInput('marcada', marcada);
  fixture.componentRef.setInput('etiqueta', 'Incluir');
  const cambios: boolean[] = [];
  fixture.componentInstance.cambio.subscribe((v) => cambios.push(v));
  fixture.detectChanges();
  return { input: fixture.nativeElement.querySelector('input') as HTMLInputElement, cambios };
}

describe('CasillaComponent', () => {
  it('es una casilla nativa accesible que refleja su estado', () => {
    const { input } = montar(true);

    expect(input.type).toBe('checkbox');
    expect(input.checked).toBeTrue();
    expect(input.getAttribute('aria-label')).toBe('Incluir');
  });

  it('al pulsarla emite el nuevo estado', () => {
    const { input, cambios } = montar(false);

    input.click();

    expect(cambios).toEqual([true]);
  });
});
