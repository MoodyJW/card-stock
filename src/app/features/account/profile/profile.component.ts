import { Component, inject, signal, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../../core/services/supabase.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private notification = inject(NotificationService);
  private router = inject(Router);

  profileForm: FormGroup;
  emailForm: FormGroup;
  passwordForm: FormGroup;

  loading = signal(false);
  currentEmail = signal('');

  constructor() {
    this.profileForm = this.fb.group({
      display_name: [''],
      avatar_url: [''],
    });

    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.passwordForm = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordsMatch },
    );
  }

  ngOnInit() {
    this.loadProfile();
  }

  passwordsMatch(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  async loadProfile() {
    try {
      this.loading.set(true);
      const {
        data: { user },
      } = await this.supabase.client.auth.getUser();
      if (user) {
        this.currentEmail.set(user.email ?? '');
        const { data, error } = await this.supabase.client
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          this.profileForm.patchValue(data);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Profile load error:', error);
      this.notification.error(`Failed to load profile: ${message}`);
    } finally {
      this.loading.set(false);
    }
  }

  async updateProfile() {
    if (this.profileForm.invalid) return;
    try {
      this.loading.set(true);
      const {
        data: { user },
      } = await this.supabase.client.auth.getUser();
      if (!user) throw new Error('No user');

      const { error } = await this.supabase.client
        .from('profiles')
        .update(this.profileForm.value)
        .eq('user_id', user.id);

      if (error) throw error;
      this.notification.success('Profile updated successfully');
    } catch {
      this.notification.error('Failed to update profile');
    } finally {
      this.loading.set(false);
    }
  }

  async updateEmail() {
    if (this.emailForm.invalid) return;
    try {
      this.loading.set(true);
      const { error } = await this.supabase.client.auth.updateUser({
        email: this.emailForm.value.email,
      });
      if (error) throw error;
      this.notification.success(
        'Confirmation email sent to your new address. Please check your inbox.',
      );
      this.emailForm.reset();
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.notification.error(err?.message || 'Failed to update email');
    } finally {
      this.loading.set(false);
    }
  }

  async updatePassword() {
    if (this.passwordForm.invalid) return;
    try {
      this.loading.set(true);
      const { error } = await this.supabase.client.auth.updateUser({
        password: this.passwordForm.value.password,
      });
      if (error) throw error;
      await this.supabase.client.auth.signOut();
      this.notification.success('Password updated. Please log in with your new password.');
      this.router.navigate(['/auth/login']);
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.notification.error(err?.message || 'Failed to update password');
    } finally {
      this.loading.set(false);
    }
  }

  async deleteAccount() {
    const confirmation = prompt(
      'Type "DELETE" to confirm account deletion. This action cannot be undone.',
    );
    if (confirmation !== 'DELETE') return;

    try {
      this.loading.set(true);

      const { error } = await this.supabase.client.rpc('delete_account');

      if (error) throw error;

      await this.supabase.client.auth.signOut();
      this.notification.success('Account deleted successfully');
      this.router.navigate(['/auth/login']);
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.notification.error(err?.message || 'Failed to delete account');
    } finally {
      this.loading.set(false);
    }
  }
}
