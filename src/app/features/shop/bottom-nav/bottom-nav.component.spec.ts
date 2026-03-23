import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BottomNavComponent } from './bottom-nav.component';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BottomNavComponent', () => {
  let component: BottomNavComponent;
  let fixture: ComponentFixture<BottomNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render 4 navigation items', () => {
    const navItems = fixture.nativeElement.querySelectorAll('.nav-item');
    expect(navItems.length).toBe(4);
  });

  it('should have Inventory item as active nav link', () => {
    const navItems = fixture.nativeElement.querySelectorAll('.nav-item');
    const inventoryItem = Array.from(navItems).find((el: unknown) =>
      (el as HTMLElement).textContent?.includes('Inventory'),
    ) as HTMLElement;
    expect(inventoryItem).toBeTruthy();
    expect(inventoryItem.classList.contains('disabled')).toBe(false);
  });
});
