import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PanelComponent } from './panel.component';
import { OfficeService } from '../../services/office.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { SincronizarComponent } from '../../../sincronizacion/components/sincronizar/sincronizar.component';

@Component({ selector: 'app-sincronizar', template: 'SINCRONIZAR' })
class SincronizarFalso {}

async function montar(opciones: { host?: string | null; rol?: 'admin' | 'usuario' | null; dialogo?: () => Promise<string> }) {
  const rol = signal(opciones.rol ?? null);
  const office = {
    cargar: jasmine.createSpy('cargar').and.resolveTo({ api: {}, host: opciones.host === undefined ? 'Excel' : opciones.host }),
    abrirDialogo: jasmine.createSpy('abrirDialogo').and.callFake(opciones.dialogo ?? (async () => '{}')),
  };
  const auth = {
    listo: async () => undefined,
    isAdmin: () => rol() === 'admin',
    isAuthenticated: () => rol() !== null,
    correo: signal('daniel@upb.edu.co'),
    refreshUserProfile: jasmine.createSpy('refreshUserProfile').and.callFake(async () => rol.set('admin')),
  };
  const supabaseAuth = {
    setSession: jasmine.createSpy('setSession').and.resolveTo({ error: null }),
    signOut: jasmine.createSpy('signOut').and.callFake(async () => rol.set(null)),
  };
  TestBed.configureTestingModule({
    imports: [PanelComponent],
    providers: [
      { provide: OfficeService, useValue: office },
      { provide: AuthService, useValue: auth },
      { provide: SupabaseService, useValue: { supabaseClient: { auth: supabaseAuth } } },
    ],
  });
  TestBed.overrideComponent(PanelComponent, { remove: { imports: [SincronizarComponent] }, add: { imports: [SincronizarFalso] } });
  const fixture = TestBed.createComponent(PanelComponent);
  const actualizar = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await actualizar();
  const html = fixture.nativeElement as HTMLElement;
  const boton = (texto: string) => [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto) as HTMLButtonElement;
  return { html, office, supabaseAuth, auth, actualizar, boton };
}

describe('PanelComponent', () => {
  it('fuera de Excel no intenta nada y lo explica', async () => {
    const { html } = await montar({ host: null });
    expect(html.textContent).toContain('Abre esta página desde Excel');
    expect(html.textContent).not.toContain('SINCRONIZAR');
  });

  it('con sesión de administrador muestra la sincronización', async () => {
    const { html } = await montar({ rol: 'admin' });
    expect(html.textContent).toContain('SINCRONIZAR');
    expect(html.textContent).toContain('daniel@upb.edu.co');
  });

  it('sin sesión inicia sesión en el diálogo y carga en el panel la sesión que devuelve', async () => {
    const { html, office, supabaseAuth, boton, actualizar } = await montar({
      dialogo: async () => JSON.stringify({ tipo: 'sesion', access_token: 'a', refresh_token: 'r' }),
    });
    expect(html.textContent).toContain('Entrar con Microsoft');

    boton('Entrar con Microsoft').click();
    await actualizar();

    expect(office.abrirDialogo).toHaveBeenCalledOnceWith('/complemento/entrar');
    expect(supabaseAuth.setSession).toHaveBeenCalledOnceWith({ access_token: 'a', refresh_token: 'r' });
    expect(html.textContent).toContain('SINCRONIZAR');
  });

  it('si el diálogo devuelve un error lo muestra y deja reintentar', async () => {
    const { html, supabaseAuth, boton, actualizar } = await montar({
      dialogo: async () => JSON.stringify({ tipo: 'error', mensaje: 'Microsoft no completó el inicio de sesión: access_denied' }),
    });

    boton('Entrar con Microsoft').click();
    await actualizar();

    expect(supabaseAuth.setSession).not.toHaveBeenCalled();
    expect(html.textContent).toContain('access_denied');
    expect(boton('Entrar con Microsoft').disabled).toBeFalse();
  });

  it('una cuenta sin rol de administrador no llega a la sincronización', async () => {
    const { html } = await montar({ rol: 'usuario' });
    expect(html.textContent).toContain('Tu cuenta no puede sincronizar');
    expect(html.textContent).not.toContain('SINCRONIZAR');
  });

  it('cerrar sesión la cierra solo en este navegador', async () => {
    const { html, supabaseAuth, boton, actualizar } = await montar({ rol: 'admin' });

    boton('Cerrar sesión').click();
    await actualizar();

    expect(supabaseAuth.signOut).toHaveBeenCalledOnceWith({ scope: 'local' });
    expect(html.textContent).toContain('Entrar con Microsoft');
  });
});
