import { Injectable, inject } from '@angular/core';
import { AccesoHoja, ErrorLibroDistinto, nombreDeUrl } from '../../sincronizacion/services/acceso-hoja';
import { RangoLeido } from '../../sincronizacion/services/graph.service';
import { HojaVinculada } from '../../sincronizacion/services/sincronizacion-datos.service';
import { OfficeService } from './office.service';

/** El máximo que admite getSliceAsync. */
const TROZO = 4 * 1024 * 1024;

/** Lee y escribe el libro abierto con los permisos de edición de quien lo tiene abierto. */
@Injectable()
export class AccesoHojaExcel implements AccesoHoja {
  private office = inject(OfficeService);
  readonly origen = 'excel';

  urlAbierta(): string {
    return this.office.api().Office.context.document.url;
  }

  async conectado(): Promise<boolean> {
    return true;
  }

  async nombre(): Promise<string> {
    return nombreDeUrl(this.urlAbierta());
  }

  async verificar(hoja: HojaVinculada): Promise<void> {
    const abierta = this.urlAbierta();
    if (!hoja.url || abierta !== hoja.url) throw new ErrorLibroDistinto(abierta, hoja.url);
  }

  descargar(): Promise<Uint8Array> {
    const { Office } = this.office.api();
    const ok = Office.AsyncResultStatus.Succeeded;
    return new Promise((resolve, reject) => {
      Office.context.document.getFileAsync(Office.FileType.Compressed, { sliceSize: TROZO }, (r) => {
        if (r.status !== ok) {
          reject(new Error(`Excel no entregó el libro: ${r.error.message}`));
          return;
        }
        const archivo = r.value;
        const datos = new Uint8Array(archivo.size);
        let leidos = 0;
        const leer = (indice: number) =>
          archivo.getSliceAsync(indice, (trozo) => {
            if (trozo.status !== ok) {
              archivo.closeAsync();
              reject(new Error(`Excel no entregó el libro completo: ${trozo.error.message}`));
              return;
            }
            datos.set(trozo.value.data, leidos);
            leidos += trozo.value.data.length;
            if (indice + 1 < archivo.sliceCount) {
              leer(indice + 1);
              return;
            }
            archivo.closeAsync();
            resolve(leidos === datos.length ? datos : datos.subarray(0, leidos));
          });
        leer(0);
      });
    });
  }

  leerRangoUsado(hoja: HojaVinculada): Promise<RangoLeido> {
    return this.office.api().Excel.run(async (contexto) => {
      const rango = contexto.workbook.worksheets.getItem(hoja.nombre_hoja).getUsedRange();
      rango.load('address,values,formulas');
      await contexto.sync();
      return { address: rango.address, values: rango.values, formulas: rango.formulas };
    });
  }

  /** Como en Graph, un null deja la celda como está y un texto que empieza por «=» se escribe como fórmula. */
  escribirValores(hoja: HojaVinculada, direccion: string, valores: unknown[][]): Promise<void> {
    return this.office.api().Excel.run(async (contexto) => {
      contexto.workbook.worksheets.getItem(hoja.nombre_hoja).getRange(direccion).values = valores;
      await contexto.sync();
    });
  }

  async version(): Promise<string | null> {
    return null;
  }

  async minutosRestantes(): Promise<number> {
    return Number.POSITIVE_INFINITY;
  }
}
