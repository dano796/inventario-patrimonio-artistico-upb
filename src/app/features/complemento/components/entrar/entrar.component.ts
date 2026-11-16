import { ChangeDetectionStrategy, Component, InjectionToken, OnInit, inject, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../../environments/environment';
import { OfficeService } from '../../services/office.service';

export const RUTA_ENTRAR = '/complemento/entrar';

export type MensajeEntrada =
  | { tipo: 'sesion'; access_token: string; refresh_token: string }
  | { tipo: 'error'; mensaje: string };

const CLAVE_ALMACEN = 'sb-complemento-entrar';

/**
 * Cliente propio del diálogo, distinto del de la aplicación: PKCE y
 * sessionStorage con otra clave. Así el cliente de la aplicación, que también
 * arranca en esta página, no reconoce la vuelta de Microsoft ni guarda la
 * sesión en el localStorage que comparte con las pestañas abiertas de la web.
 * Si la guardara, dos clientes acabarían refrescando el mismo refresh token.
 */
export const CLIENTE_ENTRADA = new InjectionToken<() => SupabaseClient>('ClienteEntrada', {
  providedIn: 'root',
  factory: () => () =>
    createClient(environment.SUPABASE_URL, environment.SUPABASE_KEY, {
      auth: {
        flowType: 'pkce',
        storage: window.sessionStorage,
        storageKey: CLAVE_ALMACEN,
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }),
});

/** Página del diálogo de Office: inicia sesión con Microsoft y pasa la sesión al panel. */
@Component({
  selector: 'app-entrar-complemento',
  templateUrl: './entrar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrarComponent implements OnInit {
  private office = inject(OfficeService);
  private crearCliente = inject(CLIENTE_ENTRADA);

  error = signal<string | null>(null);

  /** Se leen antes de cualquier await: supabase-js limpia la URL al canjear el código. */
  private consulta = new URLSearchParams(window.location.search);
  private fragmento = new URLSearchParams(window.location.hash.slice(1));

  async ngOnInit(): Promise<void> {
    try {
      await this.office.cargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar Office.js.');
      return;
    }
    const { consulta, fragmento } = this;
    const fallo = consulta.get('error_description') ?? fragmento.get('error_description') ?? consulta.get('error') ?? fragmento.get('error');
    if (fallo) {
      this.enviar({ tipo: 'error', mensaje: `Microsoft no completó el inicio de sesión: ${fallo}` });
      return;
    }

    const cliente = this.crearCliente();
    if (!consulta.has('code')) {
      const { error } = await cliente.auth.signInWithOAuth({
        provider: 'azure',
        options: { scopes: 'openid profile email', redirectTo: `${window.location.origin}${RUTA_ENTRAR}` },
      });
      if (error) this.enviar({ tipo: 'error', mensaje: error.message });
      return;
    }

    const { data, error } = await cliente.auth.getSession();
    this.borrarAlmacen();
    if (error || !data.session) {
      this.enviar({ tipo: 'error', mensaje: error?.message ?? 'Microsoft devolvió el control sin una sesión.' });
      return;
    }
    this.enviar({ tipo: 'sesion', access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  }

  private enviar(mensaje: MensajeEntrada): void {
    if (mensaje.tipo === 'error') this.error.set(mensaje.mensaje);
    try {
      this.office.enviarAlPanel(JSON.stringify(mensaje));
    } catch {
      this.error.set('Esta página solo funciona dentro del complemento de Excel.');
    }
  }

  private borrarAlmacen(): void {
    for (const clave of Object.keys(window.sessionStorage)) {
      if (clave.startsWith(CLAVE_ALMACEN)) window.sessionStorage.removeItem(clave);
    }
  }
}
