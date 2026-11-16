import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconoSinImagenComponent } from '../../../../../shared/components/icono-sin-imagen/icono-sin-imagen.component';
import { Artwork } from '../../../../../shared/models/artwork.model';

@Component({
  selector: 'app-tarjeta-obra',
  imports: [RouterLink, IconoSinImagenComponent],
  templateUrl: './tarjeta-obra.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarjetaObraComponent {
  obra = input.required<Artwork>();
  modo = input<'galeria' | 'mosaico'>('galeria');
  esAdmin = input(false);

  titulo = computed(() => this.obra().titulo?.trim() || 'Sin título');
  autor = computed(() => this.obra().autor?.trim() || 'No registra');
  ubicacion = computed(() => this.obra().ubicacion?.trim() || 'Sin ubicación registrada');
  imagen = computed(() => this.obra().imagenes?.[0]?.url ?? null);
}
