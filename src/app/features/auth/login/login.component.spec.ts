import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Signal, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

interface MockSupabaseService {
  signInWithEmail: Mock;
  loading: Signal<boolean>;
}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let supabaseMock: MockSupabaseService;
  let router: Router;

  beforeEach(async () => {
    supabaseMock = {
      signInWithEmail: vi.fn().mockResolvedValue({}),
      loading: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent, RouterTestingModule],
      providers: [provideAnimationsAsync(), { provide: SupabaseService, useValue: supabaseMock }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('form should be invalid when empty', () => {
    expect(component.form.valid).toBe(false);
  });

  it('form should be invalid with bad email', () => {
    component.form.controls.email.setValue('bad-email');
    expect(component.form.controls.email.valid).toBe(false);
  });

  it('should call signInWithEmail on valid submit', () => {
    component.form.controls.email.setValue('test@test.com');
    component.form.controls.password.setValue('password');
    component.onSubmit();
    expect(supabaseMock.signInWithEmail).toHaveBeenCalledWith('test@test.com', 'password');
  });

  it('should show error message on failed login', async () => {
    supabaseMock.signInWithEmail.mockResolvedValue({ error: { message: 'Invalid login' } });
    component.form.controls.email.setValue('test@test.com');
    component.form.controls.password.setValue('password');

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.error()).toBe('Invalid login');
    const errorMsg = fixture.nativeElement.querySelector('.auth-error');
    expect(errorMsg).toBeTruthy();
    expect(errorMsg.textContent).toContain('Invalid login');
  });

  it('should navigate to / on successful login', async () => {
    supabaseMock.signInWithEmail.mockResolvedValue({ error: null });
    component.form.controls.email.setValue('test@test.com');
    component.form.controls.password.setValue('password');

    await component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should toggle password visibility', () => {
    expect(component.hidePassword()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.hidePassword()).toBe(false);
  });
});
