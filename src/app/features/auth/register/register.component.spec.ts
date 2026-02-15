import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterComponent } from './register.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ActivatedRoute } from '@angular/router';
import { Signal, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

interface MockSupabaseService {
  signUp: Mock;
  loading: Signal<boolean>;
}

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let supabaseMock: MockSupabaseService;

  beforeEach(async () => {
    supabaseMock = {
      signUp: vi.fn().mockResolvedValue({}),
      loading: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('form should be invalid when empty', () => {
    expect(component.form.valid).toBe(false);
  });

  it('form should require minimum 8 character password', () => {
    component.form.controls.password.setValue('short');
    expect(component.form.controls.password.hasError('minlength')).toBe(true);
  });

  it('passwordsMatch validator should fail when passwords differ', () => {
    component.form.controls.password.setValue('password123');
    component.form.controls.confirmPassword.setValue('different123');
    component.form.updateValueAndValidity();
    expect(component.form.hasError('passwordsMismatch')).toBe(true);
  });

  it('should call signUp on valid submit', () => {
    component.form.controls.email.setValue('test@test.com');
    component.form.controls.password.setValue('password123');
    component.form.controls.confirmPassword.setValue('password123');
    component.onSubmit();
    expect(supabaseMock.signUp).toHaveBeenCalledWith('test@test.com', 'password123');
  });

  it('should show "check your email" UI after successful registration', async () => {
    supabaseMock.signUp.mockResolvedValue({ error: null });
    component.form.controls.email.setValue('test@test.com');
    component.form.controls.password.setValue('password123');
    component.form.controls.confirmPassword.setValue('password123');

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.registered()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Check your email');
  });

  it('should show "Passwords do not match" mat-error on mismatch submit', async () => {
    component.form.controls.email.setValue('test@test.com');
    component.form.controls.password.setValue('password123');
    component.form.controls.confirmPassword.setValue('different123');

    await component.onSubmit(); // triggers markAllAsTouched since form is invalid
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const matError = fixture.nativeElement.querySelector('mat-error');
    expect(matError).toBeTruthy();
    expect(matError.textContent).toContain('Passwords do not match');
  });

  it('should show error message on failed registration', async () => {
    supabaseMock.signUp.mockResolvedValue({ error: { message: 'Registration failed' } });
    component.form.controls.email.setValue('test@test.com');
    component.form.controls.password.setValue('password123');
    component.form.controls.confirmPassword.setValue('password123');

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.error()).toBe('Registration failed');
    expect(fixture.nativeElement.textContent).toContain('Registration failed');
  });
});
