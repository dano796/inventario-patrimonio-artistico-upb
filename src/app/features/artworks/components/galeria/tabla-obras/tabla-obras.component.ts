import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Artwork } from '../../../../../shared/models/artwork.model';

@Component({
  selector: 'app-tabla-obras',
  imports: [RouterLink],
  templateUrl: './tabla-obras.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaObrasComponent {
  obras = input.required<readonly Artwork[]>();
  esAdmin = input(false);

  titulo(obra: Artwork): string {
    return obra.titulo?.trim() || 'Sin título';
  }

  texto(valor: string | number | null): string {
    return valor === null || String(valor).trim() === '' ? 'No registra' : String(valor);
  }
}
