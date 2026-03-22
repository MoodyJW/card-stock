import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppLayoutComponent } from './app-layout.component';
import { ShopContextService } from '../../core/services/shop-context.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { NotificationService } from '../../core/services/notification.service';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('AppLayoutComponent', () => {
  let component: AppLayoutComponent;
  let fixture: ComponentFixture<AppLayoutComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shopContextMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabaseMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let breakpointObserverMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let notificationMock: any;

  beforeEach(async () => {
    shopContextMock = {
      currentShop: signal({ name: 'Test Shop', slug: 'test-shop' }),
      currentShopSlug: signal('test-shop'),
    };

    supabaseMock = {
      user: signal({ email: 'test@example.com' }),
      profile: signal({ display_name: 'Test User', avatar_url: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    };

    breakpointObserverMock = {
      observe: vi.fn().mockReturnValue(of({ matches: false } as BreakpointState)),
    };

    notificationMock = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ShopContextService, useValue: shopContextMock },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BreakpointObserver, useValue: breakpointObserverMock },
        { provide: NotificationService, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show sidenav in desktop mode', () => {
    expect(component.isMobile()).toBe(false);
    const sidenav = fixture.nativeElement.querySelector('mat-sidenav');
    expect(sidenav).toBeTruthy();
  });

  it('should compute shop base path from current shop slug', () => {
    expect(component.shopBasePath()).toBe('/shop/test-shop');
  });

  it('should show shop name in toolbar', () => {
    expect(component.currentShopName()).toBe('Test Shop');
  });

  it('should show shop nav links when shop is selected', () => {
    const listItems = fixture.nativeElement.querySelectorAll('mat-nav-list a');
    const texts = Array.from(listItems).map((el: unknown) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(texts.some(t => t?.includes('Dashboard'))).toBe(true);
    expect(texts.some(t => t?.includes('Team Management'))).toBe(true);
  });

  it('should not show shop nav when no shop is selected', async () => {
    shopContextMock.currentShop = signal(null);
    shopContextMock.currentShopSlug = signal(null);

    TestBed.resetTestingModule();
    breakpointObserverMock.observe.mockReturnValue(of({ matches: false } as BreakpointState));

    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ShopContextService, useValue: shopContextMock },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: BreakpointObserver, useValue: breakpointObserverMock },
        { provide: NotificationService, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.shopBasePath()).toBeNull();
    const listItems = fixture.nativeElement.querySelectorAll('mat-nav-list a');
    const texts = Array.from(listItems).map((el: unknown) =>
      (el as HTMLElement).textContent?.trim(),
    );
    expect(texts.some(t => t?.includes('Dashboard'))).toBe(false);
    expect(texts.some(t => t?.includes('Switch Store'))).toBe(true);
  });
});
