import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateShopComponent } from './create-shop.component';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ShopService } from '../../../core/services/shop.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { vi } from 'vitest';

describe('CreateShopComponent', () => {
  let component: CreateShopComponent;
  let fixture: ComponentFixture<CreateShopComponent>;

  const mockShopService = {
    createShop: () => Promise.resolve({ data: null, error: null }),
  };
  const mockShopContext = {
    loadShops: () => Promise.resolve(),
    selectShop: () => {
      /* noop */
    },
  };
  const mockNotify = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ShopService, useValue: mockShopService },
        { provide: ShopContextService, useValue: mockShopContext },
        { provide: NotificationService, useValue: mockNotify },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateShopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
