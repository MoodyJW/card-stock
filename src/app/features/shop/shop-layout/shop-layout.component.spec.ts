import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShopLayoutComponent } from './shop-layout.component';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('ShopLayoutComponent', () => {
  let component: ShopLayoutComponent;
  let fixture: ComponentFixture<ShopLayoutComponent>;

  const mockShopContext = {
    currentShop: signal(null),
    currentShopSlug: signal(null),
    selectShopBySlug: () => {
      /* noop */
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ShopContextService, useValue: mockShopContext },
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => null }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
