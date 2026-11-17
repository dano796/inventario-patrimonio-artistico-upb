import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let siguiente = 0;

@Component({
  selector: 'app-icono-sin-imagen',
  templateUrl: './icono-sin-imagen.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block leading-none' },
})
export class IconoSinImagenComponent {
  tamano = input(32);
  // Cada máscara SVG necesita un id único en el documento, y hay una tarjeta por obra.
  protected readonly mascara = `sin-imagen-${++siguiente}`;
}
