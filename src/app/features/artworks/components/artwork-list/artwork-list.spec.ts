import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ArtworkListComponent } from './artwork-list.component';
import { ArtworksService } from '../../services/artworks.service';
import { ArtworkExportService } from '../../services/artwork-export.service';
import { AuthService } from '../../../../core/services/auth.service';
import { obraDePrueba } from '../galeria/obra-de-prueba';
import { CLAVE_VISTA } from '../../utils/galeria';

@Component({ template: '' })
class Vacia {}

const esperarEspera = () => new Promise((r) => setTimeout(r, 350));

function escribir(campo: HTMLInputElement, texto: string) {
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
}

function montar(esAdmin: boolean, admin = signal(esAdmin), listo: () => Promise<void> = () => Promise.resolve()) {
  const artworks = signal([obraDePrueba(), obraDePrueba({ id: 15, titulo: null })]);
  const servicio = {
    artworks, loading: signal(false), error: signal(false), currentPage: signal(1), totalItems: signal(2),
    totalPages: signal(1), startItem: signal(1), endItem: signal(2), hasPreviousPage: signal(false), hasNextPage: signal(false),
    getAllArtworks: jasmine.createSpy('getAllArtworks').and.resolveTo(undefined),
    filterArtworks: jasmine.createSpy('filterArtworks').and.resolveTo(undefined),
    clearAllFilters: jasmine.createSpy('clearAllFilters').and.resolveTo(undefined),
    goToPage: jasmine.createSpy('goToPage').and.resolveTo(undefined),
    isValidPageNumber: () => true,
  };
  TestBed.configureTestingModule({
    imports: [ArtworkListComponent],
    providers: [
      provideRouter([{ path: '', component: Vacia }]),
      { provide: ArtworksService, useValue: servicio },
      { provide: ArtworkExportService, useValue: { exportToExcel: jasmine.createSpy('exportToExcel').and.resolveTo(2) } },
      { provide: AuthService, useValue: { isAdmin: admin, isAuthenticated: signal(esAdmin), isLoading: signal(false), listo } },
    ],
  });
  const fixture = TestBed.createComponent(ArtworkListComponent);
  fixture.detectChanges();
  return { fixture, servicio, html: fixture.nativeElement as HTMLElement };
}

describe('ArtworkListComponent', () => {
  afterEach(() => {
    localStorage.removeItem(CLAVE_VISTA);
    localStorage.removeItem('artwork-filters');
  });

  it('muestra las obras y la línea de resultado', () => {
    const { html } = montar(false);
    expect(html.textContent).toContain('Galería de obras');
    expect(html.textContent).toContain('Paisaje');
    expect(html.textContent).toContain('Sin título');
    expect(html.textContent).toContain('2 obras');
  });

  it('sin rol de administrador no ofrece registrar obras ni muestra ubicaciones', () => {
    const { html } = montar(false);
    expect(html.textContent).not.toContain('Registrar obra');
    expect(html.textContent).not.toContain('Bloque 6');
  });

  it('un administrador puede registrar obras y ve las ubicaciones', () => {
    const { html } = montar(true);
    expect(html.textContent).toContain('Registrar obra');
    expect(html.textContent).toContain('Bloque 6');
  });

  it('cambia de vista y la recuerda', () => {
    const { fixture, html } = montar(false);
    const tabla = [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Tabla')!;
    tabla.click();
    fixture.detectChanges();
    expect(html.querySelector('app-tabla-obras')).not.toBeNull();
    expect(localStorage.getItem(CLAVE_VISTA)).toBe('tabla');
  });

  it('un error de carga ofrece reintentar', () => {
    const { fixture, servicio, html } = montar(false);
    servicio.error.set(true);
    fixture.detectChanges();
    const reintentar = [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Reintentar')!;
    reintentar.click();
    expect(servicio.filterArtworks).toHaveBeenCalled();
  });

  it('espera al perfil antes de la primera carga y conserva los filtros restringidos guardados', async () => {
    localStorage.setItem('artwork-filters', JSON.stringify({ ubicacionFilter: 'Bloque 6', timestamp: Date.now() }));
    const admin = signal(false);
    let perfilListo!: () => void;
    const { fixture, servicio } = montar(false, admin, () => new Promise<void>((r) => (perfilListo = r)));
    await Promise.resolve();
    expect(servicio.getAllArtworks.calls.count() + servicio.filterArtworks.calls.count()).toBe(0);
    admin.set(true);
    perfilListo();
    await fixture.whenStable();
    expect(servicio.filterArtworks).toHaveBeenCalledTimes(1);
    expect(servicio.filterArtworks.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ ubicacion: 'Bloque 6' }));
  });

  it('un parpadeo del rol al volver a la pestaña no recarga la galería', async () => {
    const admin = signal(true);
    const { fixture, servicio } = montar(true, admin);
    await fixture.whenStable();
    const cargas = servicio.getAllArtworks.calls.count() + servicio.filterArtworks.calls.count();
    admin.set(false);
    fixture.detectChanges();
    admin.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(servicio.getAllArtworks.calls.count() + servicio.filterArtworks.calls.count()).toBe(cargas);
  });

  it('si la URL cambia por una navegación ajena, aplica sus filtros', async () => {
    const { fixture, servicio } = montar(false);
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?autor=Ana');
    await fixture.whenStable();
    expect(servicio.filterArtworks.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ autor: 'Ana' }));
    expect(fixture.componentInstance.chips().map((c) => c.texto)).toEqual(['Autor: Ana']);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(servicio.filterArtworks.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ autor: '' }));
  });

  it('el eco de la URL de un filtro propio no provoca otra carga', async () => {
    const { fixture, servicio } = montar(false);
    await fixture.whenStable();
    servicio.filterArtworks.calls.reset();
    fixture.componentInstance.autorFilter.set('Ana');
    await fixture.componentInstance.performFilters();
    await fixture.whenStable();
    expect(servicio.filterArtworks).toHaveBeenCalledTimes(1);
  });

  it('un filtro que llega mientras otro se aplica no se pierde: se aplica al terminar', async () => {
    const { fixture, servicio } = montar(false);
    await fixture.whenStable();
    let terminarPrimero!: () => void;
    servicio.filterArtworks.and.returnValues(new Promise<void>((r) => (terminarPrimero = r)), Promise.resolve());
    servicio.filterArtworks.calls.reset();
    const componente = fixture.componentInstance;
    componente.autorFilter.set('Ana');
    const primero = componente.performFilters();
    componente.tecnicaFilter.set('Óleo');
    const segundo = componente.performFilters();
    terminarPrimero();
    await Promise.all([primero, segundo]);
    await fixture.whenStable();
    expect(servicio.filterArtworks).toHaveBeenCalledTimes(2);
    expect(servicio.filterArtworks.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ autor: 'Ana', tecnica: 'Óleo' }));
  });

  it('Enter en Ubicación antes de la espera añade la ubicación y vacía el campo', async () => {
    const { fixture, html } = montar(true);
    await fixture.whenStable();
    fixture.componentInstance.showAdvancedFilters.set(true);
    fixture.detectChanges();
    const campo = html.querySelector<HTMLInputElement>('#filtro-ubicacion')!;
    escribir(campo, 'Bloque 3');
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedUbicaciones()).toEqual(['Bloque 3']);
    expect(campo.value).toBe('');
  });
});
