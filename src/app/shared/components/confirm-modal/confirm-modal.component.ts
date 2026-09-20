import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroExclamationCircle } from '@ng-icons/heroicons/outline';
import { heroInformationCircleSolid } from '@ng-icons/heroicons/solid';


@Component({
  selector: 'app-confirm-modal',
  imports: [NgIcon],
  templateUrl: './confirm-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ heroExclamationCircle, heroInformationCircleSolid })],
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
