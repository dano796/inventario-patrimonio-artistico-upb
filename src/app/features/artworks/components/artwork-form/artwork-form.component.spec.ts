import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ArtworkFormComponent } from './artwork-form.component';
import { ArtworksService } from '../../services/artworks.service';
import { ResponsablesService } from '../../services/responsables.service';
import { ImageService } from '../../../../shared/services/image.service';
import { obraDePrueba } from '../galeria/obra-de-prueba';
import { Artwork } from '../../../../shared/models/artwork.model';

async function montar(url: string, obra: Artwork | null = null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'nueva', component: ArtworkFormComponent },
        { path: 'editar/:id', component: ArtworkFormComponent },
      ]),
      {
        provide: ArtworksService,
        useValue: {
          loading: signal(false), error: signal(false), selectedArtwork: signal<Artwork | null>(obra),
          clearSelectedArtwork: jasmine.createSpy('clearSelectedArtwork'),
          getArtworkById: jasmine.createSpy('getArtworkById').and.resolveTo(undefined),
        },
      },
      { provide: ResponsablesService, useValue: { listar: jasmine.createSpy('listar').and.resolveTo([]) } },
      { provide: ImageService, useValue: {} },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, ArtworkFormComponent);
  await harness.fixture.whenStable();
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
}

describe('ArtworkFormComponent', () => {
  it('al crear muestra los cuatro bloques y el aviso del código de ficha', async () => {
    const html = await montar('/nueva');
    expect(html.querySelector('h1')?.textContent?.trim()).toBe('Nueva obra');
    expect(html.textContent).toContain('El código de ficha se asigna automáticamente al guardar.');
    for (const bloque of ['01 · Identificación', '02 · Descripción técnica', '03 · Custodia', '04 · Imágenes']) {
      expect(html.textContent).toContain(bloque);
    }
  });

  it('incluye descripción y bloque asignado, y el título no es obligatorio', async () => {
    const html = await montar('/nueva');
    expect(html.querySelector('label[for="descripcion"]')).not.toBeNull();
    expect(html.querySelector('label[for="bloque_asignado"]')).not.toBeNull();
    expect(html.querySelector('#titulo')?.hasAttribute('required')).toBeFalse();
    expect(html.querySelector('label[for="titulo"]')?.textContent).not.toContain('*');
  });

  it('al editar muestra el número de ficha y los valores de la obra', async () => {
    const html = await montar('/editar/14', obraDePrueba());
    expect(html.querySelector('h1')?.textContent?.trim()).toBe('Editar obra');
    expect(html.textContent).toContain('Ficha N.º 14');
    expect((html.querySelector('#titulo') as HTMLInputElement).value).toBe('Paisaje');
  });

  it('el botón de guardar envía el formulario', async () => {
    const html = await montar('/nueva');
    const guardar = [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Guardar obra')!;
    expect(guardar.getAttribute('type')).toBe('submit');
    expect(guardar.getAttribute('form')).toBe('formulario-obra');
  });
});
