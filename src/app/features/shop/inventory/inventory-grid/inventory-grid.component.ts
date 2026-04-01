import { Component, inject, input, output } from '@angular/core';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { InventoryItem, InventoryItemWithImages } from '../../../../core/models/inventory.model';
import { ImageService } from '../../../../core/services/image.service';
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
  private readonly imageService = inject(ImageService);

  readonly items = input.required<InventoryItemWithImages[]>();
  readonly cardClicked = output<InventoryItem>();
  readonly sellClicked = output<InventoryItem>();
  readonly reserveClicked = output<InventoryItem>();
  readonly deleteClicked = output<InventoryItem>();

  formatGrade(item: InventoryItem): string | null {
    if (!item.grading_company || item.grade == null) return null;
    return `${item.grading_company.toUpperCase()} ${item.grade}`;
  }

  getPrimaryImageUrl(item: InventoryItemWithImages): string | null {
    const primary = item.images?.find(img => img.is_primary);
    if (!primary) {
      const first = item.images?.[0];
      if (!first) return null;
      return this.imageService.getPublicUrl(first.storage_path);
    }
    return this.imageService.getPublicUrl(primary.storage_path);
  }
}
