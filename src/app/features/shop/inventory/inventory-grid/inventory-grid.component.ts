import { Component, input, output } from '@angular/core';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { InventoryItem } from '../../../../core/models/inventory.model';
import { ConditionLabelPipe } from '../../../../shared/pipes/condition-label.pipe';

@Component({
  selector: 'app-inventory-grid',
  imports: [
    CurrencyPipe,
    TitleCasePipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    ConditionLabelPipe,
  ],
  templateUrl: './inventory-grid.component.html',
  styleUrl: './inventory-grid.component.scss',
})
export class InventoryGridComponent {
  readonly items = input.required<InventoryItem[]>();
  readonly cardClicked = output<InventoryItem>();
  readonly sellClicked = output<InventoryItem>();
  readonly reserveClicked = output<InventoryItem>();
  readonly deleteClicked = output<InventoryItem>();

  formatGrade(item: InventoryItem): string | null {
    if (!item.grading_company || item.grade == null) return null;
    return `${item.grading_company.toUpperCase()} ${item.grade}`;
  }
}
