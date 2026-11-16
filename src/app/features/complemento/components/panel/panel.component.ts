import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { SincronizarComponent } from '../../../sincronizacion/components/sincronizar/sincronizar.component';
import { SincronizacionService } from '../../../sincronizacion/services/sincronizacion.service';
import { ACCESO_HOJA } from '../../../sincronizacion/services/acceso-hoja';
import { AccesoHojaExcel } from '../../services/acceso-hoja-excel';
import { OfficeService } from '../../services/office.service';
import { MensajeEntrada, RUTA_ENTRAR } from '../entrar/entrar.component';

type Fase = 'cargando' | 'fuera-de-excel' | 'entrar' | 'sin-permiso' | 'listo' | 'error';

/**
 * Panel del complemento de Excel. SincronizacionService se provee aquí y no en
 * la raíz para que, dentro del panel, lea y escriba el libro abierto en vez de
 * pasar por Graph.
 */
@Component({
  selector: 'app-panel-complemento',
  imports: [SincronizarComponent],
  templateUrl: './panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SincronizacionService, AccesoHojaExcel, { provide: ACCESO_HOJA, useExisting: AccesoHojaExcel }],
})
export class PanelComponent implements OnInit {
  private office = inject(OfficeService);
  private auth = inject(AuthService);
  private supabaseService = inject(SupabaseService);

  fase = signal<Fase>('cargando');
  entrando = signal(false);
  error = signal<string | null>(null);
  correo = this.auth.correo;

  async ngOnInit(): Promise<void> {
    try {
      const { host } = await this.office.cargar();
      if (host !== 'Excel') {
        this.fase.set('fuera-de-excel');
        return;
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar Office.js.');
      this.fase.set('error');
      return;
    }
    await this.auth.listo();
    this.evaluar();
  }

  /**
   * Microsoft no deja abrir su pantalla de inicio de sesión dentro del panel:
   * se abre en un diálogo de Office, que devuelve la sesión ya iniciada.
   */
  async entrar(): Promise<void> {
    if (this.entrando()) return;
    this.entrando.set(true);
    this.error.set(null);
    try {
      const mensaje = JSON.parse(await this.office.abrirDialogo(RUTA_ENTRAR)) as MensajeEntrada;
      if (mensaje.tipo === 'error') throw new Error(mensaje.mensaje);
      const { error } = await this.supabaseService.supabaseClient.auth.setSession({
        access_token: mensaje.access_token,
        refresh_token: mensaje.refresh_token,
      });
      if (error) throw error;
      await this.auth.refreshUserProfile();
      this.evaluar();
    } catch (e) {
      this.error.set((e as { message?: string } | null)?.message || 'No se pudo iniciar sesión.');
    } finally {
      this.entrando.set(false);
    }
  }

  /** Local: cerrar sesión en el panel no debe cerrarla en los demás navegadores de la persona. */
  async salir(): Promise<void> {
    await this.supabaseService.supabaseClient.auth.signOut({ scope: 'local' });
    this.fase.set('entrar');
  }

  private evaluar(): void {
    if (this.auth.isAdmin()) this.fase.set('listo');
    else this.fase.set(this.auth.isAuthenticated() ? 'sin-permiso' : 'entrar');
  }
}
