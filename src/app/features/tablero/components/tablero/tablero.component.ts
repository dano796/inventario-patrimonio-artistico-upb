import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TableroService } from '../../tablero.service';
import { calcularTablero, ObraTablero, Pendiente, PENDIENTES, ResumenTablero } from '../../tablero';
import { ArtworkExportService } from '../../../artworks/services/artwork-export.service';

interface Cifra {
  etiqueta: string;
  valor: string;
  nota: string;
  tono: string;
}

@Component({
  selector: 'app-tablero',
  imports: [RouterLink],
  templateUrl: './tablero.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableroComponent implements OnInit {
  private tablero = inject(TableroService);
  private exportService = inject(ArtworkExportService);

  readonly pendientes = PENDIENTES;
  cargando = signal(true);
  error = signal(false);
  resumen = signal<ResumenTablero | null>(null);
  leidoEn = signal<Date | null>(null);
  abierta = signal<Pendiente | null>(null);
  exportando = signal(false);
  errorExportar = signal<string | null>(null);

  cifras = computed<Cifra[]>(() => {
    const r = this.resumen();
    if (!r) return [];
    return [
      { etiqueta: 'Obras registradas', valor: this.numero(r.total), nota: `+${this.numero(r.nuevasEsteMes)} este mes`, tono: 'text-verde' },
      { etiqueta: 'Ubicaciones', valor: this.numero(r.ubicaciones), nota: 'Sedes y bloques', tono: 'text-tinta-4' },
      { etiqueta: 'Fichas incompletas', valor: this.numero(r.incompletas), nota: `${r.porcentajeIncompletas} % del inventario`, tono: 'text-ambar-2' },
      { etiqueta: 'Sin imagen', valor: this.numero(r.sinImagen), nota: 'Requieren captura', tono: 'text-ambar-2' },
    ];
  });

  hora = computed(() => {
    const leido = this.leidoEn();
    if (!leido) return '';
    const hora = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(leido);
    return `Datos de hoy, ${hora}`;
  });

  ngOnInit(): void {
    this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      const ahora = new Date();
      const obras = await this.tablero.obras();
      this.resumen.set(calcularTablero(obras, ahora));
      this.leidoEn.set(ahora);
    } catch (error) {
      console.error('Error cargando el tablero:', error);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  alternar(clave: Pendiente): void {
    this.abierta.set(this.abierta() === clave ? null : clave);
  }

  async exportar(): Promise<void> {
    this.exportando.set(true);
    this.errorExportar.set(null);
    try {
      const total = await this.exportService.exportToExcel();
      if (total === 0) this.errorExportar.set('No hay obras para exportar.');
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      this.errorExportar.set('No se pudo generar el archivo de Excel. Intenta de nuevo.');
    } finally {
      this.exportando.set(false);
    }
  }

  titulo(obra: ObraTablero): string {
    return obra.titulo?.trim() || 'Sin título';
  }

  numero(valor: number): string {
    return valor.toLocaleString('es-CO');
  }

  porcentaje(proporcion: number): string {
    return `${Math.round(proporcion * 100)}%`;
  }
}
