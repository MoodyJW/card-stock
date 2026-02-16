import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShopSelectorComponent } from './shop-selector.component';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { signal } from '@angular/core';

describe('ShopSelectorComponent', () => {
  let component: ShopSelectorComponent;
  let fixture: ComponentFixture<ShopSelectorComponent>;

  const mockShopContext = {
    shops: signal([]),
    loading: signal(false),
    currentShop: signal(null),
    selectShop: () => {
      /* noop */
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ShopContextService, useValue: mockShopContext },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
