import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { ExpressionSpecification, GeoJSONSource, Map as MapaMl, Marker, PaddingOptions } from 'maplibre-gl';
import type { FeatureCollection, Polygon } from 'geojson';
import { TemaService } from '../../../../core/services/tema.service';
import { BloqueContado } from '../../tablero';

interface Rasgos {
  bloque: number;
  pisos?: number | null;
  obras?: number;
  proporcion?: number;
  elegido?: boolean;
}

type Bloques = FeatureCollection<Polygon, Rasgos>;

const ESTILO_CLARO = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const ESTILO_OSCURO = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
/** Nombre de la fuente vectorial y de la capa de edificios dentro de los estilos de CARTO. */
const FUENTE_BASE = 'protomaps';
const CAPA_EDIFICIOS_BASE = 'buildings';
const CAPAS_PLANAS = ['building', 'building-top'];

const CENTRO: [number, number] = [-75.5898, 6.2414];
const LIMITES: [[number, number], [number, number]] = [
  [-75.5965, 6.2365],
  [-75.5815, 6.2477],
];
const VISTA = { zoom: 16.6, pitch: 58, bearing: -24 };
/** En OpenStreetMap casi ningún edificio del campus tiene altura: se suponen tres pisos. */
const ALTURA_POR_DEFECTO_M = 10;
const ALTURA_PISO_M = 3.4;

let bloquesEnCurso: Promise<Bloques> | null = null;
let libreriaEnCurso: Promise<typeof import('maplibre-gl')> | null = null;
let hojaEnCurso: Promise<void> | null = null;

function cargarBloques(documento: Document): Promise<Bloques> {
  bloquesEnCurso ??= fetch(new URL('mapa/bloques-upb.json', documento.baseURI)).then((r) => {
    if (!r.ok) throw new Error(`bloques-upb.json: ${r.status}`);
    return r.json() as Promise<Bloques>;
  });
  bloquesEnCurso.catch(() => (bloquesEnCurso = null));
  return bloquesEnCurso;
}

/** Sin su hoja de estilos el mapa mide mal el contenedor al crearse. */
function cargarHoja(documento: Document): Promise<void> {
  hojaEnCurso ??= new Promise<void>((resolver, rechazar) => {
    const hoja = documento.createElement('link');
    hoja.rel = 'stylesheet';
    hoja.href = 'maplibre.css';
    hoja.onload = () => resolver();
    hoja.onerror = () => {
      hojaEnCurso = null;
      hoja.remove();
      rechazar(new Error('maplibre.css no cargó'));
    };
    documento.head.appendChild(hoja);
  });
  return hojaEnCurso;
}

function cargarLibreria(documento: Document): Promise<typeof import('maplibre-gl')> {
  libreriaEnCurso ??= import('maplibre-gl').then((ml) => {
    // La CSP no admite workers desde blob:, así que el worker se sirve desde el propio sitio.
    ml.setWorkerUrl(new URL('mapa/maplibre-gl-worker.mjs', documento.baseURI).href);
    return ml;
  });
  return libreriaEnCurso;
}

function centroDe(poligono: Polygon): [number, number] {
  const anillo = poligono.coordinates[0];
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const f = anillo[j][0] * anillo[i][1] - anillo[i][0] * anillo[j][1];
    area += f;
    x += (anillo[j][0] + anillo[i][0]) * f;
    y += (anillo[j][1] + anillo[i][1]) * f;
  }
  return area ? [x / (3 * area), y / (3 * area)] : [anillo[0][0], anillo[0][1]];
}

@Component({
  selector: 'app-mapa-campus',
  templateUrl: './mapa-campus.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaCampusComponent {
  private documento = inject(DOCUMENT);
  private tema = inject(TemaService);

  bloques = input.required<BloqueContado[]>();
  elegido = model<number | null>(null);
  /** Lo que tapan las tarjetas de encima: el centro del plano se calcula sin ese margen. */
  relleno = input<PaddingOptions>({ top: 0, right: 0, bottom: 0, left: 0 });

  private lienzo = viewChild.required<ElementRef<HTMLDivElement>>('lienzo');
  estado = signal<'cargando' | 'listo' | 'error'>('cargando');

  private mapa: MapaMl | null = null;
  private edificios: Bloques | null = null;
  private marcadores = new Map<number, { marcador: Marker; elemento: HTMLButtonElement }>();
  private centros = new Map<number, [number, number]>();
  private observador: ResizeObserver | null = null;
  private temaPintado = this.tema.tema();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.observador?.disconnect();
      this.mapa?.remove();
    });
    afterNextRender(() => this.iniciar());

    effect(() => {
      const bloques = this.bloques();
      const elegido = this.elegido();
      untracked(() => this.actualizarDatos(bloques, elegido));
    });
    effect(() => {
      const tema = this.tema.tema();
      untracked(() => {
        if (!this.mapa || tema === this.temaPintado) return;
        this.temaPintado = tema;
        this.mapa.setStyle(this.urlEstilo());
      });
    });
    effect(() => {
      const relleno = this.relleno();
      untracked(() => this.mapa?.easeTo({ padding: relleno, duration: 0 }));
    });
    effect(() => {
      const elegido = this.elegido();
      untracked(() => this.enfocar(elegido));
    });
  }

  private reducido(): boolean {
    return this.documento.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private urlEstilo(): string {
    return this.tema.tema() === 'oscuro' ? ESTILO_OSCURO : ESTILO_CLARO;
  }

  private async iniciar(): Promise<void> {
    try {
      const [ml, edificios] = await Promise.all([cargarLibreria(this.documento), cargarBloques(this.documento), cargarHoja(this.documento)]);
      this.edificios = edificios;
      for (const f of edificios.features) {
        if (!this.centros.has(f.properties.bloque)) this.centros.set(f.properties.bloque, centroDe(f.geometry));
      }

      const mapa = new ml.Map({
        container: this.lienzo().nativeElement,
        style: this.urlEstilo(),
        center: CENTRO,
        ...VISTA,
        minZoom: 15.5,
        maxZoom: 19.5,
        maxPitch: 70,
        maxBounds: LIMITES,
        attributionControl: false,
        locale: {
          'NavigationControl.ZoomIn': 'Acercar',
          'NavigationControl.ZoomOut': 'Alejar',
          'NavigationControl.ResetBearing': 'Volver al norte',
        },
      });
      mapa.setPadding(this.relleno());
      // En las esquinas inferiores MapLibre apila encima el último control añadido.
      mapa.addControl(new ml.AttributionControl({ compact: true }), 'bottom-left');
      mapa.addControl(new ml.NavigationControl({ visualizePitch: true }), 'bottom-left');
      // Cada estilo nuevo (al cambiar de tema) borra las capas propias: se añaden en cada carga.
      mapa.on('style.load', () => this.anadirCapas());
      mapa.on('click', 'bloques', (e) => {
        const bloque = e.features?.[0]?.properties?.['bloque'];
        if (bloque) this.alternar(bloque);
      });
      mapa.on('mouseenter', 'bloques', () => (mapa.getCanvas().style.cursor = 'pointer'));
      mapa.on('mouseleave', 'bloques', () => (mapa.getCanvas().style.cursor = ''));
      mapa.on('error', (e) => {
        if (!mapa.loaded()) this.estado.set('error');
        console.error('Mapa del campus:', e.error);
      });
      mapa.on('moveend', () => this.separarMarcadores());
      mapa.once('load', () => {
        this.estado.set('listo');
        this.ponerMarcadores(ml);
        if (this.elegido() !== null) this.enfocar(this.elegido());
      });
      this.mapa = mapa;
      this.observador = new ResizeObserver(() => mapa.resize());
      this.observador.observe(this.lienzo().nativeElement);
    } catch (error) {
      console.error('No se pudo cargar el mapa del campus:', error);
      this.estado.set('error');
    }
  }

  alternar(numero: number): void {
    if (!this.bloques().some((b) => b.numero === numero)) return;
    this.elegido.set(this.elegido() === numero ? null : numero);
  }

  private color(nombre: string): string {
    return getComputedStyle(this.documento.documentElement).getPropertyValue(nombre).trim();
  }

  private anadirCapas(): void {
    const mapa = this.mapa;
    if (!mapa) return;
    const oscuro = this.tema.tema() === 'oscuro';
    // Positron intercala calles entre sus etiquetas: los volúmenes van después de la última capa que no es texto.
    const capas = mapa.getStyle().layers;
    const ultimaPlana = capas.map((capa) => capa.type !== 'symbol').lastIndexOf(true);
    const antesDeEtiquetas = capas[ultimaPlana + 1]?.id;
    // Las capas planas de edificios de CARTO se pintarían encima de los volúmenes.
    for (const capa of CAPAS_PLANAS) if (mapa.getLayer(capa)) mapa.setLayoutProperty(capa, 'visibility', 'none');

    mapa.addLayer(
      {
        id: 'edificios-3d',
        type: 'fill-extrusion',
        source: FUENTE_BASE,
        'source-layer': CAPA_EDIFICIOS_BASE,
        minzoom: 14,
        paint: {
          'fill-extrusion-color': oscuro ? '#2c3641' : '#d5dbe0',
          'fill-extrusion-height': ['coalesce', ['get', 'height'], ALTURA_POR_DEFECTO_M],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        },
      },
      antesDeEtiquetas
    );

    const altura: ExpressionSpecification = ['case', ['has', 'pisos'], ['*', ['get', 'pisos'], ALTURA_PISO_M], ALTURA_POR_DEFECTO_M];
    mapa.addSource('bloques', { type: 'geojson', data: this.datos(this.bloques(), this.elegido()) });
    mapa.addLayer(
      {
        id: 'bloques',
        type: 'fill-extrusion',
        source: 'bloques',
        filter: ['>', ['coalesce', ['get', 'obras'], 0], 0],
        paint: {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['get', 'elegido'], false],
            this.color('--amb-3'),
            ['interpolate', ['linear'], ['get', 'proporcion'], 0, this.color('--acc'), 1, this.color('--acc-ink-2')],
          ],
          // Un poco más alto que el edificio del mapa base para taparlo por completo.
          'fill-extrusion-height': ['+', 0.6, ['max', altura, ALTURA_POR_DEFECTO_M]],
        },
      },
      antesDeEtiquetas
    );
  }

  private datos(bloques: BloqueContado[], elegido: number | null): Bloques {
    const porNumero = new Map(bloques.map((b) => [b.numero, b]));
    return {
      type: 'FeatureCollection',
      features: (this.edificios?.features ?? []).map((f) => {
        const b = porNumero.get(f.properties.bloque);
        const base: Rasgos = { bloque: f.properties.bloque };
        if (f.properties.pisos) base.pisos = f.properties.pisos;
        return { ...f, properties: b ? { ...base, obras: b.obras, proporcion: b.proporcion, elegido: b.numero === elegido } : base };
      }),
    };
  }

  private actualizarDatos(bloques: BloqueContado[], elegido: number | null): void {
    this.mapa?.getSource<GeoJSONSource>('bloques')?.setData(this.datos(bloques, elegido));
    for (const [numero, { elemento }] of this.marcadores) elemento.setAttribute('aria-pressed', String(numero === elegido));
  }

  private ponerMarcadores(ml: typeof import('maplibre-gl')): void {
    for (const b of this.bloques()) {
      const centro = this.centros.get(b.numero);
      if (!centro || !this.mapa) continue;
      const elemento = this.documento.createElement('button');
      elemento.type = 'button';
      elemento.setAttribute('aria-pressed', String(b.numero === this.elegido()));
      elemento.title = `${b.nombre ?? 'Bloque ' + b.numero}: ${b.obras.toLocaleString('es-CO')} obras`;
      elemento.className =
        'flex cursor-pointer items-center gap-1.5 rounded-full bg-superficie py-[3px] pl-[3px] pr-2.5 text-[12px] font-bold text-tinta shadow-tarjeta aria-pressed:bg-ambar-3 aria-pressed:text-white';
      const numero = this.documento.createElement('span');
      numero.className = 'grid h-5 min-w-5 place-items-center rounded-full bg-acento px-1 text-[11px] font-extrabold text-white';
      numero.textContent = String(b.numero);
      elemento.append(numero, b.obras.toLocaleString('es-CO'));
      elemento.style.zIndex = String(b.obras);
      elemento.addEventListener('click', (e) => {
        e.stopPropagation();
        this.alternar(b.numero);
      });
      const marcador = new ml.Marker({ element: elemento, anchor: 'bottom', offset: [0, -6] }).setLngLat(centro).addTo(this.mapa);
      this.marcadores.set(b.numero, { marcador, elemento });
    }
    this.separarMarcadores();
  }

  /** El Templo y el Bloque Rectoral están pegados: la etiqueta con menos obras sube hasta no tapar a otra. */
  private separarMarcadores(): void {
    const colocadas: DOMRect[] = [];
    for (const b of [...this.bloques()].sort((a, c) => c.obras - a.obras)) {
      const entrada = this.marcadores.get(b.numero);
      if (!entrada) continue;
      entrada.marcador.setOffset([0, -6]);
      const caja = entrada.elemento.getBoundingClientRect();
      let subida = 0;
      const choca = (y: number) => colocadas.some((r) => caja.left < r.right && caja.right > r.left && caja.top - y < r.bottom && caja.bottom - y > r.top);
      while (choca(subida) && subida < 200) subida += 4;
      if (subida) entrada.marcador.setOffset([0, -6 - subida]);
      colocadas.push(new DOMRect(caja.x, caja.y - subida, caja.width, caja.height));
    }
  }

  private enfocar(numero: number | null): void {
    if (!this.mapa || this.estado() !== 'listo') return;
    const centro = numero === null ? CENTRO : this.centros.get(numero);
    if (!centro) return;
    const zoom = numero === null ? VISTA.zoom : Math.max(this.mapa.getZoom(), 17.4);
    this.mapa.easeTo({ center: centro, zoom, duration: this.reducido() ? 0 : 700 });
  }
}
