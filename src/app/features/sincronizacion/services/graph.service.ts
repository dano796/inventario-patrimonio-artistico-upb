import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

export class ErrorGraph extends Error {
  constructor(readonly estado: number, mensaje: string) {
    super(mensaje);
  }
}

export interface ArchivoOneDrive {
  id: string;
  name: string;
  eTag: string;
  parentReference: { driveId: string; path?: string };
}

const GRAPH = 'https://graph.microsoft.com/v1.0';

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

  /** Supabase no renueva `provider_token`: desaparece al refrescar la sesión y hay que reconectar. */
  async token(): Promise<string | null> {
    const { data } = await this.supabaseService.supabaseClient.auth.getSession();
    return data.session?.provider_token ?? null;
  }

  /**
   * El token de la sesión normal (scopes `openid profile email`) también
   * responde 2xx aquí si por casualidad alcanza, pero /me/drive exige el
   * permiso de archivos: es la forma barata de distinguir un token sin ese
   * permiso de uno que sí lo tiene.
   */
  async tieneAccesoArchivos(): Promise<boolean> {
    const token = await this.token();
    if (!token) return false;
    const respuesta = await fetch(`${GRAPH}/me/drive?$select=id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (respuesta.ok) return true;
    if (respuesta.status === 401 || respuesta.status === 403) return false;
    throw new ErrorGraph(respuesta.status, await respuesta.text());
  }

  async buscarArchivos(texto: string): Promise<ArchivoOneDrive[]> {
    const q = encodeURIComponent(texto.replace(/'/g, "''"));
    const r = await this.pedir<{ value: ArchivoOneDrive[] }>(
      `/me/drive/root/search(q='${q}')?$select=id,name,eTag,parentReference`
    );
    return r.value.filter((a) => a.name.toLowerCase().endsWith('.xlsx'));
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

  private rango(driveId: string, itemId: string, hoja: string, direccion: string): string {
    return `/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodeURIComponent(hoja)}/range(address='${direccion}')`;
  }

  private async pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    const token = await this.token();
    if (!token) throw new ErrorGraph(401, 'No hay conexión con OneDrive.');
    const respuesta = await fetch(`${GRAPH}${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!respuesta.ok) throw new ErrorGraph(respuesta.status, await respuesta.text());
    return (respuesta.status === 204 ? undefined : await respuesta.json()) as T;
  }
}
