import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

/**
 * Doble de AuthService que reproduce la carrera del sintoma: el guard corre
 * en frio (isLoading() en false, perfil aun no cargado) y el perfil admin
 * llega despues, tras un await. Implementa ademas los metodos que usaba la
 * version anterior del guard (session, refreshUserProfile, reinitializeAuth)
 * para que la carrera se reproduzca igual contra ese codigo.
 */
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

  /** Simula que el perfil admin termino de cargar, en otro tick. */
  llegaPerfilAdmin(): void {
    this.perfilCargado = true;
    this.rolAdmin = true;
    this.resolverListo();
  }

  /** Simula que el perfil termino de cargar pero el usuario no es admin. */
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

    // Deja que el guard corra hasta el final con la informacion "en frio"
    // que tiene disponible de forma sincrona (como en el sintoma real),
    // y solo despues llega el perfil admin.
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
