import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GlobalErrorHandler } from './global-error-handler';
import { NotificationService } from './notification.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  const errorSpy = vi.fn();

  beforeEach(() => {
    errorSpy.mockClear();

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: NotificationService, useValue: { error: errorSpy } },
      ],
    });

    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('should be created', () => {
    expect(handler).toBeTruthy();
  });

  it('should log error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    const err = new Error('test');
    handler.handleError(err);
    expect(consoleSpy).toHaveBeenCalledWith('Unhandled error:', err);
    consoleSpy.mockRestore();
  });

  it('should show generic error toast', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    handler.handleError(new Error('test'));
    expect(errorSpy).toHaveBeenCalledWith('An unexpected error occurred');
  });
});
