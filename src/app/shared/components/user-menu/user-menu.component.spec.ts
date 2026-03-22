import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserMenuComponent } from './user-menu.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { NotificationService } from '../../../core/services/notification.service';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';

describe('UserMenuComponent', () => {
  let component: UserMenuComponent;
  let fixture: ComponentFixture<UserMenuComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabaseMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let notificationMock: any;
  let router: Router;

  beforeEach(async () => {
    vi.restoreAllMocks();

    supabaseMock = {
      user: signal({ email: 'test@example.com' }),
      profile: signal({ display_name: 'Test User', avatar_url: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    };

    notificationMock = {
      info: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UserMenuComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: NotificationService, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserMenuComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute displayName and email from signals', () => {
    expect(component.displayName()).toBe('Test User');
    expect(component.email()).toBe('test@example.com');
  });

  it('should call signOut, remove item, show toast, and redirect on signOut', async () => {
    vi.spyOn(Storage.prototype, 'removeItem');
    await component.signOut();

    expect(supabaseMock.signOut).toHaveBeenCalled();
    expect(localStorage.removeItem).toHaveBeenCalledWith('last_active_shop');
    expect(notificationMock.info).toHaveBeenCalledWith('You have been signed out');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('should show error toast and not navigate when signOut fails', async () => {
    supabaseMock.signOut.mockResolvedValue({ error: { message: 'Network error' } });
    vi.spyOn(Storage.prototype, 'removeItem');
    await component.signOut();

    expect(notificationMock.error).toHaveBeenCalledWith('Failed to sign out');
    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
