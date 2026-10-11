import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CabeceraComponent } from './cabecera.component';
import { AuthService } from '../../../core/services/auth.service';

function montar(opciones: { admin: boolean; sesion: boolean; nombre?: string | null }) {
  TestBed.configureTestingModule({
    imports: [CabeceraComponent],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isAdmin: signal(opciones.admin),
          isAuthenticated: signal(opciones.sesion),
          nombre: signal(opciones.nombre ?? null),
          signOut: jasmine.createSpy('signOut').and.resolveTo({ error: null }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(CabeceraComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CabeceraComponent', () => {
  it('sin sesión ofrece iniciar sesión y no muestra el Tablero', () => {
    const html = montar({ admin: false, sesion: false });
    expect(html.textContent).toContain('Iniciar sesión');
    expect(html.textContent).not.toContain('Tablero');
  });

  it('un administrador ve el Tablero, su nombre y su rol', () => {
    const html = montar({ admin: true, sesion: true, nombre: 'Jobany Tobón' });
    expect(html.textContent).toContain('Tablero');
    expect(html.textContent).toContain('Jobany Tobón');
    expect(html.textContent).toContain('Administrador');
    expect(html.textContent).toContain('JT');
  });

  it('una sesión sin rol de administrador no ve el Tablero', () => {
    const html = montar({ admin: false, sesion: true, nombre: 'Ana Pérez' });
    expect(html.textContent).not.toContain('Tablero');
    expect(html.textContent).toContain('Consulta');
  });

  it('el botón de tema tiene nombre accesible', () => {
    const html = montar({ admin: false, sesion: false });
    expect(html.querySelector('button[aria-label^="Cambiar a tema"]')).not.toBeNull();
  });
});
