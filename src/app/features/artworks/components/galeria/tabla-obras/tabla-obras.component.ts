import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Artwork } from '../../../../../shared/models/artwork.model';
import { IconoSinImagenComponent } from '../../../../../shared/components/icono-sin-imagen/icono-sin-imagen.component';
import { VisorImagenComponent } from '../../../../../shared/components/visor-imagen/visor-imagen.component';
import { NO_REGISTRA } from '../../../utils/ficha';

interface Columna {
  etiqueta: string;
  valor: (obra: Artwork) => string | number | null | undefined;
  restringida: boolean;
  /** Valores cortos que no deben partirse en dos líneas. */
  corta?: boolean;
}

/** En el orden de la hoja oficial. Ubicación, bloque y responsable son columnas restringidas. */
const COLUMNAS: Columna[] = [
  { etiqueta: 'Técnica', valor: (o) => o.tecnica, restringida: false },
  { etiqueta: 'Dimensión', valor: (o) => o.dimension, restringida: false, corta: true },
  { etiqueta: 'Año', valor: (o) => o.ano, restringida: false, corta: true },
  { etiqueta: 'Ubicación', valor: (o) => o.ubicacion, restringida: true },
  { etiqueta: 'Bloque', valor: (o) => o.bloque_asignado, restringida: true },
  { etiqueta: 'Responsable', valor: (o) => o.responsable, restringida: true },
];

@Component({
  selector: 'app-tabla-obras',
  imports: [RouterLink, IconoSinImagenComponent, VisorImagenComponent],
  templateUrl: './tabla-obras.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaObrasComponent {
  obras = input.required<readonly Artwork[]>();
  esAdmin = input(false);

  private readonly router = inject(Router);
  ampliada = signal<{ url: string; descripcion: string } | null>(null);

  columnas = computed(() => COLUMNAS.filter((c) => this.esAdmin() || !c.restringida));

  titulo(obra: Artwork): string {
    return obra.titulo?.trim() || 'Sin título';
  }

  texto(valor: string | number | null | undefined): string | null {
    return valor == null || String(valor).trim() === '' ? null : String(valor);
  }

  imagen(obra: Artwork): string | null {
    return obra.imagenes?.[0]?.url ?? null;
  }

  /** El clic en el enlace o la miniatura ya hace lo suyo, y el que termina una selección de texto no navega. */
  abrirFicha(obra: Artwork, evento: MouseEvent): void {
    if ((evento.target as HTMLElement).closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    this.router.navigate(['/obra', obra.id]);
  }

  ampliar(obra: Artwork, url: string): void {
    this.ampliada.set({ url, descripcion: this.titulo(obra) });
  }

  protected readonly noRegistra = NO_REGISTRA;
}
