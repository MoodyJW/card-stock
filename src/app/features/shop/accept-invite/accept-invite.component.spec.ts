import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AcceptInviteComponent } from './accept-invite.component';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ShopService } from '../../../core/services/shop.service';
import { ShopContextService } from '../../../core/services/shop-context.service';

describe('AcceptInviteComponent', () => {
  let component: AcceptInviteComponent;
  let fixture: ComponentFixture<AcceptInviteComponent>;

  const mockShopService = {
    acceptInvite: () => Promise.resolve({ error: null }),
  };
  const mockShopContext = {
    loadShops: () => Promise.resolve(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcceptInviteComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ShopService, useValue: mockShopService },
        { provide: ShopContextService, useValue: mockShopContext },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'test-token' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AcceptInviteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
