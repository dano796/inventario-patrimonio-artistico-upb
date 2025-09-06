import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  imports: [CommonModule],
  templateUrl: './confirm-modal.html',
})
export class ConfirmModalComponent {
  @Input() isOpen = false;
  @Input() title = '¿Está seguro de que desea realizar esta acción?';
  @Input() isLoading = false;
  @Input() errorMessage: string | null = null;
  @Output() confirm = new EventEmitter<boolean>();

  closeModal(confirmed: boolean): void {
    if (this.isLoading) return; // Prevenir cierre durante carga
    this.confirm.emit(confirmed);
  }
}
