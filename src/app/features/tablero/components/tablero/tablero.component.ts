import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableroService } from '../../tablero.service';
import { calcularTablero, PENDIENTES, ResumenTablero } from '../../tablero';
import { ArtworkExportService } from '../../../artworks/services/artwork-export.service';

interface Cifra {
  etiqueta: string;
  valor: string;
  unidad?: string;
  /** Cifra completa cuando la visible va abreviada. */
  exacta?: string;
  nota: string;
  tono: string;
}

@Component({
  selector: 'app-tablero',
  imports: [RouterLink, NgTemplateOutlet],
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
  exportando = signal(false);
  errorExportar = signal<string | null>(null);

  cifras = computed<Cifra[]>(() => {
    const r = this.resumen();
    if (!r) return [];
    return [
      { etiqueta: 'Obras registradas', valor: this.numero(r.total), nota: `+${this.numero(r.nuevasEsteMes)} este mes`, tono: 'text-verde' },
      {
        etiqueta: 'Valor estimado',
        ...this.pesos(r.valorTotal),
        nota: r.sinValor ? `${this.numero(r.sinValor)} obras sin avalúo` : 'Todas tienen avalúo',
        tono: r.sinValor ? 'text-ambar-2' : 'text-verde',
      },
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

  porcentaje(proporcion: number): string {
    return `${Math.round(proporcion * 100)}%`;
  }

  /** Un valor en pesos completo no cabe en la tarjeta: desde un millón se muestra en millones. */
  private pesos(total: number): Pick<Cifra, 'valor' | 'unidad' | 'exacta'> {
    const exacta = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total);
    if (total < 1_000_000) return { valor: exacta };
    const millones = (total / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: total < 100_000_000 ? 1 : 0 });
    return { valor: '$' + millones, unidad: 'millones', exacta };
  }

  completo(faltan: number): number {
    const total = this.resumen()?.total ?? 0;
    return total ? Math.round(((total - faltan) * 100) / total) : 100;
  }

  numero(valor: number): string {
    return valor.toLocaleString('es-CO');
  }
}
