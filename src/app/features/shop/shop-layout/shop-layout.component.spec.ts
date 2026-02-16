import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShopLayoutComponent } from './shop-layout.component';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('ShopLayoutComponent', () => {
  let component: ShopLayoutComponent;
  let fixture: ComponentFixture<ShopLayoutComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shopContextMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let breakpointObserverMock: any;

  beforeEach(async () => {
    shopContextMock = {
      currentShop: signal({ name: 'Test Shop' }),
      currentShopSlug: signal('test-shop'),
      selectShopBySlug: vi.fn(),
    };

    breakpointObserverMock = {
      observe: vi.fn().mockReturnValue(of({ matches: false } as BreakpointState)),
    };

    await TestBed.configureTestingModule({
      imports: [ShopLayoutComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ShopContextService, useValue: shopContextMock },
        { provide: BreakpointObserver, useValue: breakpointObserverMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => 'test-shop' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be desktop mode by default (matches: false)', () => {
    expect(component.isMobile()).toBe(false);
    const sidenav = fixture.nativeElement.querySelector('mat-sidenav');
    expect(sidenav).toBeTruthy();
    const bottomNav = fixture.nativeElement.querySelector('app-bottom-nav');
    expect(bottomNav).toBeFalsy();
  });

  it('should switch to mobile mode when breakpoint matches', async () => {
    // Re-create component with mobile breakpoint match
    TestBed.resetTestingModule();
    breakpointObserverMock.observe.mockReturnValue(of({ matches: true } as BreakpointState));

    await TestBed.configureTestingModule({
      imports: [ShopLayoutComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ShopContextService, useValue: shopContextMock },
        { provide: BreakpointObserver, useValue: breakpointObserverMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => 'test-shop' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isMobile()).toBe(true);
    const sidenav = fixture.nativeElement.querySelector('mat-sidenav');
    expect(sidenav).toBeFalsy();
    const bottomNav = fixture.nativeElement.querySelector('app-bottom-nav');
    expect(bottomNav).toBeTruthy();
  });
});
