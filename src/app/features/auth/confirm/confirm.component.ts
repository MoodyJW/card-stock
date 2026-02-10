import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-confirm',
  imports: [MatProgressSpinnerModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './confirm.component.html',
  styleUrl: './confirm.component.scss',
})
export class ConfirmComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<'loading' | 'success' | 'error'>('loading');
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    // Supabase handles the token exchange automatically via the URL hash
    // We just need to wait for the auth state to update
    const maxWait = 5000;
    const interval = 100;
    let elapsed = 0;

    const check = setInterval(() => {
      elapsed += interval;

      if (this.supabase.isAuthenticated()) {
        clearInterval(check);
        this.status.set('success');
        setTimeout(() => this.router.navigate(['/']), 2000);
      } else if (elapsed >= maxWait) {
        clearInterval(check);
        this.status.set('error');
        this.error.set('Confirmation failed. The link may have expired.');
      }
    }, interval);

    this.destroyRef.onDestroy(() => clearInterval(check));
  }
}
