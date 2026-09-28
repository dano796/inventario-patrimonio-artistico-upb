import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

/**
 * Cliente de Supabase de prueba: la sesion resuelve enseguida, pero la
 * consulta a `usuarios` (el perfil) queda bloqueada hasta que el test llama
 * a `resolverPerfil()`. Asi se reproduce, de forma determinista, la carrera
 * real donde la sesion ya esta lista pero el perfil todavia no.
 */
function crearClienteDePrueba(rol: string) {
  let resolverPerfil!: () => void;
  const perfilListo = new Promise<void>((resolve) => {
    resolverPerfil = resolve;
  });

  const cliente = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'admin-1' } } },
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            await perfilListo;
            return { data: { id: 'admin-1', rol }, error: null };
          },
        }),
      }),
    }),
  };

  return { cliente, resolverPerfil: () => resolverPerfil() };
}

describe('AuthService', () => {
  it('listo() no resuelve hasta que el perfil termino de cargar, aunque la sesion ya estaba lista', async () => {
    const { cliente, resolverPerfil } = crearClienteDePrueba('admin');
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { supabaseClient: cliente } },
      ],
    });

    const authService = TestBed.inject(AuthService);

    let listoResuelto = false;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    authService.listo().then(() => {
      listoResuelto = true;
    });

    // La sesion ya esta lista (el fake la resuelve de inmediato), pero el
    // perfil sigue bloqueado: listo() todavia no debe haberse resuelto.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listoResuelto).toBe(false);

    resolverPerfil();
    await authService.listo();

    expect(listoResuelto).toBe(true);
    expect(authService.isAdmin()).toBe(true);
  });

  it('refreshUserProfile() durante una carga en curso espera esa misma carga en vez de salir sin hacer nada', async () => {
    const { cliente, resolverPerfil } = crearClienteDePrueba('admin');
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { supabaseClient: cliente } },
      ],
    });

    const authService = TestBed.inject(AuthService);

    // La carga inicial (constructor) ya esta en curso y bloqueada en el
    // perfil. Disparamos un refresh mientras tanto, como hace el guard.
    const refresco = authService.refreshUserProfile();

    resolverPerfil();
    await refresco;

    expect(authService.isAdmin()).toBe(true);
  });
});
