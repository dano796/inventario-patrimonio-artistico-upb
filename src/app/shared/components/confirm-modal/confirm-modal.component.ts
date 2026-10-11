import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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
  cargando = input(false);
  error = input<string | null>(null);
  confirmar = output<boolean>();

  cerrar(confirmado: boolean): void {
    if (this.cargando()) return;
    this.confirmar.emit(confirmado);
  }
}
