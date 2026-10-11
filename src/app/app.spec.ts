import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { AuthService } from './core/services/auth.service';
import { InactivityService } from './core/services/inactivity.service';
import { Component } from '@angular/core';

@Component({ template: '' })
class Vacia {}

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', component: Vacia },
          { path: 'autenticacion/iniciar-sesion', component: Vacia },
        ]),
        { provide: InactivityService, useValue: { startMonitoring: () => undefined } },
        {
          provide: AuthService,
          useValue: { isAdmin: signal(false), isAuthenticated: signal(false), nombre: signal(null), signOut: async () => ({}) },
        },
      ],
    });
  });

  it('muestra la cabecera en la galería', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-cabecera')).not.toBeNull();
  });

  it('no muestra la cabecera en las pantallas de autenticación', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/autenticacion/iniciar-sesion');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-cabecera')).toBeNull();
  });

  it('aplica el tema también en las pantallas sin cabecera', async () => {
    document.documentElement.removeAttribute('data-theme');
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/autenticacion/iniciar-sesion');
    fixture.detectChanges();
    expect(document.documentElement.getAttribute('data-theme')).toMatch(/^(claro|oscuro)$/);
  });
});
