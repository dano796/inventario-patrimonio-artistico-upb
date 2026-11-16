import { Injectable } from '@angular/core';

/** Microsoft no permite empaquetarlo: el complemento tiene que cargarlo de su CDN. */
export const URL_OFFICE_JS = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js';

interface ResultadoAsincrono<T> {
  status: string;
  value: T;
  error: { code: number; message: string };
}

type Retorno<T> = (resultado: ResultadoAsincrono<T>) => void;

export interface RangoExcel {
  address: string;
  values: unknown[][];
  formulas: unknown[][];
  load(propiedades: string): void;
}

export interface ContextoExcel {
  workbook: {
    worksheets: {
      getItem(nombre: string): {
        getUsedRange(soloValores?: boolean): RangoExcel;
        getRange(direccion: string): RangoExcel;
      };
    };
  };
  sync(): Promise<void>;
}

export interface ArchivoOffice {
  size: number;
  sliceCount: number;
  getSliceAsync(indice: number, retorno: Retorno<{ data: ArrayLike<number> }>): void;
  closeAsync(retorno?: () => void): void;
}

interface DialogoOffice {
  addEventHandler(evento: string, manejador: (arg: { message?: string; origin?: string; error?: number }) => void): void;
  close(): void;
}

export interface ApiOffice {
  Excel: { run<T>(lote: (contexto: ContextoExcel) => Promise<T>): Promise<T> };
  Office: {
    onReady(): Promise<{ host: string | null }>;
    context: {
      document: {
        url: string;
        getFileAsync(tipo: string, opciones: { sliceSize: number }, retorno: Retorno<ArchivoOffice>): void;
      };
      ui: {
        displayDialogAsync(url: string, opciones: { height: number; width: number }, retorno: Retorno<DialogoOffice>): void;
        messageParent(mensaje: string, opciones?: { targetOrigin: string }): void;
      };
    };
    FileType: { Compressed: string };
    AsyncResultStatus: { Succeeded: string };
    EventType: { DialogMessageReceived: string; DialogEventReceived: string };
  };
}

/** Código con el que Office avisa de que la persona cerró el diálogo. */
const DIALOGO_CERRADO = 12006;

@Injectable({ providedIn: 'root' })
export class OfficeService {
  private carga: Promise<{ api: ApiOffice; host: string | null }> | null = null;
  private cargada: ApiOffice | null = null;

  /** `host` es null cuando la página se abre fuera de Office. */
  cargar(): Promise<{ api: ApiOffice; host: string | null }> {
    this.carga ??= this.cargarScript().catch((e) => {
      this.carga = null;
      throw e;
    });
    return this.carga;
  }

  api(): ApiOffice {
    if (!this.cargada) throw new Error('Office.js no está cargado.');
    return this.cargada;
  }

  /** Resuelve con el mensaje que envíe el diálogo; rechaza si se cierra sin enviarlo. */
  abrirDialogo(ruta: string): Promise<string> {
    const { Office } = this.api();
    return new Promise((resolve, reject) => {
      Office.context.ui.displayDialogAsync(`${window.location.origin}${ruta}`, { height: 70, width: 35 }, (r) => {
        if (r.status !== Office.AsyncResultStatus.Succeeded) {
          reject(new Error(`No se pudo abrir la ventana de inicio de sesión: ${r.error.message}`));
          return;
        }
        const dialogo = r.value;
        dialogo.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
          dialogo.close();
          if (arg.origin && arg.origin !== window.location.origin) reject(new Error('El mensaje no viene de la aplicación.'));
          else resolve(arg.message ?? '');
        });
        dialogo.addEventHandler(Office.EventType.DialogEventReceived, (arg) => {
          reject(new Error(arg.error === DIALOGO_CERRADO ? 'Se cerró la ventana de inicio de sesión.' : 'La ventana de inicio de sesión falló.'));
        });
      });
    });
  }

  enviarAlPanel(mensaje: string): void {
    this.api().Office.context.ui.messageParent(mensaje, { targetOrigin: window.location.origin });
  }

  /**
   * office.js deja history.pushState y replaceState a null en algunos
   * navegadores, y el router de Angular los necesita: se guardan y se reponen.
   */
  private async cargarScript(): Promise<{ api: ApiOffice; host: string | null }> {
    const { pushState, replaceState } = window.history;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = URL_OFFICE_JS;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Office.js.'));
      document.head.appendChild(script);
    });
    const global = window as unknown as Partial<ApiOffice>;
    if (!global.Office) throw new Error('No se pudo cargar Office.js.');
    const { host } = await global.Office.onReady();
    window.history.pushState = pushState;
    window.history.replaceState = replaceState;
    this.cargada = { Office: global.Office, Excel: global.Excel! };
    return { api: this.cargada, host };
  }
}
