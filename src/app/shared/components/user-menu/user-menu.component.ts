import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { SupabaseService } from '../../../core/services/supabase.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-user-menu',
  imports: [MatMenuModule, MatButtonModule, MatIconModule, MatDividerModule, RouterLink],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
})
export class UserMenuComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  readonly user = this.supabase.user;
  readonly profile = this.supabase.profile;

  readonly displayName = computed(() => this.profile()?.display_name || 'User');
  readonly email = computed(() => this.user()?.email || '');
  readonly avatarUrl = computed(() => this.profile()?.avatar_url || null);

  async signOut() {
    const { error } = await this.supabase.signOut();
    if (error) {
      this.notification.error('Failed to sign out');
      return;
    }
    localStorage.removeItem('last_active_shop');
    this.notification.info('You have been signed out');
    this.router.navigate(['/auth/login']);
  }
}
