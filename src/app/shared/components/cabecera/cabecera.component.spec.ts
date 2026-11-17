import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CabeceraComponent } from './cabecera.component';
import { AuthService } from '../../../core/services/auth.service';
import { CLAVE_TEMA, TemaService } from '../../../core/services/tema.service';

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
          correo: signal(opciones.sesion ? 'jobany.tobon@upb.edu.co' : null),
          signOut: jasmine.createSpy('signOut').and.resolveTo({ error: null }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(CabeceraComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const botonPerfil = (html: HTMLElement) => html.querySelector<HTMLButtonElement>('button[aria-haspopup="true"]')!;
const botonPorTexto = (html: HTMLElement, texto: string) =>
  [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);

function abrirPerfil(html: HTMLElement) {
  botonPerfil(html).click();
  TestBed.tick();
}


describe('CabeceraComponent', () => {
  it('solo un administrador ve la pestaña Sincronizar', () => {
    expect(montar({ admin: true, sesion: true }).querySelector('a[href="/sincronizacion"]')?.textContent?.trim()).toBe('Sincronizar');
    TestBed.resetTestingModule();
    expect(montar({ admin: false, sesion: true }).querySelector('a[href="/sincronizacion"]')).toBeNull();
  });

  it('sin sesión ofrece iniciar sesión y no muestra Resumen ni Mapa', () => {
    const html = montar({ admin: false, sesion: false });
    expect(html.textContent).toContain('Iniciar sesión');
    expect(html.querySelector('a[href="/resumen"]')).toBeNull();
    expect(html.querySelector('a[href="/mapa"]')).toBeNull();
  });

  it('un administrador ve Resumen y Mapa, sus iniciales, su nombre y su rol; el correo está en su perfil', () => {
    const html = montar({ admin: true, sesion: true, nombre: 'Jobany Tobón' });
    expect(html.querySelector('nav[aria-label="Principal"] a[href="/resumen"]')?.textContent?.trim()).toBe('Resumen');
    expect(html.querySelector('nav[aria-label="Principal"] a[href="/mapa"]')?.textContent?.trim()).toBe('Mapa');
    const boton = botonPerfil(html).textContent!;
    expect(boton).toContain('JT');
    expect(boton).toContain('Jobany Tobón');
    expect(boton).toContain('Administrador');
    expect(html.textContent).not.toContain('jobany.tobon@upb.edu.co');
    abrirPerfil(html);
    const texto = html.querySelector('#menu-perfil')!.textContent!;
    expect(texto.indexOf('Jobany Tobón')).toBeGreaterThanOrEqual(0);
    expect(texto.indexOf('jobany.tobon@upb.edu.co')).toBeGreaterThan(texto.indexOf('Jobany Tobón'));
  });

  it('una sesión sin rol de administrador no ve Resumen ni Mapa', () => {
    const html = montar({ admin: false, sesion: true, nombre: 'Ana Pérez' });
    expect(html.querySelector('a[href="/resumen"]')).toBeNull();
    expect(html.querySelector('a[href="/mapa"]')).toBeNull();
    abrirPerfil(html);
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

  it('con sesión, el tema y cerrar sesión quedan dentro del perfil', () => {
    const html = montar({ admin: true, sesion: true, nombre: 'Jobany Tobón' });
    expect(html.querySelector('button[aria-label^="Cambiar a tema"]')).toBeNull();
    expect(botonPorTexto(html, 'Cerrar sesión')).toBeUndefined();
    expect(botonPerfil(html).getAttribute('aria-expanded')).toBe('false');
    abrirPerfil(html);
    expect(botonPerfil(html).getAttribute('aria-expanded')).toBe('true');
    expect(botonPorTexto(html, 'Claro')).toBeDefined();
    expect(botonPorTexto(html, 'Oscuro')).toBeDefined();
    botonPorTexto(html, 'Cerrar sesión')!.click();
    expect(TestBed.inject(AuthService).signOut).toHaveBeenCalled();
  });

  it('el perfil de la cabecera lleva una flecha hacia abajo a la derecha', () => {
    const boton = botonPerfil(montar({ admin: true, sesion: true, nombre: 'Jobany Tobón' }));
    const flecha = boton.lastElementChild!;
    expect(flecha.tagName.toLowerCase()).toBe('svg');
    expect(flecha.getAttribute('aria-hidden')).toBe('true');
  });

  it('las opciones de tema y cerrar sesión llevan icono', () => {
    const html = montar({ admin: true, sesion: true, nombre: 'Jobany Tobón' });
    abrirPerfil(html);
    for (const texto of ['Claro', 'Oscuro', 'Cerrar sesión']) {
      expect(botonPorTexto(html, texto)!.querySelector('svg[aria-hidden="true"]')).withContext(texto).not.toBeNull();
    }
  });

  it('el perfil cambia el tema y marca el elegido', () => {
    const html = montar({ admin: true, sesion: true, nombre: 'Jobany Tobón' });
    abrirPerfil(html);
    botonPorTexto(html, 'Oscuro')!.click();
    TestBed.tick();
    expect(TestBed.inject(TemaService).tema()).toBe('oscuro');
    expect(botonPorTexto(html, 'Oscuro')!.getAttribute('aria-pressed')).toBe('true');
    expect(botonPorTexto(html, 'Claro')!.getAttribute('aria-pressed')).toBe('false');
    expect(html.querySelector('#menu-perfil')).not.toBeNull();
    localStorage.removeItem(CLAVE_TEMA);
    document.documentElement.removeAttribute('data-theme');
  });

  it('el perfil se cierra con Escape, devolviendo el foco, y con un clic fuera', () => {
    const html = montar({ admin: true, sesion: true, nombre: 'Jobany Tobón' });
    abrirPerfil(html);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    TestBed.tick();
    expect(html.querySelector('#menu-perfil')).toBeNull();
    expect(document.activeElement).toBe(botonPerfil(html));
    abrirPerfil(html);
    document.body.click();
    TestBed.tick();
    expect(html.querySelector('#menu-perfil')).toBeNull();
  });

  it('la galería sigue marcada en la ficha, el registro y la edición, pero no en Resumen ni en Mapa', async () => {
    const html = montar({ admin: true, sesion: true });
    const enlace = (texto: string) => [...html.querySelectorAll('nav[aria-label="Principal"] a')].find((a) => a.textContent?.trim() === texto)!;
    const marcada = (texto: string) => enlace(texto).classList.contains('!text-acento-tinta');
    for (const url of ['/obra/247', '/nueva', '/editar/247']) {
      await TestBed.inject(Router).navigateByUrl(url);
      TestBed.tick();
      expect(marcada('Galería')).withContext(url).toBeTrue();
    }
    for (const [url, texto] of [['/resumen', 'Resumen'], ['/mapa', 'Mapa']]) {
      await TestBed.inject(Router).navigateByUrl(url);
      TestBed.tick();
      expect(marcada('Galería')).withContext(url).toBeFalse();
      expect(marcada(texto)).withContext(url).toBeTrue();
    }
  });
});
