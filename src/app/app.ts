import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InactivityService } from './core/services/inactivity.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('front');
  private inactivityService = inject(InactivityService);

  ngOnInit() {
    this.inactivityService.startMonitoring();
  }
}
