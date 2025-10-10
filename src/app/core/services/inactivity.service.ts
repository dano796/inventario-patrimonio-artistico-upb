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

  private monitorVisibilityChanges() {
    const sub = this.visibilityChange$.subscribe(async () => {
      if (document.visibilityState === 'visible') {
        this.supabaseService.reinitializeClient();
        await this.authService.reinitializeAuth();
      }
    });
    this.subscription.add(sub);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
