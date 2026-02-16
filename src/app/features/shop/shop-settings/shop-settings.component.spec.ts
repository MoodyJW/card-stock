import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ShopSettingsComponent } from './shop-settings.component';
import { ShopService } from '../../../core/services/shop.service';
import { ShopContextService } from '../../../core/services/shop-context.service';

describe('ShopSettingsComponent', () => {
  let component: ShopSettingsComponent;
  let fixture: ComponentFixture<ShopSettingsComponent>;

  const mockShopService = {
    getMyRole: () => Promise.resolve({ data: { role: 'owner' }, error: null }),
    leaveShop: () => Promise.resolve({ error: null }),
    deleteShop: () => Promise.resolve({ error: null }),
  };

  const mockShopContext = {
    currentShopId: signal('shop-1'),
    currentShop: signal({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }),
    loadShops: () => Promise.resolve(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopSettingsComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ShopService, useValue: mockShopService },
        { provide: ShopContextService, useValue: mockShopContext },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
