import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthLogInComponent } from './auth-log-in.component';
import { AuthService } from '../../../../core/services/auth.service';

describe('AuthLogInComponent', () => {
  it('se crea y ofrece entrar con Microsoft', () => {
    TestBed.configureTestingModule({
      imports: [AuthLogInComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: signal(false),
            isAdmin: signal(false),
            isLoading: signal(false),
            logInWithMicrosoft: jasmine.createSpy('logInWithMicrosoft').and.resolveTo({ error: null }),
            logIn: jasmine.createSpy('logIn').and.resolveTo({ error: null }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AuthLogInComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Microsoft');
  });
});
