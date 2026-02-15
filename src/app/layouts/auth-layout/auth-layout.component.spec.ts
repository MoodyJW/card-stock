import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthLayoutComponent } from './auth-layout.component';
import { RouterTestingModule } from '@angular/router/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';

describe('AuthLayoutComponent', () => {
  let component: AuthLayoutComponent;
  let fixture: ComponentFixture<AuthLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthLayoutComponent, RouterTestingModule],
      providers: [provideAnimationsAsync()],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the CardStock logo', () => {
    const logo = fixture.nativeElement.querySelector('.auth-logo');
    expect(logo).toBeTruthy();
    expect(logo.textContent).toContain('CardStock');
  });

  it('should render the tagline', () => {
    const tagline = fixture.nativeElement.querySelector('.auth-tagline');
    expect(tagline).toBeTruthy();
    expect(tagline.textContent).toContain('Pokémon Card Inventory Management');
  });

  it('should contain a router-outlet for child routes', () => {
    const outlet = fixture.nativeElement.querySelector('router-outlet');
    expect(outlet).toBeTruthy();
  });

  it('should render the footer with copyright', () => {
    const footer = fixture.nativeElement.querySelector('.auth-footer');
    expect(footer).toBeTruthy();
    expect(footer.textContent).toContain('CardStock');
    expect(footer.textContent).toContain('All rights reserved');
  });

  it('should have the auth-layout wrapper', () => {
    const layout = fixture.nativeElement.querySelector('.auth-layout');
    expect(layout).toBeTruthy();
  });

  it('should have the auth-content container', () => {
    const content = fixture.nativeElement.querySelector('.auth-content');
    expect(content).toBeTruthy();
  });
});
