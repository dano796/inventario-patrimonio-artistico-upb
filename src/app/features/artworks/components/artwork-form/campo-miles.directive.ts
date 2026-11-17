import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const miles = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Campo de enteros que se ve con separador de miles («12.000») y entrega al formulario el número limpio. */
@Directive({
  selector: 'input[appCampoMiles]',
  host: {
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    '(input)': 'alEscribir()',
    '(blur)': 'tocado()',
  },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoMilesDirective), multi: true }],
})
export class CampoMilesDirective implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private alCambiar: (valor: number | null) => void = () => {};
  protected tocado: () => void = () => {};

  writeValue(valor: number | null): void {
    this.input.value = valor === null || valor === undefined ? '' : miles.format(valor);
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.tocado = fn;
  }

  setDisabledState(desactivado: boolean): void {
    this.input.disabled = desactivado;
  }

  alEscribir(): void {
    const { value, selectionStart } = this.input;
    const digitosAntes = value.slice(0, selectionStart ?? value.length).replace(/\D/g, '').length;
    const digitos = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
    const texto = digitos ? miles.format(Number(digitos)) : '';
    this.input.value = texto;

    let cursor = 0;
    for (let vistos = 0; cursor < texto.length && vistos < digitosAntes; cursor++) {
      if (/\d/.test(texto[cursor])) vistos++;
    }
    this.input.setSelectionRange(cursor, cursor);
    this.alCambiar(digitos ? Number(digitos) : null);
  }
}
