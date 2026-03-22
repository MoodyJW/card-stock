import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Router, provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabaseMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let notificationMock: any;
  let router: Router;

  beforeEach(async () => {
    supabaseMock = {
      client: {
        auth: {
          getUser: vi.fn(),
          updateUser: vi.fn(),
          signOut: vi.fn(),
        },
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(),
          })),
        })),
        rpc: vi.fn(),
      },
      updateProfileState: vi.fn(),
    };

    notificationMock = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: NotificationService, useValue: notificationMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should load profile data on init', async () => {
      // Mock user and profile data
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      const mockProfile = { display_name: 'Test User', avatar_url: 'http://avatar.com' };

      supabaseMock.client.auth.getUser.mockResolvedValue({ data: { user: mockUser } });

      const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockProfile, error: null });
      const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
      const selectMock = vi.fn(() => ({ eq: eqMock }));
      supabaseMock.client.from.mockReturnValue({ select: selectMock });

      // Call loadProfile directly to avoid double invocation from ngOnInit
      await component.loadProfile();

      expect(supabaseMock.client.auth.getUser).toHaveBeenCalled();
      expect(component.profileForm.value).toEqual(mockProfile);
    });
  });

  describe('Update Profile', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should update profile successfully', async () => {
      component.profileForm.setValue({ display_name: 'New Name', avatar_url: 'new-avatar' });

      supabaseMock.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'uid' } } });
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn(() => ({ eq: eqMock }));
      supabaseMock.client.from.mockReturnValue({ update: updateMock });

      await component.updateProfile();

      expect(updateMock).toHaveBeenCalledWith({
        display_name: 'New Name',
        avatar_url: 'new-avatar',
      });
      expect(eqMock).toHaveBeenCalledWith('user_id', 'uid');
      expect(notificationMock.success).toHaveBeenCalledWith('Profile updated successfully');
    });
  });

  describe('Update Password', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should be valid when passwords match', async () => {
      component.passwordForm.setValue({ password: 'password123', confirmPassword: 'password123' });
      expect(component.passwordForm.valid).toBe(true);
    });

    it('should show error if passwords mismatch', async () => {
      component.passwordForm.setValue({ password: 'password123', confirmPassword: 'password456' });
      expect(component.passwordForm.invalid).toBe(true);
      expect(component.passwordForm.hasError('mismatch')).toBe(true);
    });

    it('should call updateUser on valid submit', async () => {
      component.passwordForm.setValue({
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      });
      supabaseMock.client.auth.updateUser.mockResolvedValue({ error: null });
      supabaseMock.client.auth.signOut.mockResolvedValue({ error: null });

      await component.updatePassword();

      expect(supabaseMock.client.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
      expect(supabaseMock.client.auth.signOut).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
      expect(notificationMock.success).toHaveBeenCalled();
    });
  });

  describe('Delete Account', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should call delete_account RPC after confirmation', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('DELETE');
      supabaseMock.client.rpc.mockResolvedValue({ error: null });
      supabaseMock.client.auth.signOut.mockResolvedValue({ error: null });

      await component.deleteAccount();

      expect(supabaseMock.client.rpc).toHaveBeenCalledWith('delete_account');
      expect(supabaseMock.client.auth.signOut).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('should verify confirmation string', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('WRONG');

      await component.deleteAccount();

      expect(supabaseMock.client.rpc).not.toHaveBeenCalled();
    });
  });
});
