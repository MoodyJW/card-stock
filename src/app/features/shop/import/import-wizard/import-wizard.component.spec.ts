import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ImportWizardComponent } from './import-wizard.component';
import { ImportParserService } from '../../../../core/services/import-parser.service';
import { ImportService } from '../../../../core/services/import.service';
import { ShopContextService } from '../../../../core/services/shop-context.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import {
  ParsedSpreadsheet,
  ColumnMapping,
  ValidatedRow,
} from '../../../../core/models/import.model';

describe('ImportWizardComponent', () => {
  let component: ImportWizardComponent;
  let fixture: ComponentFixture<ImportWizardComponent>;
  let parserMock: Record<string, ReturnType<typeof vi.fn>>;
  let importServiceMock: Record<string, ReturnType<typeof vi.fn> | ReturnType<typeof signal>>;
  let shopContextMock: Record<string, ReturnType<typeof signal>>;
  let supabaseMock: Record<string, ReturnType<typeof signal>>;
  let inventoryMock: Record<string, ReturnType<typeof vi.fn>>;

  const mockParsedData: ParsedSpreadsheet = {
    headers: ['Card Name', 'Set Name', 'Condition'],
    rows: [
      ['Charizard', 'Base Set', 'NM'],
      ['Pikachu', 'Jungle', 'LP'],
    ],
    sheetNames: ['Sheet1'],
  };

  const mockMappings: ColumnMapping[] = [
    { sourceIndex: 0, sourceHeader: 'Card Name', targetField: 'card_name', confidence: 'exact' },
    { sourceIndex: 1, sourceHeader: 'Set Name', targetField: 'set_name', confidence: 'exact' },
    { sourceIndex: 2, sourceHeader: 'Condition', targetField: 'condition', confidence: 'exact' },
  ];

  const mockValidatedRows: ValidatedRow[] = [
    {
      rowNumber: 2,
      data: { card_name: 'Charizard', set_name: 'Base Set', condition: 'near_mint' },
      errors: [],
      valid: true,
      skipped: false,
    },
    {
      rowNumber: 3,
      data: { card_name: 'Pikachu', set_name: 'Jungle', condition: 'lightly_played' },
      errors: [],
      valid: true,
      skipped: false,
    },
    {
      rowNumber: 4,
      data: {},
      errors: [{ field: 'card_name', message: 'Card Name is required.' }],
      valid: false,
      skipped: false,
    },
  ];

  beforeEach(async () => {
    parserMock = {
      parseFile: vi.fn().mockResolvedValue(mockParsedData),
      autoMapColumns: vi.fn().mockReturnValue(mockMappings),
      extractSheetData: vi.fn().mockReturnValue(mockParsedData),
      validateRows: vi.fn().mockReturnValue(mockValidatedRows),
    };

    importServiceMock = {
      importProgress: signal(null),
      importCards: vi.fn().mockResolvedValue({
        totalRows: 3,
        imported: 2,
        skipped: 1,
        failed: 0,
        errors: [],
      }),
    };

    shopContextMock = {
      currentShopId: signal('org-1'),
      currentShopSlug: signal('test-shop'),
    };

    supabaseMock = {
      user: signal({ id: 'user-1' }),
    };

    inventoryMock = {
      loadInventory: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ImportWizardComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ImportParserService, useValue: parserMock },
        { provide: ImportService, useValue: importServiceMock },
        { provide: ShopContextService, useValue: shopContextMock },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: InventoryService, useValue: inventoryMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('File Upload', () => {
    it('should accept .xlsx files', async () => {
      const file = new File(['data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await component.handleFile(file);

      expect(parserMock['parseFile']).toHaveBeenCalledWith(file);
      expect(component.file()).toBe(file);
      expect(component.parsedData()).toEqual(mockParsedData);
    });

    it('should accept .xls files', async () => {
      const file = new File(['data'], 'test.xls', {
        type: 'application/vnd.ms-excel',
      });

      await component.handleFile(file);

      expect(parserMock['parseFile']).toHaveBeenCalledWith(file);
      expect(component.file()).toBe(file);
    });

    it('should accept .csv files', async () => {
      const file = new File(['data'], 'test.csv', { type: 'text/csv' });

      await component.handleFile(file);

      expect(parserMock['parseFile']).toHaveBeenCalledWith(file);
      expect(component.file()).toBe(file);
    });

    it('should reject unsupported file types', async () => {
      const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });

      await component.handleFile(file);

      expect(component.parseError()).toContain('Unsupported file type');
      expect(parserMock['parseFile']).not.toHaveBeenCalled();
    });

    it('should show error for files over 5MB', async () => {
      // Create a mock file with a size over 5MB
      const file = new File(['x'], 'large.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 });

      await component.handleFile(file);

      expect(component.parseError()).toContain('too large');
      expect(parserMock['parseFile']).not.toHaveBeenCalled();
    });

    it('should set isDragging on dragover and clear on dragleave', () => {
      const dragOverEvent = new Event('dragover') as DragEvent;
      Object.assign(dragOverEvent, {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      });

      component.onDragOver(dragOverEvent);
      expect(component.isDragging()).toBe(true);

      const dragLeaveEvent = new Event('dragleave') as DragEvent;
      Object.assign(dragLeaveEvent, {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      });

      component.onDragLeave(dragLeaveEvent);
      expect(component.isDragging()).toBe(false);
    });

    it('should handle drop event and process file', async () => {
      const file = new File(['data'], 'test.xlsx');
      const dropEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: { files: [file] },
      } as unknown as DragEvent;

      component.onDrop(dropEvent);

      expect(component.isDragging()).toBe(false);
      // The file handling is async, wait for it
      await vi.waitFor(() => {
        expect(parserMock['parseFile']).toHaveBeenCalled();
      });
    });

    it('should clear file on removeFile()', async () => {
      const file = new File(['data'], 'test.xlsx');
      await component.handleFile(file);

      expect(component.file()).toBe(file);

      component.removeFile();

      expect(component.file()).toBeNull();
      expect(component.parsedData()).toBeNull();
      expect(component.columnMappings()).toEqual([]);
    });

    it('should show parse error when parsing fails', async () => {
      (parserMock['parseFile'] as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Invalid file format'),
      );

      const file = new File(['data'], 'bad.xlsx');
      await component.handleFile(file);

      expect(component.parseError()).toBe('Invalid file format');
      expect(component.file()).toBeNull();
    });
  });

  describe('Column Mapping', () => {
    beforeEach(async () => {
      const file = new File(['data'], 'test.xlsx');
      await component.handleFile(file);
    });

    it('should auto-populate column mappings from parser', () => {
      expect(component.columnMappings().length).toBe(3);
      expect(component.columnMappings()[0].targetField).toBe('card_name');
      expect(component.columnMappings()[1].targetField).toBe('set_name');
      expect(component.columnMappings()[2].targetField).toBe('condition');
    });

    it('should detect card_name as mapped', () => {
      expect(component.cardNameMapped()).toBe(true);
    });

    it('should prevent duplicate target field mappings via getAvailableFields', () => {
      const options = component.getAvailableFields(1); // For "Set Name" column

      // card_name should be disabled (already mapped by column 0)
      const cardNameOption = options.find(o => o.value === 'card_name');
      expect(cardNameOption?.disabled).toBe(true);

      // condition should be disabled (already mapped by column 2)
      const conditionOption = options.find(o => o.value === 'condition');
      expect(conditionOption?.disabled).toBe(true);

      // set_name should NOT be disabled (it's the current column's own mapping)
      const setNameOption = options.find(o => o.value === 'set_name');
      expect(setNameOption?.disabled).toBe(false);
    });

    it('should update mapping when user changes dropdown', () => {
      component.updateMapping(1, 'rarity');

      const updated = component.columnMappings().find(m => m.sourceIndex === 1);
      expect(updated?.targetField).toBe('rarity');
    });

    it('should allow unmapping a column via null', () => {
      component.updateMapping(1, null);

      const updated = component.columnMappings().find(m => m.sourceIndex === 1);
      expect(updated?.targetField).toBeNull();
      expect(updated?.confidence).toBe('unmapped');
    });

    it('should not allow advancing without card_name mapped', () => {
      // Unmap card_name
      component.updateMapping(0, null);

      expect(component.cardNameMapped()).toBe(false);
      expect(component.mappingComplete()).toBe(false);
    });

    it('should show preview rows from parsed data', () => {
      expect(component.previewRows().length).toBe(2);
      expect(component.previewRows()[0][0]).toBe('Charizard');
    });

    it('should provide correct confidence icons', () => {
      expect(component.getConfidenceIcon('exact')).toBe('check_circle');
      expect(component.getConfidenceIcon('fuzzy')).toBe('help');
      expect(component.getConfidenceIcon('unmapped')).toBe('remove');
    });

    it('should get cell preview text', () => {
      expect(component.getCellPreview(0, 0)).toBe('Charizard');
      expect(component.getCellPreview(0, 1)).toBe('Base Set');
    });

    it('should truncate long cell preview text', () => {
      const longValue = 'A'.repeat(50);
      component.parsedData.set({
        ...mockParsedData,
        rows: [[longValue, 'Set', 'NM']],
      });

      const preview = component.getCellPreview(0, 0);
      expect(preview.length).toBeLessThanOrEqual(30);
      expect(preview).toContain('...');
    });
  });

  describe('File Info', () => {
    it('should compute file info with KB for small files', async () => {
      const file = new File(['data'], 'small.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'size', { value: 512 * 1024 }); // 512 KB

      await component.handleFile(file);

      const info = component.fileInfo();
      expect(info?.name).toBe('small.csv');
      expect(info?.size).toContain('KB');
    });

    it('should compute file info with MB for large files', async () => {
      const file = new File(['data'], 'large.xlsx');
      Object.defineProperty(file, 'size', { value: 2.5 * 1024 * 1024 }); // 2.5 MB

      await component.handleFile(file);

      const info = component.fileInfo();
      expect(info?.name).toBe('large.xlsx');
      expect(info?.size).toContain('MB');
    });
  });

  describe('Multi-sheet', () => {
    it('should detect multiple sheets', async () => {
      const multiSheetData: ParsedSpreadsheet = {
        ...mockParsedData,
        sheetNames: ['Sheet1', 'Sheet2', 'Sheet3'],
      };
      (parserMock['parseFile'] as ReturnType<typeof vi.fn>).mockResolvedValueOnce(multiSheetData);

      const file = new File(['data'], 'multi.xlsx');
      await component.handleFile(file);

      expect(component.hasMultipleSheets()).toBe(true);
    });

    it('should not show sheet selector for single-sheet files', () => {
      expect(component.hasMultipleSheets()).toBe(false);
    });
  });

  describe('Review & Import (Step 3)', () => {
    beforeEach(async () => {
      const file = new File(['data'], 'test.xlsx');
      await component.handleFile(file);
    });

    it('should run validation and populate validatedRows', () => {
      component.runValidation();

      expect(parserMock['validateRows']).toHaveBeenCalledWith(mockParsedData.rows, mockMappings);
      expect(component.validatedRows().length).toBe(3);
    });

    it('should compute correct valid/error/skipped counts', () => {
      component.runValidation();

      expect(component.validCount()).toBe(2);
      expect(component.errorCount()).toBe(1);
      expect(component.skippedCount()).toBe(0);
    });

    it('should toggle skip and update counts', () => {
      component.runValidation();

      component.toggleSkip(2); // skip Charizard

      expect(component.validCount()).toBe(1);
      expect(component.skippedCount()).toBe(1);

      component.toggleSkip(2); // un-skip

      expect(component.validCount()).toBe(2);
      expect(component.skippedCount()).toBe(0);
    });

    it('should have import disabled when no valid rows', () => {
      component.runValidation();

      // Skip both valid rows
      component.toggleSkip(2);
      component.toggleSkip(3);

      expect(component.validCount()).toBe(0);
    });

    it('should call importService.importCards on startImport', async () => {
      component.runValidation();

      await component.startImport();

      expect(importServiceMock['importCards']).toHaveBeenCalledWith(
        component.validatedRows(),
        'org-1',
        'user-1',
      );
      expect(component.importState()).toBe('done');
      expect(component.importResult()).toBeTruthy();
      expect(inventoryMock['loadInventory']).toHaveBeenCalled();
    });

    it('should set error state on import failure', async () => {
      (importServiceMock['importCards'] as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error'),
      );
      component.runValidation();

      await component.startImport();

      expect(component.importState()).toBe('error');
      expect(component.importError()).toBe('Network error');
    });

    it('should trigger validation on step change to index 2', () => {
      component.onStepChange({ selectedIndex: 2 });

      expect(parserMock['validateRows']).toHaveBeenCalled();
      expect(component.validatedRows().length).toBe(3);
    });

    it('should reset wizard state on resetWizard', () => {
      component.runValidation();

      component.resetWizard();

      expect(component.file()).toBeNull();
      expect(component.parsedData()).toBeNull();
      expect(component.validatedRows()).toEqual([]);
      expect(component.importState()).toBe('idle');
      expect(component.importResult()).toBeNull();
    });
  });
});
