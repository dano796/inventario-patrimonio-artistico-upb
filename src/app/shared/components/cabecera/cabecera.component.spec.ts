import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CabeceraComponent } from './cabecera.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({ template: '' })
class Vacia {}

function montar(opciones: { admin: boolean; sesion: boolean; nombre?: string | null }) {
  TestBed.configureTestingModule({
    imports: [CabeceraComponent],
    providers: [
      provideRouter([{ path: '**', component: Vacia }]),
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

  it('marca la galería como activa aunque la URL lleve filtros', async () => {
    const html = montar({ admin: false, sesion: false });
    await TestBed.inject(Router).navigateByUrl('/?autor=Ana');
    TestBed.tick();
    const galeria = [...html.querySelectorAll('nav[aria-label="Principal"] a')].find((a) => a.textContent?.trim() === 'Galería')!;
    expect(galeria.classList).toContain('!text-acento-tinta');
  });

  it('el botón de tema tiene nombre accesible', () => {
    const html = montar({ admin: false, sesion: false });
    expect(html.querySelector('button[aria-label^="Cambiar a tema"]')).not.toBeNull();
  });

  it('cerrar sesión es un botón con icono y nombre accesible', () => {
    const html = montar({ admin: true, sesion: true, nombre: 'Jobany Tobón' });
    const boton = html.querySelector<HTMLButtonElement>('button[aria-label="Cerrar sesión"]')!;
    expect(boton).not.toBeNull();
    expect(boton.querySelector('svg')).not.toBeNull();
    expect(boton.textContent?.trim()).toBe('');
    boton.click();
    expect(TestBed.inject(AuthService).signOut).toHaveBeenCalled();
  });

  it('la galería sigue marcada en la ficha, el registro y la edición, pero no en el Tablero', async () => {
    const html = montar({ admin: true, sesion: true });
    const enlace = (texto: string) => [...html.querySelectorAll('nav[aria-label="Principal"] a')].find((a) => a.textContent?.trim() === texto)!;
    const marcada = (texto: string) => enlace(texto).classList.contains('!text-acento-tinta');
    for (const url of ['/obra/247', '/nueva', '/editar/247']) {
      await TestBed.inject(Router).navigateByUrl(url);
      TestBed.tick();
      expect(marcada('Galería')).withContext(url).toBeTrue();
    }
    await TestBed.inject(Router).navigateByUrl('/tablero');
    TestBed.tick();
    expect(marcada('Galería')).toBeFalse();
    expect(marcada('Tablero')).toBeTrue();
  });
});
