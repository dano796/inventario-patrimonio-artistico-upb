import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ArtworkListComponent } from './artwork-list.component';
import { ArtworksService } from '../../services/artworks.service';
import { ArtworkExportService } from '../../services/artwork-export.service';
import { AuthService } from '../../../../core/services/auth.service';
import { obraDePrueba } from '../galeria/obra-de-prueba';
import { CLAVE_VISTA } from '../../utils/galeria';

function montar(esAdmin: boolean, admin = signal(esAdmin)) {
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
      provideRouter([]),
      { provide: ArtworksService, useValue: servicio },
      { provide: ArtworkExportService, useValue: { exportToExcel: jasmine.createSpy('exportToExcel').and.resolveTo(2) } },
      { provide: AuthService, useValue: { isAdmin: admin, isAuthenticated: signal(esAdmin), isLoading: signal(false) } },
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

  it('recarga con las columnas de administración si el rol llega después de la primera carga', async () => {
    const admin = signal(false);
    const { fixture, servicio } = montar(false, admin);
    await fixture.whenStable();
    const cargasIniciales = servicio.getAllArtworks.calls.count() + servicio.filterArtworks.calls.count();
    admin.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(servicio.getAllArtworks.calls.count() + servicio.filterArtworks.calls.count()).toBe(cargasIniciales + 1);
  });

  it('un administrador ya resuelto no provoca una segunda carga', async () => {
    const { fixture, servicio } = montar(true);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(servicio.getAllArtworks.calls.count() + servicio.filterArtworks.calls.count()).toBe(1);
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
});
