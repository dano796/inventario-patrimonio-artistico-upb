import { Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { InactivityService } from './core/services/inactivity.service';
import { CabeceraComponent } from './shared/components/cabecera/cabecera.component';

const esAutenticacion = (url: string) => url.startsWith('/autenticacion');

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CabeceraComponent],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private inactivityService = inject(InactivityService);
  private router = inject(Router);

  mostrarCabecera = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => !esAutenticacion(e.urlAfterRedirects))
    ),
    { initialValue: !esAutenticacion(this.router.url) }
  );

  ngOnInit() {
    this.inactivityService.startMonitoring();
  }
}
