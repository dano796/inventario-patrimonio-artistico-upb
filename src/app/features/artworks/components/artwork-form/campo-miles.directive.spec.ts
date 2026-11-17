import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CampoMilesDirective } from './campo-miles.directive';

@Component({
  imports: [ReactiveFormsModule, CampoMilesDirective],
  template: `<input appCampoMiles [formControl]="control" />`,
})
class Anfitrion {
  control = new FormControl<number | null>(null);
}

describe('CampoMilesDirective', () => {
  const montar = () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    return { fixture, input, control: fixture.componentInstance.control };
  };
  const escribir = (input: HTMLInputElement, texto: string, cursor = texto.length) => {
    input.value = texto;
    input.setSelectionRange(cursor, cursor);
    input.dispatchEvent(new Event('input'));
  };

  it('muestra el valor del control con separador de miles', () => {
    const { fixture, input, control } = montar();
    control.setValue(1234567);
    fixture.detectChanges();
    expect(input.value).toBe('1.234.567');
  });

  it('al escribir formatea el campo y entrega el número limpio', () => {
    const { input, control } = montar();
    escribir(input, '12000');
    expect(input.value).toBe('12.000');
    expect(control.value).toBe(12000);
  });

  it('descarta letras y signos', () => {
    const { input, control } = montar();
    escribir(input, '3e+-5');
    expect(input.value).toBe('35');
    expect(control.value).toBe(35);
  });

  it('vaciar el campo deja el control en null', () => {
    const { input, control } = montar();
    escribir(input, '');
    expect(control.value).toBeNull();
  });

  it('el cursor queda tras el mismo dígito después de reformatear', () => {
    const { input } = montar();
    escribir(input, '1.2005', 4);
    expect(input.value).toBe('12.005');
    expect(input.selectionStart).toBe(4);
  });
});
