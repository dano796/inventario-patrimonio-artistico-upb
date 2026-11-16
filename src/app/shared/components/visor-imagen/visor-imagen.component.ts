import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, input, OnDestroy, output } from '@angular/core';

@Component({
  selector: 'app-visor-imagen',
  templateUrl: './visor-imagen.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
})
export class VisorImagenComponent implements OnDestroy {
  url = input.required<string>();
  descripcion = input('');
  cerrar = output<void>();

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly focoPrevio = document.activeElement as HTMLElement | null;

  constructor() {
    afterNextRender(() => this.elemento.nativeElement.querySelector<HTMLElement>('[role="dialog"]')?.focus());
  }

  ngOnDestroy(): void {
    this.focoPrevio?.focus();
  }

  /** El botón de cerrar es lo único enfocable: el foco no sale del visor. */
  retenerFoco(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab') return;
    evento.preventDefault();
    this.elemento.nativeElement.querySelector('button')?.focus();
  }
}
