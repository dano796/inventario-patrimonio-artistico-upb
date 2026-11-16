import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ArtworkDetailComponent } from './artwork-detail.component';
import { ArtworksService } from '../../services/artworks.service';
import { AuthService } from '../../../../core/services/auth.service';
import { obraDePrueba } from '../galeria/obra-de-prueba';
import { Artwork } from '../../../../shared/models/artwork.model';

async function montar(obra: Artwork, esAdmin: boolean, admin = signal(esAdmin), listo: () => Promise<void> = () => Promise.resolve()) {
  const servicio = {
    selectedArtwork: signal<Artwork | null>(obra), loading: signal(false), error: signal(false),
    getArtworkById: jasmine.createSpy('getArtworkById').and.resolveTo(undefined),
    clearSelectedArtwork: jasmine.createSpy('clearSelectedArtwork'),
    deleteArtwork: jasmine.createSpy('deleteArtwork').and.resolveTo(undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'obra/:id', component: ArtworkDetailComponent }]),
      { provide: ArtworksService, useValue: servicio },
      { provide: AuthService, useValue: { isAdmin: admin, isAuthenticated: signal(esAdmin), isLoading: signal(false), listo } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/obra/14', ArtworkDetailComponent);
  await harness.fixture.whenStable();
  harness.detectChanges();
  return { harness, servicio, html: harness.routeNativeElement as HTMLElement };
}

describe('ArtworkDetailComponent', () => {
  it('carga la obra de la ruta', async () => {
    const { servicio } = await montar(obraDePrueba(), false);
    expect(servicio.getArtworkById).toHaveBeenCalledWith(14);
  });

  it('sin rol de administrador no muestra custodia, valor ni acciones', async () => {
    const { html } = await montar(obraDePrueba(), false);
    expect(html.textContent).toContain('Técnica');
    for (const oculto of ['Valor estimado', 'Bloque 6', 'JOBANY TOBÓN', 'Editar', 'Eliminar']) {
      expect(html.textContent).not.toContain(oculto);
    }
  });

  it('un administrador ve todo y puede eliminar con confirmación', async () => {
    const imagenes = [{ id: 1, url: 'https://x/a.jpg', nombre: 'a' }, { id: 2, url: 'https://x/b.jpg', nombre: 'b' }];
    const { harness, html } = await montar(obraDePrueba({ imagenes }), true);
    expect(html.textContent).toContain('Valor estimado');
    [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Eliminar')!.click();
    harness.detectChanges();
    expect(html.querySelector('[role="dialog"]')?.textContent).toContain('«Paisaje» y sus 2 imágenes se eliminarán de forma permanente.');
  });

  it('una obra sin título muestra «Sin título»', async () => {
    const { html } = await montar(obraDePrueba({ titulo: null }), false);
    expect(html.querySelector('h1')?.textContent?.trim()).toBe('Sin título');
  });

  it('espera al perfil antes de leer la obra', async () => {
    let perfilListo!: () => void;
    const pendiente = new Promise<void>((r) => (perfilListo = r));
    const promesa = montar(obraDePrueba(), false, signal(false), () => pendiente);
    const servicio = TestBed.inject(ArtworksService) as unknown as { getArtworkById: jasmine.Spy };
    await new Promise((r) => setTimeout(r));
    expect(servicio.getArtworkById).not.toHaveBeenCalled();
    perfilListo();
    await promesa;
    expect(servicio.getArtworkById).toHaveBeenCalledOnceWith(14);
  });

  it('un parpadeo del rol al volver a la pestaña no vuelve a leer la obra', async () => {
    const admin = signal(true);
    const { harness, servicio } = await montar(obraDePrueba(), true, admin);
    admin.set(false);
    harness.detectChanges();
    admin.set(true);
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(servicio.getArtworkById).toHaveBeenCalledTimes(1);
  });
});
