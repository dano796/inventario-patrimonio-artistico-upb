import { inject, Injectable, OnDestroy } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class InactivityService implements OnDestroy {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private visibilityChange$ = fromEvent(document, 'visibilitychange');
  private subscription = new Subscription();

  constructor() {}

  startMonitoring() {
    this.monitorVisibilityChanges();
  }

  /**
   * Umbral por debajo del cual no merece la pena reconstruir nada: cambiar de
   * pestana un momento no invalida la sesion.
   */
  private readonly UMBRAL_OCULTA_MS = 2 * 60 * 1000;

  private ocultaDesde: number | null = null;

  private monitorVisibilityChanges() {
    const sub = this.visibilityChange$.subscribe(async () => {
      if (document.visibilityState === 'hidden') {
        this.ocultaDesde = Date.now();
        return;
      }

      const oculta = this.ocultaDesde ? Date.now() - this.ocultaDesde : 0;
      this.ocultaDesde = null;

      // Antes se reconstruia el cliente en CADA vuelta a la pestana, incluso
      // tras un segundo y sin sesion. Eso creaba un GoTrueClient nuevo cada vez
      // y disparaba un refresco que fallaba con AuthSessionMissingError.
      if (oculta < this.UMBRAL_OCULTA_MS) {
        return;
      }

      // Un visitante anonimo no tiene sesion que reconstruir.
      const { data } = await this.authService.session();
      if (!data.session) {
        return;
      }

      this.supabaseService.reinitializeClient();
      await this.authService.reinitializeAuth();
    });
    this.subscription.add(sub);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
