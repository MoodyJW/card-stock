import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatButtonModule],
  template: `
    <main class="container">
      <h1>CardStock</h1>
      <p>Pokémon Trading Card Inventory</p>
      <p class="status">✓ Project foundation ready</p>

      <div style="margin-top: 2rem;">
        <button mat-stroked-button color="warn" (click)="logout()">Sign Out</button>
      </div>
    </main>
  `,
  styles: `
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 24px;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 8px;
    }
    p {
      color: var(--mat-sys-on-surface-variant);
      margin: 4px 0;
    }
    .status {
      margin-top: 24px;
      color: #4caf50;
    }
  `,
})
export class HomeComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/auth/login']);
  }
}
