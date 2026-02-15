import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmComponent } from './confirm.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { signal, WritableSignal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ConfirmComponent', () => {
  let component: ConfirmComponent;
  let fixture: ComponentFixture<ConfirmComponent>;
  let supabaseMock: { loading: WritableSignal<boolean>; isAuthenticated: WritableSignal<boolean> };
  let router: Router;

  beforeEach(async () => {
    vi.useFakeTimers();
    supabaseMock = {
      loading: signal(true),
      isAuthenticated: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [ConfirmComponent, RouterTestingModule],
      providers: [{ provide: SupabaseService, useValue: supabaseMock }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ConfirmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create with loading status', () => {
    expect(component).toBeTruthy();
    expect(component.status()).toBe('loading');
  });

  it('should show success when isAuthenticated becomes true', () => {
    supabaseMock.loading.set(false);
    supabaseMock.isAuthenticated.set(true);

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();

    expect(component.status()).toBe('success');
  });

  it('should show error after timeout when not authenticated', () => {
    supabaseMock.loading.set(false);
    supabaseMock.isAuthenticated.set(false);

    vi.advanceTimersByTime(20000);
    fixture.detectChanges();

    expect(component.status()).toBe('error');
  });

  it('should clean up interval on destroy', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    fixture.destroy();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
