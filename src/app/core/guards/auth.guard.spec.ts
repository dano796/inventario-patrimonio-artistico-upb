import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { privateGuard, publicGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';

class AuthServiceDePrueba {
  private perfilCargado = false;
  private resolverListo!: () => void;
  private readonly promesaListo = new Promise<void>((resolve) => {
    this.resolverListo = resolve;
  });

  isLoading(): boolean {
    return false;
  }

  isAdmin(): boolean {
    return false;
  }

  isAuthenticated(): boolean {
    return this.perfilCargado;
  }

  listo(): Promise<void> {
    return this.promesaListo;
  }

  async session() {
    return { data: { session: { user: { id: 'user-1' } } } };
  }

  async refreshUserProfile(): Promise<void> {}

  async reinitializeAuth(): Promise<void> {}

  llegaPerfil(): void {
    this.perfilCargado = true;
    this.resolverListo();
  }

  terminaSinSesion(): void {
    this.resolverListo();
  }
}

function esperarMacrotarea(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('privateGuard', () => {
  let authServiceDoble: AuthServiceDePrueba;
  let router: jasmine.SpyObj<Router>;
  const ruta = {} as ActivatedRouteSnapshot;
  const estado = { url: '/sincronizacion/vincular' } as RouterStateSnapshot;

  beforeEach(() => {
    authServiceDoble = new AuthServiceDePrueba();
    router = jasmine.createSpyObj<Router>('Router', [
      'navigate',
      'navigateByUrl',
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceDoble },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('deja pasar cuando el perfil llega despues de un await, en vez de redirigir por la carrera', async () => {
    const resultado$ = TestBed.runInInjectionContext(() =>
      privateGuard(ruta, estado)
    );

    await esperarMacrotarea();
    authServiceDoble.llegaPerfil();

    expect(await resultado$).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});

describe('privateGuard sin sesion', () => {
  it('redirige a iniciar sesion', async () => {
    const authServiceDoble = new AuthServiceDePrueba();
    const router = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl']);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceDoble },
        { provide: Router, useValue: router },
      ],
    });
    authServiceDoble.terminaSinSesion();

    const resultado = await TestBed.runInInjectionContext(() =>
      privateGuard({} as ActivatedRouteSnapshot, { url: '/nueva' } as RouterStateSnapshot)
    );

    expect(resultado).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/autenticacion/iniciar-sesion');
  });
});

describe('privateGuard con AuthService real', () => {
  it('redirige a iniciar sesion cuando getSession() nunca resuelve, tras agotarse el tope', fakeAsync(() => {
    const router = jasmine.createSpyObj<Router>('Router', [
      'navigate',
      'navigateByUrl',
    ]);
    const clienteQueNuncaResponde = {
      auth: {
        getSession: () => new Promise<never>(() => {}),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe() {} } },
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({ single: () => new Promise<never>(() => {}) }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: { supabaseClient: clienteQueNuncaResponde },
        },
        { provide: Router, useValue: router },
      ],
    });

    const ruta = {} as ActivatedRouteSnapshot;
    const estado = {} as RouterStateSnapshot;

    let resultado: boolean | undefined;
    (
      TestBed.runInInjectionContext(() =>
        privateGuard(ruta, estado)
      ) as Promise<boolean>
    ).then((r) => {
      resultado = r;
    });

    tick(5000);

    expect(resultado).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith(
      '/autenticacion/iniciar-sesion'
    );
  }));
});

describe('publicGuard', () => {
  let authServiceDoble: AuthServiceDePrueba;
  let router: jasmine.SpyObj<Router>;
  const ruta = {} as ActivatedRouteSnapshot;

  beforeEach(() => {
    authServiceDoble = new AuthServiceDePrueba();
    router = jasmine.createSpyObj<Router>('Router', [
      'navigate',
      'navigateByUrl',
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceDoble },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('redirige a / cuando el perfil (con sesion) llega despues de un await', async () => {
    const estado = { url: '/autenticacion/iniciar-sesion' } as RouterStateSnapshot;
    const resultado$ = TestBed.runInInjectionContext(() =>
      publicGuard(ruta, estado)
    );

    await esperarMacrotarea();
    authServiceDoble.llegaPerfil();

    expect(await resultado$).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('deja pasar a iniciar sesion a quien no tiene sesion', async () => {
    authServiceDoble.terminaSinSesion();
    const estado = { url: '/autenticacion/iniciar-sesion' } as RouterStateSnapshot;

    const resultado = await TestBed.runInInjectionContext(() =>
      publicGuard(ruta, estado)
    );

    expect(resultado).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('deja pasar sin esperar a listo() la ruta de actualizar contrasena', async () => {
    const estado = {
      url: '/autenticacion/actualizar-contrasena',
    } as RouterStateSnapshot;

    const resultado = await TestBed.runInInjectionContext(() =>
      publicGuard(ruta, estado)
    );

    expect(resultado).toBe(true);
  });
});
