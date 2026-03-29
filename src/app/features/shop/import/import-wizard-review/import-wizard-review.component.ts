import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ValidatedRow, ImportResult } from '../../../../core/models/import.model';

@Component({
  selector: 'app-import-wizard-review',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTableModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './import-wizard-review.component.html',
  styleUrl: './import-wizard-review.component.scss',
})
export class ImportWizardReviewComponent {
  validatedRows = input.required<ValidatedRow[]>();
  importState = input.required<'idle' | 'importing' | 'done' | 'error'>();
  importResult = input.required<ImportResult | null>();
  importError = input.required<string | null>();
  validCount = input.required<number>();
  errorCount = input.required<number>();
  skippedCount = input.required<number>();
  importProgressPercent = input.required<number>();
  importProgressInfo = input.required<{ current: number; total: number } | null | undefined>();

  toggleSkip = output<number>();
  startImport = output<void>();
  resetWizard = output<void>();
  goToInventory = output<void>();
  back = output<void>();
}
