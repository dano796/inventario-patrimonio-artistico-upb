import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-casilla',
  templateUrl: './casilla.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-grid h-[18px] w-[18px] flex-none place-items-center' },
})
export class CasillaComponent {
  marcada = input(false);
  id = input<string | null>(null);
  etiqueta = input<string | null>(null);
  deshabilitada = input(false);
  cambio = output<boolean>();
}
