import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

export class ErrorGraph extends Error {
  constructor(readonly estado: number, mensaje: string) {
    super(mensaje);
  }
}

/** Graph responde con JSON en inglés; quien sincroniza solo debe ver un motivo y qué hacer. */
export async function errorDeRespuesta(respuesta: Response): Promise<ErrorGraph> {
  let codigo = '';
  try {
    codigo = (JSON.parse(await respuesta.text()) as { error?: { code?: string } }).error?.code ?? '';
  } catch {
    codigo = '';
  }
  const estado = respuesta.status;
  if (estado === 403) {
    return new ErrorGraph(estado,
      'Tu cuenta no tiene acceso a la hoja oficial desde la web, porque está en el OneDrive de otra persona. ' +
      'Sincroniza desde el complemento de Excel, con la hoja oficial abierta.');
  }
  if (estado === 429 || estado === 503) {
    return new ErrorGraph(estado, 'Microsoft está recibiendo demasiadas peticiones. Espera un momento y vuelve a intentarlo.');
  }
  return new ErrorGraph(estado, `OneDrive respondió con un error (${codigo ? `${codigo}, ` : ''}código ${estado}).`);
}

export interface ArchivoOneDrive {
  id: string;
  name: string;
  eTag: string;
  parentReference: { driveId: string; path?: string };
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
/** Sin esto, un Graph que no responde deja la pantalla en «Comprobando conexión…» para siempre. */
const TOPE_MS = 15000;

/** La hoja pesa unos 112 MB por las imágenes: 15 s no alcanzan para descargarla. */
const TOPE_DESCARGA_MS = 5 * 60 * 1000;

const VIDA_TOKEN_MS = 60 * 60 * 1000;
const MAX_PAGINAS_BUSQUEDA = 10;

export interface RangoLeido {
  address: string;
  values: unknown[][];
  formulas: unknown[][];
}

@Injectable({ providedIn: 'root' })
export class GraphService {
  private supabaseService = inject(SupabaseService);

  /**
   * El alcance de archivos se pide solo aquí, nunca en el inicio de sesión
   * normal: a cualquier persona que entrara le saldría la pantalla de
   * «acceso completo a tus archivos».
   */
  async conectar(rutaDeVuelta: string): Promise<void> {
    const { error } = await this.supabaseService.supabaseClient.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'openid profile email Files.ReadWrite',
        redirectTo: `${window.location.origin}${rutaDeVuelta}`,
      },
    });
    if (error) throw error;
  }

  /**
   * supabase-js entrega `provider_token` una sola vez: cualquier refresco de la
   * sesión (inactividad, vuelta a la pestaña, caducidad del JWT) lo quita. Se
   * guarda aquí, en memoria, para que dure lo que dura el token de Microsoft.
   */
  private guardado: { token: string; emitido: number } | null = null;

  async token(): Promise<string | null> {
    const { data } = await this.supabaseService.supabaseClient.auth.getSession();
    const sesion = data.session;
    if (!sesion) {
      this.guardado = null;
      return null;
    }
    if (sesion.provider_token && sesion.provider_token !== this.guardado?.token) {
      const emitido =
        sesion.expires_at && sesion.expires_in ? (sesion.expires_at - sesion.expires_in) * 1000 : Date.now();
      this.guardado = { token: sesion.provider_token, emitido };
    }
    return this.guardado?.token ?? null;
  }

  /** Microsoft garantiza al menos una hora de vida al token. */
  async minutosRestantes(): Promise<number> {
    if (!(await this.token()) || !this.guardado) return 0;
    return (this.guardado.emitido + VIDA_TOKEN_MS - Date.now()) / 60000;
  }

  async tieneAccesoArchivos(): Promise<boolean> {
    const token = await this.token();
    if (!token) return false;
    const respuesta = await this.fetchConTope(`${GRAPH}/me/drive?$select=id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (respuesta.ok) return true;
    if (respuesta.status === 401 || respuesta.status === 403) return false;
    throw await errorDeRespuesta(respuesta);
  }

  /** La búsqueda de OneDrive devuelve por páginas y mezcla todo tipo de archivos. */
  async buscarArchivos(texto: string): Promise<ArchivoOneDrive[]> {
    const q = encodeURIComponent(texto.replace(/'/g, "''"));
    type Pagina = { value: ArchivoOneDrive[]; '@odata.nextLink'?: string };
    let pagina = await this.pedir<Pagina>(`/me/drive/root/search(q='${q}')?$select=id,name,eTag,parentReference&$top=200`);
    const encontrados = [...pagina.value];
    for (let vueltas = 0; pagina['@odata.nextLink'] && vueltas < MAX_PAGINAS_BUSQUEDA; vueltas++) {
      pagina = await this.pedirUrl<Pagina>(pagina['@odata.nextLink']);
      encontrados.push(...pagina.value);
    }
    return encontrados.filter((a) => a.name.toLowerCase().endsWith('.xlsx'));
  }

  archivo(driveId: string, itemId: string): Promise<ArchivoOneDrive> {
    return this.pedir(`/drives/${driveId}/items/${itemId}?$select=id,name,eTag,parentReference`);
  }

  async leerValores(driveId: string, itemId: string, hoja: string, direccion: string): Promise<unknown[][]> {
    const r = await this.pedir<{ values: unknown[][] }>(`${this.rango(driveId, itemId, hoja, direccion)}?$select=values`);
    return r.values;
  }

  async escribirValores(driveId: string, itemId: string, hoja: string, direccion: string, valores: unknown[][]): Promise<void> {
    await this.pedir(this.rango(driveId, itemId, hoja, direccion), {
      method: 'PATCH',
      body: JSON.stringify({ values: valores }),
    });
  }

  /** La URL de descarga viene firmada y es de otro dominio: el token no debe viajar a ella. */
  async descargar(driveId: string, itemId: string): Promise<Uint8Array> {
    const item = await this.pedir<{ '@microsoft.graph.downloadUrl'?: string }>(`/drives/${driveId}/items/${itemId}`);
    const url = item['@microsoft.graph.downloadUrl'];
    if (!url) throw new ErrorGraph(404, 'OneDrive no dio una URL de descarga para la hoja.');
    const respuesta = await this.fetchConTope(url, {}, TOPE_DESCARGA_MS);
    if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
    return new Uint8Array(await respuesta.arrayBuffer());
  }

  leerRangoUsado(driveId: string, itemId: string, hoja: string): Promise<RangoLeido> {
    return this.pedir<RangoLeido>(
      `/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodeURIComponent(hoja)}/usedRange?$select=address,values,formulas`
    );
  }

  private rango(driveId: string, itemId: string, hoja: string, direccion: string): string {
    return `/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodeURIComponent(hoja)}/range(address='${direccion}')`;
  }

  private pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    return this.pedirUrl<T>(`${GRAPH}${ruta}`, init);
  }

  private async pedirUrl<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await this.token();
    if (!token) throw new ErrorGraph(401, 'No hay conexión con OneDrive.');
    const respuesta = await this.fetchConTope(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
    return (respuesta.status === 204 ? undefined : await respuesta.json()) as T;
  }

  /**
   * Tope compartido por toda petición a Graph. Se implementa con setTimeout +
   * Promise.race (no con AbortSignal.timeout) para que el spec pueda simular
   * el vencimiento con un reloj falso. Si quien llama pasa su propio `signal`,
   * se respeta: también puede abortar la petición real, y su rechazo llega
   * tal cual, sin convertirse en el ErrorGraph 408 del tope.
   */
  private async fetchConTope(url: string, init: RequestInit = {}, topeMs = TOPE_MS): Promise<Response> {
    const controlador = new AbortController();
    const señalExterna = init.signal;
    if (señalExterna) {
      if (señalExterna.aborted) controlador.abort(señalExterna.reason);
      else señalExterna.addEventListener('abort', () => controlador.abort(señalExterna.reason), { once: true });
    }

    let id: ReturnType<typeof setTimeout>;
    const tope = new Promise<never>((_, reject) => {
      id = setTimeout(() => {
        controlador.abort();
        reject(new ErrorGraph(408, 'Microsoft no respondió a tiempo. Vuelve a intentarlo.'));
      }, topeMs);
    });

    try {
      return await Promise.race([fetch(url, { ...init, signal: controlador.signal }), tope]);
    } finally {
      clearTimeout(id!);
    }
  }
}
