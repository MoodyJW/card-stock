import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ActivatedRoute } from '@angular/router';
import { Signal, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

interface MockSupabaseService {
  resetPassword: Mock;
  loading: Signal<boolean>;
}

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let supabaseMock: MockSupabaseService;

  beforeEach(async () => {
    supabaseMock = {
      resetPassword: vi.fn().mockResolvedValue({}),
      loading: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
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

  it('form should be valid with proper email', () => {
    component.form.controls.email.setValue('test@test.com');
    expect(component.form.valid).toBe(true);
  });

  it('should not call resetPassword on invalid submit', () => {
    component.onSubmit();
    expect(supabaseMock.resetPassword).not.toHaveBeenCalled();
  });

  it('should call resetPassword on valid submit', () => {
    component.form.controls.email.setValue('test@test.com');
    component.onSubmit();
    expect(supabaseMock.resetPassword).toHaveBeenCalledWith('test@test.com');
  });

  it('should show "Check your email" UI after successful submit', async () => {
    supabaseMock.resetPassword.mockResolvedValue({ error: null });
    component.form.controls.email.setValue('test@test.com');

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.submitted()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Check your email');
    expect(fixture.nativeElement.textContent).toContain('test@test.com');
  });

  it('should show error message on failed submit', async () => {
    supabaseMock.resetPassword.mockResolvedValue({ error: { message: 'Rate limit exceeded' } });
    component.form.controls.email.setValue('test@test.com');

    await component.onSubmit();
    fixture.detectChanges();

    expect(component.submitted()).toBe(false);
    expect(component.error()).toBe('Rate limit exceeded');
    const errorMsg = fixture.nativeElement.querySelector('.auth-error');
    expect(errorMsg).toBeTruthy();
    expect(errorMsg.textContent).toContain('Rate limit exceeded');
  });

  it('should set loading during submit', async () => {
    let resolvePromise: (value: { error: null }) => void;
    supabaseMock.resetPassword.mockReturnValue(
      new Promise(resolve => {
        resolvePromise = resolve;
      }),
    );
    component.form.controls.email.setValue('test@test.com');

    const submitPromise = component.onSubmit();
    expect(component.loading()).toBe(true);

    resolvePromise!({ error: null });
    await submitPromise;
    expect(component.loading()).toBe(false);
  });
});
