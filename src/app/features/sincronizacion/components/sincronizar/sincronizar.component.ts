import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AvisoProgreso, Calculo, PasoCalculo, ResultadoAplicacion, SincronizacionService,
} from '../../services/sincronizacion.service';
import { ErrorGraph, GraphService } from '../../services/graph.service';
import { ACCESO_HOJA, ErrorLibroDistinto, nombreDeUrl } from '../../services/acceso-hoja';
import { HojaVinculada, SincronizacionDatosService } from '../../services/sincronizacion-datos.service';
import { ENCABEZADO_ID_WEB, ENCABEZADOS, ENCABEZADOS_IMAGEN, ErrorEncabezados } from '../../nucleo/hoja-obras';
import { hayCambios } from '../../nucleo/diff';
import { decisionesPorDefecto } from '../../nucleo/plan-ejecucion';
import { aDecisiones, construirRevision, elegir, estadoInicial, EstadoRevision, Filtro } from '../../utils/revision';
import { borrarBorrador, guardarBorrador, restaurarBorrador } from '../../utils/borrador';
import { Eleccion, GrupoRevisionComponent } from '../revision/grupo-revision/grupo-revision.component';
import { ResumenEjecucionComponent } from '../revision/resumen-ejecucion/resumen-ejecucion.component';

type Fase = 'cargando' | 'sin-hoja' | 'hoja-perdida' | 'otro-libro' | 'conectar' | 'calculando' | 'error' | 'vacio' | 'revision' | 'resultado';

const RUTA = '/sincronizacion';

const PASOS: { paso: PasoCalculo; etiqueta: string }[] = [
  { paso: 'descargar', etiqueta: 'Descargar la hoja' },
  { paso: 'encabezados', etiqueta: 'Localizar encabezados' },
  { paso: 'inventario', etiqueta: 'Leer el inventario' },
  { paso: 'foto', etiqueta: 'Leer la última sincronización' },
  { paso: 'comparar', etiqueta: 'Comparar campo por campo' },
];

const ESPERADOS = [...Object.values(ENCABEZADOS), ...ENCABEZADOS_IMAGEN, ENCABEZADO_ID_WEB];

const fecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

@Component({
  selector: 'app-sincronizar',
  imports: [NgTemplateOutlet, RouterLink, GrupoRevisionComponent, ResumenEjecucionComponent],
  templateUrl: './sincronizar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SincronizarComponent implements OnInit {
  private servicio = inject(SincronizacionService);
  private graph = inject(GraphService);
  private acceso = inject(ACCESO_HOJA);
  private datos = inject(SincronizacionDatosService);

  readonly enExcel = this.acceso.origen === 'excel';

  fase = signal<Fase>('cargando');
  hoja = signal<HojaVinculada | null>(null);
  archivo = signal<string | null>(null);
  conectado = signal(false);
  progreso = signal<Partial<Record<PasoCalculo, string>>>({});
  encabezados = signal<ErrorEncabezados | null>(null);
  error = signal<string | null>(null);
  conectando = signal(false);
  calculo = signal<Calculo | null>(null);
  estado = signal<EstadoRevision>(estadoInicial());
  filtro = signal<Filtro>('todo');
  aplicando = signal(false);
  caducado = signal(false);
  errorAplicar = signal<string | null>(null);
  recuperadas = signal<{ recuperadas: number; total: number } | null>(null);
  resultado = signal<ResultadoAplicacion | null>(null);
  libro = signal<ErrorLibroDistinto | null>(null);
  vinculando = signal(false);

  revision = computed(() => {
    const calculo = this.calculo();
    return calculo ? construirRevision(calculo, this.estado()) : null;
  });
  gruposVisibles = computed(() => this.revision()?.grupos.filter((g) => g.filtros.includes(this.filtro())) ?? []);

  subtitulo = computed(() => {
    const hoja = this.hoja();
    if (!hoja) return '';
    const ultima = hoja.fecha_ultima ? fecha.format(new Date(hoja.fecha_ultima)) : 'nunca';
    return `${this.archivo() ?? 'Hoja oficial'}, hoja ${hoja.nombre_hoja}. Última sincronización: ${ultima}.`;
  });

  conexion = computed(() => {
    if (this.enExcel) return { texto: 'Libro abierto en Excel', punto: 'bg-verde' };
    if (this.caducado()) return { texto: 'Conexión caducada', punto: 'bg-rojo' };
    return this.conectado() ? { texto: 'OneDrive conectado', punto: 'bg-verde' } : { texto: 'OneDrive sin conectar', punto: 'bg-linea-3' };
  });

  libroAbierto = computed(() => {
    const libro = this.libro();
    return libro ? { abierto: nombreDeUrl(libro.abierto), vinculado: libro.vinculado ? nombreDeUrl(libro.vinculado) : null } : null;
  });

  textoRecuperadas = computed(() => {
    const r = this.recuperadas();
    if (!r) return null;
    const base = `Decisiones recuperadas: ${r.recuperadas} de ${r.total}.`;
    return r.recuperadas < r.total ? `${base} Las demás cambiaron desde que se tomaron y hay que revisarlas de nuevo.` : base;
  });

  cifrasResultado = computed(() => {
    const r = this.resultado();
    if (!r) return [];
    return [
      { etiqueta: 'Campos escritos en la base', cifra: r.base.aplicados },
      { etiqueta: 'Celdas escritas en la hoja', cifra: r.escritasEnHoja },
      { etiqueta: 'Filas añadidas a la hoja', cifra: r.altasEnHoja },
      { etiqueta: 'Descartados por concurrencia', cifra: this.descartados().length },
      ...(r.imagenesSubidas || r.imagenesFallidas.length ? [{ etiqueta: 'Imágenes subidas', cifra: r.imagenesSubidas }] : []),
    ];
  });

  imagenesFallidas = computed(() =>
    (this.resultado()?.imagenesFallidas ?? []).map((f) => ({
      clave: `${f.obraId}|${f.casilla}`, numero: `N.º ${f.obraId}`, campo: `imagen_${f.casilla}`, motivo: f.motivo,
    }))
  );

  descartados = computed(() => {
    const r = this.resultado();
    if (!r) return [];
    return [
      ...r.base.descartados.map((d, i) => ({
        clave: `base|${i}`, numero: d.obra_id ? `N.º ${d.obra_id}` : 'Persona', campo: d.campo ?? 'cargo', motivo: d.motivo,
      })),
      ...r.descartadasEnHoja.map((d, i) => ({
        clave: `hoja|${i}`, numero: `N.º ${d.escritura.obraId}`, motivo: d.motivo,
        campo: d.escritura.destino.tipo === 'campo' ? d.escritura.destino.campo
          : d.escritura.destino.tipo === 'imagen' ? `imagen_${d.escritura.destino.casilla}` : 'id_web',
      })),
    ];
  });

  pasos = computed(() => {
    const hechos = this.progreso();
    const enCurso = PASOS.find((p) => !(p.paso in hechos))?.paso;
    return PASOS.map((p) => ({
      ...p,
      etiqueta: p.paso === 'descargar' ? (this.enExcel ? 'Leer el libro abierto' : 'Descargar la hoja desde OneDrive') : p.etiqueta,
      detalle: hechos[p.paso] ?? '',
      estado: p.paso in hechos ? 'hecho' : p.paso === enCurso ? 'en-curso' : 'pendiente',
    }));
  });

  chipsEncabezados = computed(() => {
    const error = this.encabezados();
    if (!error) return [];
    return ESPERADOS.map((texto) => {
      const falta = error.faltantes.includes(texto);
      const repetido = error.repetidos.includes(texto);
      return { texto: falta ? `${texto} (no encontrado)` : repetido ? `${texto} (repetido)` : texto, mal: falta || repetido };
    });
  });

  tituloEncabezados = computed(() => {
    const error = this.encabezados();
    if (!error) return '';
    const lista = (nombres: string[]) => nombres.map((n) => `«${n}»`).join(', ');
    if (error.faltantes.length === 1) return `No se encontró el encabezado ${lista(error.faltantes)}`;
    if (error.faltantes.length > 1) return `No se encontraron los encabezados ${lista(error.faltantes)}`;
    return `Hay encabezados repetidos: ${lista(error.repetidos)}`;
  });

  async ngOnInit(): Promise<void> {
    try {
      this.hoja.set(await this.datos.hojaVinculada());
    } catch (e) {
      this.mostrarError(e);
      return;
    }
    const hoja = this.hoja();
    if (!hoja) {
      this.fase.set('sin-hoja');
      return;
    }
    try {
      this.conectado.set(await this.acceso.conectado());
    } catch {
      this.conectado.set(false);
    }
    if (!this.conectado()) {
      this.fase.set('conectar');
      return;
    }
    this.acceso.nombre(hoja).then((nombre) => this.archivo.set(nombre), () => undefined);
    await this.comparar();
  }

  elegido(eleccion: Eleccion): void {
    this.estado.update((estado) => elegir(estado, eleccion.ref, eleccion.valor));
    this.guardarDecisiones();
  }

  async aprobar(): Promise<void> {
    const calculo = this.calculo();
    if (!calculo || this.aplicando()) return;
    this.aplicando.set(true);
    this.caducado.set(false);
    this.errorAplicar.set(null);
    try {
      const resultado = await this.servicio.aplicar(calculo, aDecisiones(this.estado(), calculo.diff));
      borrarBorrador();
      this.resultado.set(resultado);
      if (!resultado.error) this.hoja.update((h) => (h ? { ...h, fecha_ultima: new Date().toISOString() } : h));
      this.fase.set('resultado');
    } catch (e) {
      if (e instanceof ErrorGraph && e.estado === 401) {
        this.caducado.set(true);
        this.guardarDecisiones();
      } else {
        this.errorAplicar.set(e instanceof Error ? e.message : 'No se pudo aplicar.');
      }
    } finally {
      this.aplicando.set(false);
    }
  }

  /** Solo desde el complemento: la URL del libro es la que da Office.js, y la web no la conoce. */
  async vincularLibro(): Promise<void> {
    const libro = this.libro();
    if (!libro || this.vinculando()) return;
    this.vinculando.set(true);
    try {
      await this.datos.vincularLibro(libro.abierto);
      this.hoja.update((h) => (h ? { ...h, url: libro.abierto } : h));
      this.libro.set(null);
      await this.comparar();
    } catch (e) {
      this.mostrarError(e);
    } finally {
      this.vinculando.set(false);
    }
  }

  async reconectar(): Promise<void> {
    this.guardarDecisiones();
    await this.conectar();
  }

  async conectar(): Promise<void> {
    this.conectando.set(true);
    try {
      await this.graph.conectar(RUTA);
    } catch (e) {
      this.conectando.set(false);
      this.mostrarError(e);
    }
  }

  async comparar(): Promise<void> {
    this.fase.set('calculando');
    this.progreso.set({});
    this.encabezados.set(null);
    this.error.set(null);
    const avisar: AvisoProgreso = (paso, detalle) => this.progreso.update((p) => ({ ...p, [paso]: detalle }));
    try {
      const calculo = await this.servicio.calcular(avisar);
      this.calculo.set(calculo);
      this.filtro.set('todo');
      this.resultado.set(null);
      this.caducado.set(false);
      this.errorAplicar.set(null);
      const restaurado = restaurarBorrador(calculo.hoja.item_id, calculo.diff);
      this.estado.set(restaurado?.estado ?? estadoInicial());
      this.recuperadas.set(restaurado && restaurado.total ? { recuperadas: restaurado.recuperadas, total: restaurado.total } : null);
      if (restaurado) this.guardarDecisiones();
      if (!hayCambios(calculo.diff)) {
        this.fase.set('vacio');
        await this.registrarSinCambios(calculo);
        return;
      }
      this.fase.set('revision');
    } catch (e) {
      if (e instanceof ErrorGraph && e.estado === 401) {
        this.conectado.set(false);
        this.fase.set('conectar');
      } else {
        this.mostrarError(e);
      }
    }
  }

  /** Sin nada que revisar, solo se ponen al día la foto y la fecha: ni `obras` ni la hoja cambian. */
  private async registrarSinCambios(calculo: Calculo): Promise<void> {
    try {
      await this.servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff));
      this.hoja.update((h) => (h ? { ...h, fecha_ultima: new Date().toISOString() } : h));
    } catch (e) {
      console.warn('No se pudo registrar la sincronización sin cambios:', e);
    }
  }

  private guardarDecisiones(): void {
    const calculo = this.calculo();
    if (calculo) guardarBorrador(calculo.hoja.item_id, calculo.diff, this.estado());
  }

  private mostrarError(e: unknown): void {
    if (e instanceof ErrorGraph && e.estado === 404) {
      this.fase.set('hoja-perdida');
      return;
    }
    if (e instanceof ErrorLibroDistinto) {
      this.libro.set(e);
      this.fase.set('otro-libro');
      return;
    }
    if (e instanceof ErrorEncabezados) this.encabezados.set(e);
    else this.error.set(e instanceof Error ? e.message : 'Ha ocurrido un error inesperado.');
    this.fase.set('error');
  }
}
