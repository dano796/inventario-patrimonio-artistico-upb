import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';

class AuthServiceDePrueba {
  private perfilCargado = false;
  private rolAdmin = false;
  private resolverListo!: () => void;
  private readonly promesaListo = new Promise<void>((resolve) => {
    this.resolverListo = resolve;
  });

  isLoading(): boolean {
    return false;
  }

  isAdmin(): boolean {
    return this.perfilCargado && this.rolAdmin;
  }

  isAuthenticated(): boolean {
    return this.perfilCargado;
  }

  listo(): Promise<void> {
    return this.promesaListo;
  }

  async session() {
    return { data: { session: { user: { id: 'admin-1' } } } };
  }

  async refreshUserProfile(): Promise<void> {}

  async reinitializeAuth(): Promise<void> {}

  llegaPerfilAdmin(): void {
    this.perfilCargado = true;
    this.rolAdmin = true;
    this.resolverListo();
  }

  llegaPerfilNoAdmin(): void {
    this.perfilCargado = true;
    this.rolAdmin = false;
    this.resolverListo();
  }
}

function esperarMacrotarea(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('adminGuard', () => {
  let authServiceDoble: AuthServiceDePrueba;
  let router: jasmine.SpyObj<Router>;
  const ruta = {} as ActivatedRouteSnapshot;
  const estado = {} as RouterStateSnapshot;

  beforeEach(() => {
    authServiceDoble = new AuthServiceDePrueba();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceDoble },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('deja pasar cuando el perfil admin llega despues de un await, en vez de redirigir por la carrera', async () => {
    const resultado$ = TestBed.runInInjectionContext(() =>
      adminGuard(ruta, estado)
    );

    await esperarMacrotarea();
    authServiceDoble.llegaPerfilAdmin();

    expect(await resultado$).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirige a / cuando el perfil que llega no es de admin', async () => {
    const resultado$ = TestBed.runInInjectionContext(() =>
      adminGuard(ruta, estado)
    );

    await esperarMacrotarea();
    authServiceDoble.llegaPerfilNoAdmin();

    expect(await resultado$).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('redirige a iniciar sesion cuando no hay sesion', async () => {
    const authServiceSinSesion = {
      isLoading: () => false,
      isAdmin: () => false,
      isAuthenticated: () => false,
      listo: () => Promise.resolve(),
      session: async () => ({ data: { session: null } }),
      refreshUserProfile: async () => {},
      reinitializeAuth: async () => {},
    };
    TestBed.overrideProvider(AuthService, { useValue: authServiceSinSesion });

    const resultado = await TestBed.runInInjectionContext(() =>
      adminGuard(ruta, estado)
    );

    expect(resultado).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/autenticacion/iniciar-sesion']);
  });
});

describe('adminGuard con AuthService real', () => {
  it('redirige a iniciar sesion cuando getSession() nunca resuelve, tras agotarse el tope', fakeAsync(() => {
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
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
        adminGuard(ruta, estado)
      ) as Promise<boolean>
    ).then((r) => {
      resultado = r;
    });

    tick(5000);

    expect(resultado).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith([
      '/autenticacion/iniciar-sesion',
    ]);
  }));
});
