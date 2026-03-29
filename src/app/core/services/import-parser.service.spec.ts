import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { Workbook } from 'exceljs';
import { ImportParserService } from './import-parser.service';
import { ColumnMapping, RawRow } from '../models/import.model';

describe('ImportParserService', () => {
  let service: ImportParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ImportParserService],
    });
    service = TestBed.inject(ImportParserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── parseFile ──────────────────────────────────────────────────

  describe('parseFile', () => {
    it('should parse an .xlsx file and return headers + rows', async () => {
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet('Cards');
      sheet.addRow(['Card Name', 'Set Name', 'Condition']);
      sheet.addRow(['Charizard', 'Base Set', 'NM']);
      sheet.addRow(['Pikachu', 'Jungle', 'LP']);

      const buffer = await workbook.xlsx.writeBuffer();
      const file = new File([buffer], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const result = await service.parseFile(file);

      expect(result.headers).toEqual(['Card Name', 'Set Name', 'Condition']);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0][0]).toBe('Charizard');
      expect(result.rows[0][1]).toBe('Base Set');
      expect(result.rows[0][2]).toBe('NM');
      expect(result.rows[1][0]).toBe('Pikachu');
      expect(result.sheetNames).toEqual(['Cards']);
    });

    it('should parse a .csv file and return headers + rows', async () => {
      const csvContent = 'Card Name,Set Name,Condition\nMew,Base Set,Mint\nEevee,Jungle,NM\n';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const result = await service.parseFile(file);

      expect(result.headers).toEqual(['Card Name', 'Set Name', 'Condition']);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0][0]).toBe('Mew');
      expect(result.rows[1][0]).toBe('Eevee');
    });

    it('should throw an error for an empty workbook', async () => {
      const workbook = new Workbook();
      const buffer = await workbook.xlsx.writeBuffer();
      const file = new File([buffer], 'empty.xlsx');

      await expect(service.parseFile(file)).rejects.toThrow('no worksheets');
    });
  });

  // ── extractSheetData ──────────────────────────────────────────

  describe('extractSheetData', () => {
    it('should extract data from a specific worksheet index', () => {
      const workbook = new Workbook();
      workbook.addWorksheet('Sheet1');
      const sheet2 = workbook.addWorksheet('Sheet2');
      sheet2.addRow(['Name', 'Price']);
      sheet2.addRow(['Snorlax', 25.5]);

      const result = service.extractSheetData(workbook, 1, ['Sheet1', 'Sheet2']);

      expect(result.headers).toEqual(['Name', 'Price']);
      expect(result.rows[0][0]).toBe('Snorlax');
      expect(result.rows[0][1]).toBe(25.5);
    });

    it('should throw for an invalid sheet index', () => {
      const workbook = new Workbook();
      workbook.addWorksheet('Sheet1');

      expect(() => service.extractSheetData(workbook, 5, ['Sheet1'])).toThrow('not found');
    });
  });

  // ── autoMapColumns ────────────────────────────────────────────

  describe('autoMapColumns', () => {
    it('should map "Card Name" to card_name with exact confidence', () => {
      const result = service.autoMapColumns(['Card Name']);

      expect(result[0].targetField).toBe('card_name');
      expect(result[0].confidence).toBe('exact');
    });

    it('should map "Name" to card_name with fuzzy confidence', () => {
      const result = service.autoMapColumns(['Name']);

      expect(result[0].targetField).toBe('card_name');
      expect(result[0].confidence).toBe('fuzzy');
    });

    it('should leave unknown headers unmapped', () => {
      const result = service.autoMapColumns(['Some Custom Column']);

      expect(result[0].targetField).toBeNull();
      expect(result[0].confidence).toBe('unmapped');
    });

    it('should be case-insensitive', () => {
      const result = service.autoMapColumns(['CARD NAME', 'set name', 'CONDITION']);

      expect(result[0].targetField).toBe('card_name');
      expect(result[1].targetField).toBe('set_name');
      expect(result[2].targetField).toBe('condition');
    });

    it('should handle whitespace-padded headers', () => {
      const result = service.autoMapColumns(['  Card Name  ', ' Set Name ']);

      expect(result[0].targetField).toBe('card_name');
      expect(result[1].targetField).toBe('set_name');
    });

    it('should prevent duplicate field mappings', () => {
      const result = service.autoMapColumns(['Card Name', 'Name']);

      expect(result[0].targetField).toBe('card_name');
      // "Name" would also map to card_name, but card_name is already taken
      expect(result[1].targetField).toBeNull();
      expect(result[1].confidence).toBe('unmapped');
    });

    it('should map all recognized headers correctly', () => {
      const headers = [
        'Card Name',
        'Set Name',
        'Set Code',
        'Card Number',
        'Rarity',
        'Language',
        'Foil',
        'Condition',
        'Grading Company',
        'Grade',
        'Purchase Price',
        'Selling Price',
        'Notes',
      ];

      const result = service.autoMapColumns(headers);

      const mappedFields = result.filter(m => m.targetField !== null).map(m => m.targetField);

      expect(mappedFields).toEqual([
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
      ]);
    });

    it('should map fuzzy aliases like "Cost", "#", "Expansion"', () => {
      const result = service.autoMapColumns(['#', 'Expansion', 'Cost']);

      expect(result[0].targetField).toBe('card_number');
      expect(result[0].confidence).toBe('fuzzy');
      expect(result[1].targetField).toBe('set_name');
      expect(result[1].confidence).toBe('fuzzy');
      expect(result[2].targetField).toBe('purchase_price');
      expect(result[2].confidence).toBe('exact');
    });
  });

  // ── validateRows ──────────────────────────────────────────────

  describe('validateRows', () => {
    function buildMapping(
      fields: (keyof import('../models/inventory.model').CreateInventoryItem | null)[],
    ): ColumnMapping[] {
      return fields.map((field, index) => ({
        sourceIndex: index,
        sourceHeader: field ?? 'Unknown',
        targetField: field,
        confidence: field ? ('exact' as const) : ('unmapped' as const),
      }));
    }

    it('should flag missing card_name as error', () => {
      const mapping = buildMapping(['card_name', 'set_name']);
      const rows: RawRow[] = [['', 'Base Set']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(false);
      expect(result[0].errors.some(e => e.field === 'card_name')).toBe(true);
    });

    it('should flag card_name exceeding 200 characters', () => {
      const mapping = buildMapping(['card_name']);
      const longName = 'A'.repeat(201);
      const rows: RawRow[] = [[longName]];

      const result = service.validateRows(rows, mapping);

      expect(result[0].errors.some(e => e.field === 'card_name' && e.message.includes('200'))).toBe(
        true,
      );
    });

    it('should parse condition aliases ("NM" → "near_mint")', () => {
      const mapping = buildMapping(['card_name', 'condition']);
      const rows: RawRow[] = [['Charizard', 'NM']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(true);
      expect(result[0].data.condition).toBe('near_mint');
    });

    it('should flag invalid condition values', () => {
      const mapping = buildMapping(['card_name', 'condition']);
      const rows: RawRow[] = [['Charizard', 'TERRIBLE']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(false);
      expect(result[0].errors.some(e => e.field === 'condition')).toBe(true);
    });

    it('should default condition to near_mint when not mapped', () => {
      const mapping = buildMapping(['card_name']);
      const rows: RawRow[] = [['Charizard']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].data.condition).toBe('near_mint');
    });

    it('should default language to English when not mapped', () => {
      const mapping = buildMapping(['card_name']);
      const rows: RawRow[] = [['Charizard']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].data.language).toBe('English');
    });

    it('should always set status to available', () => {
      const mapping = buildMapping(['card_name']);
      const rows: RawRow[] = [['Charizard']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].data.status).toBe('available');
    });

    it('should reject grade without grading_company', () => {
      const mapping = buildMapping(['card_name', 'grade']);
      const rows: RawRow[] = [['Charizard', 9.5]];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(false);
      expect(
        result[0].errors.some(e => e.field === 'grade' && e.message.includes('Grading Company')),
      ).toBe(true);
    });

    it('should accept grade with grading_company', () => {
      const mapping = buildMapping(['card_name', 'grading_company', 'grade']);
      const rows: RawRow[] = [['Charizard', 'PSA', 9.5]];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(true);
      expect(result[0].data.grading_company).toBe('psa');
      expect(result[0].data.grade).toBe(9.5);
    });

    it('should flag invalid grading company', () => {
      const mapping = buildMapping(['card_name', 'grading_company']);
      const rows: RawRow[] = [['Charizard', 'UNKNOWN_COMPANY']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(false);
      expect(result[0].errors.some(e => e.field === 'grading_company')).toBe(true);
    });

    it('should flag grade outside 0-10 range', () => {
      const mapping = buildMapping(['card_name', 'grading_company', 'grade']);
      const rows: RawRow[] = [['Charizard', 'PSA', 11]];

      const result = service.validateRows(rows, mapping);

      expect(
        result[0].errors.some(e => e.field === 'grade' && e.message.includes('between 0 and 10')),
      ).toBe(true);
    });

    it('should parse prices correctly and flag negative values', () => {
      const mapping = buildMapping(['card_name', 'purchase_price', 'selling_price']);
      const rows: RawRow[] = [['Charizard', '$1,234.56', '$99.99']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(true);
      expect(result[0].data.purchase_price).toBe(1234.56);
      expect(result[0].data.selling_price).toBe(99.99);
    });

    it('should flag unparseable price values', () => {
      const mapping = buildMapping(['card_name', 'purchase_price']);
      const rows: RawRow[] = [['Charizard', 'not-a-price']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(false);
      expect(result[0].errors.some(e => e.field === 'purchase_price')).toBe(true);
    });

    it('should handle foil as boolean, string, and number', () => {
      const mapping = buildMapping(['card_name', 'is_foil']);
      const rows: RawRow[] = [
        ['Card A', 'yes'],
        ['Card B', 'no'],
        ['Card C', true],
        ['Card D', false],
        ['Card E', 1],
        ['Card F', 0],
      ];

      const result = service.validateRows(rows, mapping);

      expect(result[0].data.is_foil).toBe(true);
      expect(result[1].data.is_foil).toBe(false);
      expect(result[2].data.is_foil).toBe(true);
      expect(result[3].data.is_foil).toBe(false);
      expect(result[4].data.is_foil).toBe(true);
      expect(result[5].data.is_foil).toBe(false);
    });

    it('should set correct rowNumber (header = row 1, data starts at row 2)', () => {
      const mapping = buildMapping(['card_name']);
      const rows: RawRow[] = [['Card A'], ['Card B'], ['Card C']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].rowNumber).toBe(2);
      expect(result[1].rowNumber).toBe(3);
      expect(result[2].rowNumber).toBe(4);
    });

    it('should skip unmapped columns', () => {
      const mapping = buildMapping(['card_name', null]);
      const rows: RawRow[] = [['Charizard', 'ignored-value']];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(true);
      expect(result[0].data.card_name).toBe('Charizard');
    });

    it('should handle a complete valid row with all fields', () => {
      const mapping = buildMapping([
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
      ]);
      const rows: RawRow[] = [
        [
          'Charizard',
          'Base Set',
          'BS',
          '4/102',
          'Rare Holo',
          'English',
          'yes',
          'Near Mint',
          'PSA',
          9.5,
          '$100.00',
          '$250.00',
          'Great card',
        ],
      ];

      const result = service.validateRows(rows, mapping);

      expect(result[0].valid).toBe(true);
      expect(result[0].errors).toHaveLength(0);
      expect(result[0].data).toEqual(
        expect.objectContaining({
          card_name: 'Charizard',
          set_name: 'Base Set',
          set_code: 'BS',
          card_number: '4/102',
          rarity: 'Rare Holo',
          language: 'English',
          is_foil: true,
          condition: 'near_mint',
          grading_company: 'psa',
          grade: 9.5,
          purchase_price: 100,
          selling_price: 250,
          notes: 'Great card',
          status: 'available',
        }),
      );
    });
  });

  // ── parsePrice ────────────────────────────────────────────────

  describe('parsePrice', () => {
    it('should strip $ and commas ("$1,234.56" → 1234.56)', () => {
      expect(service.parsePrice('$1,234.56')).toBe(1234.56);
    });

    it('should handle plain numbers', () => {
      expect(service.parsePrice(42)).toBe(42);
      expect(service.parsePrice('42.50')).toBe(42.5);
    });

    it('should return null for negative numbers', () => {
      expect(service.parsePrice(-10)).toBeNull();
    });

    it('should return null for unparseable strings', () => {
      expect(service.parsePrice('abc')).toBeNull();
      expect(service.parsePrice('')).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(service.parsePrice(null)).toBeNull();
      expect(service.parsePrice(undefined)).toBeNull();
    });

    it('should handle whitespace around price', () => {
      expect(service.parsePrice(' $5.00 ')).toBe(5);
    });
  });

  // ── parseCondition ────────────────────────────────────────────

  describe('parseCondition', () => {
    it('should map abbreviation "NM" to "near_mint"', () => {
      expect(service.parseCondition('NM')).toBe('near_mint');
    });

    it('should map abbreviation "LP" to "lightly_played"', () => {
      expect(service.parseCondition('LP')).toBe('lightly_played');
    });

    it('should map abbreviation "MP" to "moderately_played"', () => {
      expect(service.parseCondition('MP')).toBe('moderately_played');
    });

    it('should map abbreviation "HP" to "heavily_played"', () => {
      expect(service.parseCondition('HP')).toBe('heavily_played');
    });

    it('should map abbreviation "DMG" to "damaged"', () => {
      expect(service.parseCondition('DMG')).toBe('damaged');
    });

    it('should map full names like "Near Mint"', () => {
      expect(service.parseCondition('Near Mint')).toBe('near_mint');
      expect(service.parseCondition('Lightly Played')).toBe('lightly_played');
    });

    it('should handle already-correct enum values', () => {
      expect(service.parseCondition('near_mint')).toBe('near_mint');
      expect(service.parseCondition('heavily_played')).toBe('heavily_played');
    });

    it('should be case-insensitive', () => {
      expect(service.parseCondition('nm')).toBe('near_mint');
      expect(service.parseCondition('NEAR MINT')).toBe('near_mint');
    });

    it('should return null for unknown values', () => {
      expect(service.parseCondition('garbage')).toBeNull();
    });

    it('should return null for null/undefined/empty', () => {
      expect(service.parseCondition(null)).toBeNull();
      expect(service.parseCondition(undefined)).toBeNull();
      expect(service.parseCondition('')).toBeNull();
    });
  });

  // ── parseFoil ─────────────────────────────────────────────────

  describe('parseFoil', () => {
    it('should return true for "yes", "true", "1"', () => {
      expect(service.parseFoil('yes')).toBe(true);
      expect(service.parseFoil('true')).toBe(true);
      expect(service.parseFoil('1')).toBe(true);
    });

    it('should return true for boolean true and number 1', () => {
      expect(service.parseFoil(true)).toBe(true);
      expect(service.parseFoil(1)).toBe(true);
    });

    it('should return false for "no", "false", "0"', () => {
      expect(service.parseFoil('no')).toBe(false);
      expect(service.parseFoil('false')).toBe(false);
      expect(service.parseFoil('0')).toBe(false);
    });

    it('should return false for boolean false and number 0', () => {
      expect(service.parseFoil(false)).toBe(false);
      expect(service.parseFoil(0)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(service.parseFoil(null)).toBe(false);
      expect(service.parseFoil(undefined)).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(service.parseFoil('YES')).toBe(true);
      expect(service.parseFoil('True')).toBe(true);
    });
  });

  // ── parseGradingCompany ───────────────────────────────────────

  describe('parseGradingCompany', () => {
    it('should map valid companies case-insensitively', () => {
      expect(service.parseGradingCompany('PSA')).toBe('psa');
      expect(service.parseGradingCompany('cgc')).toBe('cgc');
      expect(service.parseGradingCompany('BGS')).toBe('bgs');
      expect(service.parseGradingCompany('Sgc')).toBe('sgc');
      expect(service.parseGradingCompany('ACE')).toBe('ace');
    });

    it('should return null for unknown companies', () => {
      expect(service.parseGradingCompany('UNKNOWN')).toBeNull();
    });

    it('should return null for null/undefined/empty', () => {
      expect(service.parseGradingCompany(null)).toBeNull();
      expect(service.parseGradingCompany(undefined)).toBeNull();
      expect(service.parseGradingCompany('')).toBeNull();
    });
  });
});
