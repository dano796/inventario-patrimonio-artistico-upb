import { inject, Injectable, OnDestroy } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class InactivityService implements OnDestroy {
  private supabaseService = inject(SupabaseService);
  private visibilityChange$ = fromEvent(document, 'visibilitychange');
  private lastHiddenTimestamp: number | null = null;
  private subscription = new Subscription();
  private router = inject(Router);
  private authService = inject(AuthService);

  constructor() {}

  startMonitoring() {
    console.log('Inactivity service started (monitoring visibility changes).');
    this.monitorVisibilityChanges();
  }

  private monitorVisibilityChanges() {
    const sub = this.visibilityChange$.subscribe(async () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab visible again, reinitializing client and auth');
        // Reinicializar Supabase cliente
        this.supabaseService.reinitializeClient();
        // Reinitializar estado de AuthService para recargar perfil
        await this.authService.reinitializeAuth();
        console.log('AuthService reinitialized after visibility change');
      }
    });
    this.subscription.add(sub);
  }

  ngOnDestroy() {
    console.log('Inactivity service stopped.');
    this.subscription.unsubscribe();
  }
}
