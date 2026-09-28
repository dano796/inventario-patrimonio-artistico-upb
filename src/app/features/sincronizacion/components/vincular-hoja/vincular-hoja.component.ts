import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { GraphService } from '../../services/graph.service';

@Component({
  selector: 'app-vincular-hoja',
  standalone: true,
  templateUrl: './vincular-hoja.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VincularHojaComponent implements OnInit {
  private graph = inject(GraphService);

  comprobando = signal(true);
  conectado = signal(false);
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.conectado.set(await this.graph.tieneAccesoArchivos());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo comprobar la conexión con OneDrive.');
    } finally {
      this.comprobando.set(false);
    }
  }

  async conectar(): Promise<void> {
    try {
      await this.graph.conectar('/sincronizacion/vincular');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo iniciar la conexión con OneDrive.');
    }
  }
}
