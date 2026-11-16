import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArchivoOneDrive, ErrorGraph, GraphService } from '../../services/graph.service';
import { HojaVinculada, SincronizacionDatosService } from '../../services/sincronizacion-datos.service';
import { IdWebService } from '../../services/id-web.service';
import { AsignacionIdWeb, Discrepancia, esListaDeAsignaciones } from '../../nucleo/id-web';

const HOJA = 'Inventario Obras';

type Accion = 'conectar' | 'buscar' | 'vincular' | 'escribir';

@Component({
  selector: 'app-vincular-hoja',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './vincular-hoja.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VincularHojaComponent implements OnInit {
  private graph = inject(GraphService);
  private datos = inject(SincronizacionDatosService);
  private idWeb = inject(IdWebService);

  comprobando = signal(true);
  conectado = signal(false);
  hoja = signal<HojaVinculada | null>(null);
  resultados = signal<ArchivoOneDrive[]>([]);
  asignaciones = signal<AsignacionIdWeb[] | null>(null);
  progreso = signal<{ escritas: number; total: number } | null>(null);
  discrepancias = signal<Discrepancia[]>([]);
  mensaje = signal<string | null>(null);
  error = signal<string | null>(null);
  ocupado = signal(false);
  enCurso = signal<Accion | null>(null);
  buscado = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.ejecutar(async () => this.hoja.set(await this.datos.hojaVinculada()));
    // El token del inicio de sesion normal de Microsoft no trae el permiso de
    // archivos: «conectado» solo puede salir de comprobar /me/drive, no de
    // que exista un provider_token.
    try {
      this.conectado.set(await this.graph.tieneAccesoArchivos());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo comprobar la conexión con OneDrive.');
    } finally {
      this.comprobando.set(false);
    }
  }

  async conectar(): Promise<void> {
    await this.ejecutar(() => this.graph.conectar('/sincronizacion/vincular'), 'conectar');
  }

  async buscar(texto: string): Promise<void> {
    const buscado = texto.trim() || 'Inventario';
    this.buscado.set(null);
    await this.ejecutar(async () => {
      this.resultados.set(await this.graph.buscarArchivos(buscado));
      this.buscado.set(buscado);
    }, 'buscar');
  }

  async elegir(archivo: ArchivoOneDrive): Promise<void> {
    await this.ejecutar(async () => {
      const hoja = { drive_id: archivo.parentReference.driveId, item_id: archivo.id, nombre_hoja: HOJA, etag: archivo.eTag, url: null };
      await this.datos.vincular(hoja);
      this.hoja.set({ ...hoja, fecha_ultima: null });
      this.resultados.set([]);
      this.buscado.set(null);
      this.mensaje.set(`Hoja vinculada: ${archivo.name}`);
    }, 'vincular');
  }

  async cargarAsignaciones(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    await this.ejecutar(async () => {
      const contenido: unknown = JSON.parse(await archivo.text());
      if (!esListaDeAsignaciones(contenido)) throw new Error('El archivo no tiene el formato de importacion/id-web.json.');
      this.asignaciones.set(contenido);
    });
  }

  async escribir(): Promise<void> {
    const hoja = this.hoja();
    const asignaciones = this.asignaciones();
    if (!hoja || !asignaciones) return;
    this.discrepancias.set([]);
    await this.ejecutar(async () => {
      const resultado = await this.idWeb.escribir(hoja, asignaciones, (escritas, total) =>
        this.progreso.set({ escritas, total })
      );
      if (!resultado.ok) {
        this.discrepancias.set(resultado.discrepancias);
        return;
      }
      const archivo = await this.graph.archivo(hoja.drive_id, hoja.item_id);
      await this.datos.vincular({ drive_id: hoja.drive_id, item_id: hoja.item_id, nombre_hoja: hoja.nombre_hoja, etag: archivo.eTag, url: hoja.url });
      this.mensaje.set(`ID WEB escrito en ${resultado.escritas} filas (${resultado.yaEscritas} ya lo tenían).`);
    }, 'escribir');
  }

  private async ejecutar(accion: () => Promise<void>, nombre: Accion | null = null): Promise<void> {
    this.ocupado.set(true);
    this.enCurso.set(nombre);
    this.error.set(null);
    this.mensaje.set(null);
    this.progreso.set(null);
    try {
      await accion();
    } catch (e) {
      if (e instanceof ErrorGraph && e.estado === 401) {
        this.conectado.set(false);
        this.error.set('La conexión con OneDrive caducó. Conecta de nuevo y repite: las filas ya escritas se omiten.');
      } else {
        this.error.set(e instanceof Error ? e.message : 'Ha ocurrido un error inesperado.');
      }
    } finally {
      this.ocupado.set(false);
      this.enCurso.set(null);
    }
  }
}
