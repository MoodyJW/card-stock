import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeamComponent } from './team.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ShopService } from '../../../core/services/shop.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { signal } from '@angular/core';

describe('TeamComponent', () => {
  let component: TeamComponent;
  let fixture: ComponentFixture<TeamComponent>;

  const mockShopService = {
    getMembers: () => Promise.resolve({ data: [], error: null }),
    getInvites: () => Promise.resolve({ data: [], error: null }),
    sendInvite: () => Promise.resolve({ error: null }),
    revokeInvite: () => Promise.resolve({ error: null }),
  };
  const mockShopContext = {
    currentShop: signal({
      id: '123',
      name: 'Test Shop',
      slug: 'test-shop',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: ShopService, useValue: mockShopService },
        { provide: ShopContextService, useValue: mockShopContext },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
