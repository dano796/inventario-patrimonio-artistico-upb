import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

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

function crearClienteQueNuncaResponde() {
  return {
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
    authService.listo().then(() => {
      listoResuelto = true;
    });

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

    const refresco = authService.refreshUserProfile();

    resolverPerfil();
    await refresco;

    expect(authService.isAdmin()).toBe(true);
  });

  it('listo() resuelve tras el tope si getSession() nunca resuelve', fakeAsync(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: { supabaseClient: crearClienteQueNuncaResponde() },
        },
      ],
    });

    const authService = TestBed.inject(AuthService);

    let listoResuelto = false;
    authService.listo().then(() => {
      listoResuelto = true;
    });

    tick(5000);

    expect(listoResuelto).toBe(true);
    expect(authService.isAuthenticated()).toBe(false);
  }));

  it('un getSession que tarda mas que el tope y luego rechaza no queda como rechazo sin capturar', fakeAsync(() => {
    let rechazarSesion!: (error: unknown) => void;
    const sesionPromesa = new Promise<never>((_, reject) => {
      rechazarSesion = reject;
    });

    const cliente = {
      auth: {
        getSession: () => sesionPromesa,
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
        { provide: SupabaseService, useValue: { supabaseClient: cliente } },
      ],
    });

    const authService = TestBed.inject(AuthService);
    spyOn(console, 'warn');

    tick(5000);

    const error = new Error('getSession fallo tarde');
    rechazarSesion(error);
    tick();

    expect(console.warn).toHaveBeenCalledWith('Error initializing auth:', error);
    expect(authService.isAuthenticated()).toBe(false);
  }));
});
