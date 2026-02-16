import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResetPasswordComponent } from './reset-password.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Router, provideRouter } from '@angular/router';
import { Signal, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

interface MockSupabaseService {
  updatePassword: Mock;
  loading: Signal<boolean>;
  passwordRecovery: Signal<boolean>;
}

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let supabaseMock: MockSupabaseService;
  let notifyMock: { error: Mock; success: Mock; info: Mock };
  let router: Router;

  beforeEach(async () => {
    supabaseMock = {
      updatePassword: vi.fn().mockResolvedValue({}),
      loading: signal(false),
      passwordRecovery: signal(true),
    };

    notifyMock = {
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: NotificationService, useValue: notifyMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ResetPasswordComponent);
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

  it('should not call updatePassword on invalid submit', () => {
    component.onSubmit();
    expect(supabaseMock.updatePassword).not.toHaveBeenCalled();
  });

  it('should call updatePassword on valid submit', () => {
    component.form.controls.password.setValue('newpassword123');
    component.form.controls.confirmPassword.setValue('newpassword123');
    component.onSubmit();
    expect(supabaseMock.updatePassword).toHaveBeenCalledWith('newpassword123');
  });

  it('should show success screen after successful update', async () => {
    supabaseMock.updatePassword.mockResolvedValue({ error: null });
    component.form.controls.password.setValue('newpassword123');
    component.form.controls.confirmPassword.setValue('newpassword123');

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.success()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Password updated');
  });

  it('should show error toast on failed update', async () => {
    supabaseMock.updatePassword.mockResolvedValue({ error: { message: 'Weak password' } });
    component.form.controls.password.setValue('newpassword123');
    component.form.controls.confirmPassword.setValue('newpassword123');

    await component.onSubmit();

    expect(component.success()).toBe(false);
    expect(notifyMock.error).toHaveBeenCalledWith('Weak password');
  });

  it('should navigate to home on goToHome()', () => {
    component.goToHome();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should set loading during submit', async () => {
    let resolvePromise: (value: { error: null }) => void;
    supabaseMock.updatePassword.mockReturnValue(
      new Promise(resolve => {
        resolvePromise = resolve;
      }),
    );
    component.form.controls.password.setValue('newpassword123');
    component.form.controls.confirmPassword.setValue('newpassword123');

    const submitPromise = component.onSubmit();
    expect(component.loading()).toBe(true);

    resolvePromise!({ error: null });
    await submitPromise;
    expect(component.loading()).toBe(false);
  });
});
