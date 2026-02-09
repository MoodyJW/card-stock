import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <main class="container">
      <h1>CardStock</h1>
      <p>Pokémon Trading Card Inventory</p>
      <p class="status">✓ Project foundation ready</p>
    </main>
  `,
  styles: `
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 24px;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 8px;
    }
    p {
      color: var(--mat-sys-on-surface-variant);
      margin: 4px 0;
    }
    .status {
      margin-top: 24px;
      color: #4caf50;
    }
  `,
})
export class HomeComponent {}
