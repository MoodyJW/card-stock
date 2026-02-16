import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatButtonModule],
  template: `
    <nav>
      <a routerLink="./dashboard" routerLinkActive="active" class="nav-item">
        <mat-icon>dashboard</mat-icon>
        <span>Home</span>
      </a>

      <!-- Inventory: Placeholder/Disabled -->
      <a class="nav-item disabled">
        <mat-icon>inventory_2</mat-icon>
        <span>Inventory</span>
      </a>

      <a routerLink="./team" routerLinkActive="active" class="nav-item">
        <mat-icon>group</mat-icon>
        <span>Team</span>
      </a>

      <a routerLink="./settings" routerLinkActive="active" class="nav-item">
        <mat-icon>settings</mat-icon>
        <span>Settings</span>
      </a>
    </nav>
  `,
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {}
