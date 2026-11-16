import { TestBed } from '@angular/core/testing';
import { CLIENTE_ENTRADA, EntrarComponent, MensajeEntrada } from './entrar.component';
import { OfficeService } from '../../services/office.service';

async function montar(opciones: { busqueda?: string; sesion?: { access_token: string; refresh_token: string } | null } = {}) {
  const original = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.history.replaceState(null, '', `/complemento/entrar${opciones.busqueda ?? ''}`);
  const enviados: MensajeEntrada[] = [];
  const office = {
    cargar: jasmine.createSpy('cargar').and.resolveTo({ api: {}, host: null }),
    enviarAlPanel: (m: string) => enviados.push(JSON.parse(m)),
  };
  const auth = {
    signInWithOAuth: jasmine.createSpy('signInWithOAuth').and.resolveTo({ error: null }),
    getSession: jasmine.createSpy('getSession').and.resolveTo({ data: { session: opciones.sesion ?? null }, error: null }),
  };
  TestBed.configureTestingModule({
    imports: [EntrarComponent],
    providers: [
      { provide: OfficeService, useValue: office },
      { provide: CLIENTE_ENTRADA, useValue: () => ({ auth }) },
    ],
  });
  const fixture = TestBed.createComponent(EntrarComponent);
  try {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  } finally {
    window.history.replaceState(null, '', original);
  }
  return { html: fixture.nativeElement as HTMLElement, enviados, auth };
}

describe('EntrarComponent', () => {
  afterEach(() => sessionStorage.removeItem('sb-complemento-entrar'));

  it('al abrirse lleva a Microsoft y vuelve a esta misma página', async () => {
    const { auth, enviados } = await montar();

    expect(auth.signInWithOAuth).toHaveBeenCalledOnceWith({
      provider: 'azure',
      options: { scopes: 'openid profile email', redirectTo: `${window.location.origin}/complemento/entrar` },
    });
    expect(enviados).toEqual([]);
  });

  it('a la vuelta pasa la sesión al panel y no la deja guardada en el diálogo', async () => {
    sessionStorage.setItem('sb-complemento-entrar', '{"access_token":"a"}');
    const { enviados, auth } = await montar({ busqueda: '?code=xyz', sesion: { access_token: 'a', refresh_token: 'r' } });

    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(enviados).toEqual([{ tipo: 'sesion', access_token: 'a', refresh_token: 'r' }]);
    expect(sessionStorage.getItem('sb-complemento-entrar')).toBeNull();
  });

  it('si Microsoft devuelve un error lo pasa al panel y lo muestra', async () => {
    const { enviados, html, auth } = await montar({ busqueda: '?error=access_denied&error_description=El%20usuario%20cancel%C3%B3' });

    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(enviados).toEqual([{ tipo: 'error', mensaje: 'Microsoft no completó el inicio de sesión: El usuario canceló' }]);
    expect(html.textContent).toContain('El usuario canceló');
  });

  it('si el código no da sesión avisa en vez de quedarse esperando', async () => {
    const { enviados } = await montar({ busqueda: '?code=caducado', sesion: null });
    expect(enviados).toEqual([{ tipo: 'error', mensaje: 'Microsoft devolvió el control sin una sesión.' }]);
  });
});
