import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShopLayoutComponent } from './shop-layout.component';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ShopLayoutComponent', () => {
  let component: ShopLayoutComponent;
  let fixture: ComponentFixture<ShopLayoutComponent>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shopContextMock: any;

  beforeEach(async () => {
    shopContextMock = {
      currentShop: signal({ name: 'Test Shop' }),
      currentShopSlug: signal('test-shop'),
      selectShopBySlug: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ShopLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: ShopContextService, useValue: shopContextMock },
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

  it('should set shop context from route slug', () => {
    // The slug already matched currentShopSlug, so selectShopBySlug is not called
    expect(shopContextMock.selectShopBySlug).not.toHaveBeenCalled();
  });

  it('should select shop when slug differs from current', async () => {
    shopContextMock.currentShopSlug = signal('other-shop');

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ShopLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: ShopContextService, useValue: shopContextMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => 'new-shop' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(shopContextMock.selectShopBySlug).toHaveBeenCalledWith('new-shop');
  });
});
