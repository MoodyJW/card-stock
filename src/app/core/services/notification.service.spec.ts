import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  const openSpy = vi.fn();

  beforeEach(() => {
    openSpy.mockClear();

    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: { open: openSpy } }],
    });

    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('success should open snackbar with success panel class', () => {
    service.success('Done!');
    expect(openSpy).toHaveBeenCalledWith('Done!', undefined, {
      duration: 3000,
      panelClass: 'snackbar-success',
    });
  });

  it('success should accept custom duration', () => {
    service.success('Done!', 1000);
    expect(openSpy).toHaveBeenCalledWith('Done!', undefined, {
      duration: 1000,
      panelClass: 'snackbar-success',
    });
  });

  it('error should open snackbar with Dismiss action and error panel class', () => {
    service.error('Failed');
    expect(openSpy).toHaveBeenCalledWith('Failed', 'Dismiss', {
      duration: 5000,
      panelClass: 'snackbar-error',
    });
  });

  it('info should open snackbar with info panel class', () => {
    service.info('FYI');
    expect(openSpy).toHaveBeenCalledWith('FYI', undefined, {
      duration: 3000,
      panelClass: 'snackbar-info',
    });
  });
});
