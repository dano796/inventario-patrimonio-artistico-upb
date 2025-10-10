import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { InactivityService } from './core/services/inactivity.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('front');
  private inactivityService = inject(InactivityService);
  private router = inject(Router);

  ngOnInit() {
    this.inactivityService.startMonitoring();
    // Restaurar ruta antes de recarga si existe
    const restoreUrl = sessionStorage.getItem('restoreUrl');
    if (restoreUrl) {
      sessionStorage.removeItem('restoreUrl');
      this.router.navigateByUrl(restoreUrl);
    }
  }
}
