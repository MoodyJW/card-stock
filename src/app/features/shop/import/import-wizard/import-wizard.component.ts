import { Component, computed, inject, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { ImportParserService } from '../../../../core/services/import-parser.service';
import { ImportService } from '../../../../core/services/import.service';
import { ShopContextService } from '../../../../core/services/shop-context.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import {
  ParsedSpreadsheet,
  ColumnMapping,
  ValidatedRow,
  ImportResult,
} from '../../../../core/models/import.model';
import { CreateInventoryItem } from '../../../../core/models/inventory.model';
import { InventoryService } from '../../../../core/services/inventory.service';
import { ImportWizardReviewComponent } from '../import-wizard-review/import-wizard-review.component';

/** Human-readable labels for inventory target fields. */
const FIELD_LABELS: Record<keyof CreateInventoryItem, string> = {
  card_name: 'Card Name',
  set_name: 'Set Name',
  set_code: 'Set Code',
  card_number: 'Card Number',
  rarity: 'Rarity',
  language: 'Language',
  is_foil: 'Foil',
  condition: 'Condition',
  grading_company: 'Grading Company',
  grade: 'Grade',
  purchase_price: 'Purchase Price',
  selling_price: 'Selling Price',
  notes: 'Notes',
  status: 'Status',
};

/** Fields available to map on import (status is excluded). */
const MAPPABLE_FIELDS: (keyof CreateInventoryItem)[] = [
  'card_name',
  'set_name',
  'set_code',
  'card_number',
  'rarity',
  'language',
  'is_foil',
  'condition',
  'grading_company',
  'grade',
  'purchase_price',
  'selling_price',
  'notes',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

@Component({
  selector: 'app-import-wizard',
  imports: [
    MatStepperModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatCardModule,
    ImportWizardReviewComponent,
  ],
  templateUrl: './import-wizard.component.html',
  styleUrl: './import-wizard.component.scss',
})
export class ImportWizardComponent {
  private readonly importParser = inject(ImportParserService);
  private readonly importService = inject(ImportService);
  private readonly shopContext = inject(ShopContextService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly inventoryService = inject(InventoryService);
  private readonly router = inject(Router);

  @ViewChild('stepper') stepper!: MatStepper;

  // State signals
  readonly file = signal<File | null>(null);
  readonly parsedData = signal<ParsedSpreadsheet | null>(null);
  readonly columnMappings = signal<ColumnMapping[]>([]);
  readonly selectedSheet = signal<number>(0);
  readonly parseError = signal<string | null>(null);
  readonly isDragging = signal(false);
  readonly parsing = signal(false);

  // Step 3 signals
  readonly validatedRows = signal<ValidatedRow[]>([]);
  readonly importState = signal<'idle' | 'importing' | 'done' | 'error'>('idle');
  readonly importResult = signal<ImportResult | null>(null);
  readonly importError = signal<string | null>(null);

  // Step completion signals
  readonly uploadComplete = computed(() => this.parsedData() !== null);
  readonly mappingComplete = computed(() => this.cardNameMapped());

  // Computed signals
  readonly hasMultipleSheets = computed(() => {
    const data = this.parsedData();
    return data ? data.sheetNames.length > 1 : false;
  });

  readonly cardNameMapped = computed(() => {
    return this.columnMappings().some(m => m.targetField === 'card_name');
  });

  readonly previewRows = computed(() => {
    const data = this.parsedData();
    if (!data) return [];
    return data.rows.slice(0, 3);
  });

  // Step 3 computed
  readonly validCount = computed(
    () => this.validatedRows().filter(r => r.valid && !r.skipped).length,
  );
  readonly errorCount = computed(
    () => this.validatedRows().filter(r => !r.valid && !r.skipped).length,
  );
  readonly skippedCount = computed(() => this.validatedRows().filter(r => r.skipped).length);
  readonly importProgressPercent = computed(() => {
    const p = this.importService.importProgress();
    if (!p || p.total === 0) return 0;
    return Math.round((p.current / p.total) * 100);
  });
  readonly importProgressInfo = computed(() => this.importService.importProgress());

  readonly mappedFieldsSet = computed(() => {
    const mapped = new Set<keyof CreateInventoryItem>();
    for (const m of this.columnMappings()) {
      if (m.targetField) mapped.add(m.targetField);
    }
    return mapped;
  });

  readonly fileInfo = computed(() => {
    const f = this.file();
    if (!f) return null;
    const sizeKB = (f.size / 1024).toFixed(1);
    const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
    const sizeLabel = f.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
    return { name: f.name, size: sizeLabel };
  });

  /** Returns the list of mappable field options for a given column index. */
  getAvailableFields(
    columnIndex: number,
  ): { value: keyof CreateInventoryItem | null; label: string; disabled: boolean }[] {
    const mapped = this.mappedFieldsSet();
    const currentMapping = this.columnMappings()[columnIndex];

    const options: { value: keyof CreateInventoryItem | null; label: string; disabled: boolean }[] =
      [{ value: null, label: 'Skip this column', disabled: false }];

    for (const field of MAPPABLE_FIELDS) {
      options.push({
        value: field,
        label: FIELD_LABELS[field],
        disabled: mapped.has(field) && currentMapping?.targetField !== field,
      });
    }

    return options;
  }

  getFieldLabel(field: keyof CreateInventoryItem | null): string {
    return field ? FIELD_LABELS[field] : 'Unmapped';
  }

  // ── File handling ─────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
    // Reset input so the same file can be re-selected
    input.value = '';
  }

  async handleFile(file: File): Promise<void> {
    this.parseError.set(null);

    // Validate extension
    const extension = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      this.parseError.set(`Unsupported file type. Please upload an .xlsx, .xls, or .csv file.`);
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      this.parseError.set(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is 5 MB.`,
      );
      return;
    }

    this.file.set(file);
    this.parsing.set(true);

    try {
      const parsed = await this.importParser.parseFile(file);
      this.parsedData.set(parsed);
      this.selectedSheet.set(0);

      // Auto-map columns
      const mappings = this.importParser.autoMapColumns(parsed.headers);
      this.columnMappings.set(mappings);

      // Auto-advance to step 2
      setTimeout(() => this.stepper?.next());
    } catch (err) {
      this.parseError.set(
        err instanceof Error ? err.message : 'Failed to parse file. Please check the format.',
      );
      this.file.set(null);
      this.parsedData.set(null);
    } finally {
      this.parsing.set(false);
    }
  }

  removeFile(): void {
    this.file.set(null);
    this.parsedData.set(null);
    this.columnMappings.set([]);
    this.parseError.set(null);
    this.selectedSheet.set(0);
  }

  // ── Sheet selection ───────────────────────────────────────────

  async changeSheet(sheetIndex: number): Promise<void> {
    const data = this.parsedData();
    if (!data) return;

    this.selectedSheet.set(sheetIndex);

    // Re-extract data from the selected sheet
    // We need to re-parse the file to access the workbook
    const file = this.file();
    if (!file) return;

    this.parsing.set(true);
    try {
      // ExcelJS Workbook is needed for sheet extraction.
      // Re-parse for simplicity (the file is cached in memory).
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      const buffer = await this.readFileBuffer(file);
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv') {
        // CSV only has one sheet, re-parse not needed
        return;
      }

      await workbook.xlsx.load(buffer);
      const sheetNames = workbook.worksheets.map(ws => ws.name);
      const newParsed = this.importParser.extractSheetData(workbook, sheetIndex, sheetNames);
      this.parsedData.set(newParsed);

      const mappings = this.importParser.autoMapColumns(newParsed.headers);
      this.columnMappings.set(mappings);
    } catch {
      this.parseError.set('Failed to read sheet. Please try again.');
    } finally {
      this.parsing.set(false);
    }
  }

  // ── Column mapping ────────────────────────────────────────────

  updateMapping(sourceIndex: number, targetField: keyof CreateInventoryItem | null): void {
    this.columnMappings.update(mappings => {
      return mappings.map(m => {
        if (m.sourceIndex === sourceIndex) {
          return {
            ...m,
            targetField,
            confidence: targetField ? ('exact' as const) : ('unmapped' as const),
          };
        }
        return m;
      });
    });
  }

  getConfidenceIcon(confidence: string): string {
    switch (confidence) {
      case 'exact':
        return 'check_circle';
      case 'fuzzy':
        return 'help';
      case 'unmapped':
        return 'remove';
      default:
        return 'remove';
    }
  }

  getConfidenceTooltip(confidence: string): string {
    switch (confidence) {
      case 'exact':
        return 'Exact match detected';
      case 'fuzzy':
        return 'Possible match — please verify';
      case 'unmapped':
        return 'No match — skipped';
      default:
        return '';
    }
  }

  getCellPreview(rowIndex: number, sourceIndex: number): string {
    const rows = this.previewRows();
    if (rowIndex >= rows.length) return '';
    const value = rows[rowIndex][sourceIndex];
    if (value == null) return '';
    const str = String(value);
    return str.length > 30 ? str.substring(0, 27) + '...' : str;
  }

  // ── Step 3: Review & Import ───────────────────────────────────

  /** Called when stepper selection changes; triggers validation on entering step 3. */
  onStepChange(event: { selectedIndex: number }): void {
    if (event.selectedIndex === 2) {
      this.runValidation();
    }
  }

  /** Runs validation on all parsed rows with current column mappings. */
  runValidation(): void {
    const data = this.parsedData();
    const mappings = this.columnMappings();
    if (!data) return;

    const validated = this.importParser.validateRows(data.rows, mappings);
    this.validatedRows.set(validated);
    this.importState.set('idle');
    this.importResult.set(null);
    this.importError.set(null);
  }

  /** Toggles the skipped state of a row by row number. */
  toggleSkip(rowNumber: number): void {
    this.validatedRows.update(rows =>
      rows.map(r => (r.rowNumber === rowNumber ? { ...r, skipped: !r.skipped } : r)),
    );
  }

  /** Starts the batch import process via ImportService. */
  async startImport(): Promise<void> {
    const orgId = this.shopContext.currentShopId();
    const userId = this.supabaseService.user()?.id;
    if (!orgId) {
      this.importError.set('No shop selected. Please select a shop first.');
      return;
    }

    this.importState.set('importing');
    this.importError.set(null);

    try {
      const result = await this.importService.importCards(this.validatedRows(), orgId, userId);
      this.importResult.set(result);
      this.importState.set('done');
      // Refresh inventory so the list is up-to-date when the user navigates back
      this.inventoryService.loadInventory();
    } catch (err) {
      this.importError.set(err instanceof Error ? err.message : 'Import failed. Please try again.');
      this.importState.set('error');
    }
  }

  /** Resets the wizard to step 1 for a new import. */
  resetWizard(): void {
    this.file.set(null);
    this.parsedData.set(null);
    this.columnMappings.set([]);
    this.parseError.set(null);
    this.selectedSheet.set(0);
    this.validatedRows.set([]);
    this.importState.set('idle');
    this.importResult.set(null);
    this.importError.set(null);
    this.stepper?.reset();
  }

  /** Navigates to the inventory list page. */
  goToInventory(): void {
    const slug = this.shopContext.currentShopSlug();
    if (slug) {
      this.router.navigate(['/shop', slug, 'inventory']);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  private readFileBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
}
