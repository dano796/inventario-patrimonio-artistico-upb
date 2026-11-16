import { ChangeDetectionStrategy, Component, effect, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'abierto() && cerrar(false)' },
})
export class ConfirmModalComponent {
  abierto = input(false);
  titulo = input('¿Confirmas esta acción?');
  mensaje = input<string | null>(null);
  textoConfirmar = input('Confirmar');
  textoCargando = input('Procesando…');
  cargando = input(false);
  error = input<string | null>(null);
  confirmar = output<boolean>();

  private dialogo = viewChild<ElementRef<HTMLElement>>('dialogo');
  private focoPrevio: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const dialogo = this.dialogo()?.nativeElement;
      if (dialogo) {
        this.focoPrevio = document.activeElement as HTMLElement | null;
        dialogo.querySelector('button')?.focus();
      } else if (this.focoPrevio) {
        this.focoPrevio.focus();
        this.focoPrevio = null;
      }
    });
    effect(() => {
      if (this.cargando()) this.dialogo()?.nativeElement.focus();
    });
  }

  cerrar(confirmado: boolean): void {
    if (this.cargando()) return;
    this.confirmar.emit(confirmado);
  }

  atraparFoco(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab') return;
    const dialogo = this.dialogo()!.nativeElement;
    const botones = [...dialogo.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    const primero = botones[0];
    const ultimo = botones[botones.length - 1];
    if (!primero) {
      evento.preventDefault();
      dialogo.focus();
    } else if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
}
