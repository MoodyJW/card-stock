import { ErrorHandler, Injectable, inject } from '@angular/core';
import { NotificationService } from './notification.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly notify = inject(NotificationService);

  handleError(error: unknown): void {
    console.error('Unhandled error:', error);
    this.notify.error('An unexpected error occurred');
  }
}
