import { Injectable, InjectionToken, inject } from '@angular/core';
import { GraphService, RangoLeido } from './graph.service';
import { HojaVinculada } from './sincronizacion-datos.service';

export type OrigenHoja = 'onedrive' | 'excel';

/**
 * Lo único que la sincronización necesita de la hoja. Desde la web se llega
 * por Graph, que solo alcanza el OneDrive de quien conecta; desde el
 * complemento de Excel, por Office.js sobre el libro abierto, que no necesita
 * ningún permiso de Graph.
 */
export interface AccesoHoja {
  readonly origen: OrigenHoja;
  conectado(): Promise<boolean>;
  nombre(hoja: HojaVinculada): Promise<string>;
  verificar(hoja: HojaVinculada): Promise<void>;
  descargar(hoja: HojaVinculada): Promise<Uint8Array>;
  leerRangoUsado(hoja: HojaVinculada): Promise<RangoLeido>;
  escribirValores(hoja: HojaVinculada, direccion: string, valores: unknown[][]): Promise<void>;
  /** El libro abierto en Excel no tiene eTag. */
  version(hoja: HojaVinculada): Promise<string | null>;
  minutosRestantes(): Promise<number>;
}

export class ErrorLibroDistinto extends Error {
  constructor(readonly abierto: string, readonly vinculado: string | null) {
    super('El libro abierto no es el Excel vinculado.');
  }
}

export function nombreDeUrl(url: string): string {
  const ultimo = url.split('?')[0].split('/').pop() ?? url;
  try {
    return decodeURIComponent(ultimo);
  } catch {
    return ultimo;
  }
}

@Injectable({ providedIn: 'root' })
export class AccesoHojaGraph implements AccesoHoja {
  private graph = inject(GraphService);
  readonly origen = 'onedrive';

  conectado(): Promise<boolean> {
    return this.graph.tieneAccesoArchivos();
  }

  async nombre(hoja: HojaVinculada): Promise<string> {
    return (await this.graph.archivo(hoja.drive_id, hoja.item_id)).name;
  }

  async verificar(): Promise<void> {}

  descargar(hoja: HojaVinculada): Promise<Uint8Array> {
    return this.graph.descargar(hoja.drive_id, hoja.item_id);
  }

  leerRangoUsado(hoja: HojaVinculada): Promise<RangoLeido> {
    return this.graph.leerRangoUsado(hoja.drive_id, hoja.item_id, hoja.nombre_hoja);
  }

  escribirValores(hoja: HojaVinculada, direccion: string, valores: unknown[][]): Promise<void> {
    return this.graph.escribirValores(hoja.drive_id, hoja.item_id, hoja.nombre_hoja, direccion, valores);
  }

  async version(hoja: HojaVinculada): Promise<string | null> {
    return (await this.graph.archivo(hoja.drive_id, hoja.item_id)).eTag;
  }

  minutosRestantes(): Promise<number> {
    return this.graph.minutosRestantes();
  }
}

export const ACCESO_HOJA = new InjectionToken<AccesoHoja>('AccesoHoja', {
  providedIn: 'root',
  factory: () => inject(AccesoHojaGraph),
});
