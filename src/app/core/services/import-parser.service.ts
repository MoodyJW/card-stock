import { Injectable } from '@angular/core';
import { Workbook, CellValue } from 'exceljs';
import {
  ParsedSpreadsheet,
  RawRow,
  ColumnMapping,
  ValidatedRow,
  FieldError,
} from '../models/import.model';
import { Condition, CreateInventoryItem, GradingCompany } from '../models/inventory.model';

/** Map of inventory field → exact header matches (lowercased). */
const EXACT_HEADER_MAP: Record<keyof CreateInventoryItem, string[]> = {
  card_name: ['card name'],
  set_name: ['set name'],
  set_code: ['set code'],
  card_number: ['card number'],
  rarity: ['rarity'],
  language: ['language'],
  is_foil: ['foil', 'is foil'],
  condition: ['condition'],
  grading_company: ['grading company'],
  grade: ['grade'],
  purchase_price: ['purchase price', 'cost', 'buy price'],
  selling_price: ['selling price', 'price', 'sell price'],
  notes: ['notes', 'comments'],
  status: [], // never mapped on import
};

/** Map of inventory field → fuzzy/alternate header matches (lowercased). */
const FUZZY_HEADER_MAP: Record<string, keyof CreateInventoryItem> = {
  name: 'card_name',
  card: 'card_name',
  set: 'set_name',
  expansion: 'set_name',
  'set #': 'set_code',
  number: 'card_number',
  '#': 'card_number',
  'card #': 'card_number',
  lang: 'language',
  holo: 'is_foil',
  cond: 'condition',
  grader: 'grading_company',
  score: 'grade',
};

/** Condition alias map — keys are lowercased, trimmed representations. */
const CONDITION_ALIAS_MAP: Record<string, Condition> = {
  // Abbreviations
  m: 'mint',
  nm: 'near_mint',
  lp: 'lightly_played',
  mp: 'moderately_played',
  hp: 'heavily_played',
  dmg: 'damaged',
  // Full names (natural)
  mint: 'mint',
  'near mint': 'near_mint',
  'lightly played': 'lightly_played',
  'moderately played': 'moderately_played',
  'heavily played': 'heavily_played',
  damaged: 'damaged',
  // Enum values (snake_case)
  near_mint: 'near_mint',
  lightly_played: 'lightly_played',
  moderately_played: 'moderately_played',
  heavily_played: 'heavily_played',
};

const VALID_GRADING_COMPANIES: GradingCompany[] = ['psa', 'cgc', 'bgs', 'sgc', 'ace'];

const TRUTHY_FOIL_VALUES = new Set(['yes', 'true', '1']);

@Injectable({
  providedIn: 'root',
})
export class ImportParserService {
  /**
   * Parses an Excel (.xlsx/.xls) or CSV file and returns the headers,
   * rows, and sheet names.
   */
  async parseFile(file: File): Promise<ParsedSpreadsheet> {
    const workbook = new Workbook();
    const buffer = await this.readFileAsArrayBuffer(file);

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      const text = new TextDecoder().decode(buffer);
      return this.parseCSVText(text);
    } else {
      await workbook.xlsx.load(buffer);
    }

    const sheetNames = workbook.worksheets.map(ws => ws.name);

    if (workbook.worksheets.length === 0) {
      throw new Error('The file contains no worksheets.');
    }

    return this.extractSheetData(workbook, 0, sheetNames);
  }

  /**
   * Extracts headers and row data from a specific worksheet index.
   */
  extractSheetData(
    workbook: Workbook,
    sheetIndex: number,
    sheetNames: string[],
  ): ParsedSpreadsheet {
    const worksheet = workbook.worksheets[sheetIndex];
    if (!worksheet) {
      throw new Error(`Worksheet at index ${sheetIndex} not found.`);
    }

    const headers: string[] = [];
    const rows: RawRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Header row
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers[colNumber - 1] = this.cellToString(cell.value);
        });
      } else {
        // Data row — build array aligned to headers length
        const rowData: RawRow = new Array(headers.length).fill(null);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber - 1 < headers.length) {
            rowData[colNumber - 1] = this.normalizeCellValue(cell.value);
          }
        });
        rows.push(rowData);
      }
    });

    return { headers, rows, sheetNames };
  }

  /**
   * Auto-maps spreadsheet headers to inventory fields using exact and fuzzy matching.
   */
  autoMapColumns(headers: string[]): ColumnMapping[] {
    const usedFields = new Set<keyof CreateInventoryItem>();

    return headers.map((header, index) => {
      const normalized = header.toLowerCase().trim();

      // Try exact match first
      for (const [field, aliases] of Object.entries(EXACT_HEADER_MAP)) {
        const typedField = field as keyof CreateInventoryItem;
        if (typedField === 'status') continue; // never map status on import
        if (usedFields.has(typedField)) continue;
        if (aliases.includes(normalized)) {
          usedFields.add(typedField);
          return {
            sourceIndex: index,
            sourceHeader: header,
            targetField: typedField,
            confidence: 'exact' as const,
          };
        }
      }

      // Try fuzzy match
      const fuzzyField = FUZZY_HEADER_MAP[normalized];
      if (fuzzyField && !usedFields.has(fuzzyField)) {
        usedFields.add(fuzzyField);
        return {
          sourceIndex: index,
          sourceHeader: header,
          targetField: fuzzyField,
          confidence: 'fuzzy' as const,
        };
      }

      // Unmapped
      return {
        sourceIndex: index,
        sourceHeader: header,
        targetField: null,
        confidence: 'unmapped' as const,
      };
    });
  }

  /**
   * Validates each row against inventory field constraints using the given column mapping.
   */
  validateRows(rows: RawRow[], mapping: ColumnMapping[]): ValidatedRow[] {
    return rows.map((row, index) => {
      const data: Partial<CreateInventoryItem> = {};
      const errors: FieldError[] = [];

      for (const col of mapping) {
        if (!col.targetField) continue;

        const rawValue = row[col.sourceIndex];
        this.applyFieldValue(col.targetField, rawValue, data, errors);
      }

      // Required field check: card_name
      if (!data.card_name || data.card_name.trim().length === 0) {
        errors.push({ field: 'card_name', message: 'Card Name is required.' });
      }

      // Grade without grading_company check
      if (data.grade != null && !data.grading_company) {
        errors.push({
          field: 'grade',
          message: 'Grade requires a Grading Company to be specified.',
        });
      }

      // Default language
      if (!data.language) {
        data.language = 'English';
      }

      // Default condition
      if (!data.condition) {
        data.condition = 'near_mint';
      }

      // Status is always 'available' on import
      data.status = 'available';

      return {
        rowNumber: index + 2, // +2 because row 1 is headers, index is 0-based
        data,
        errors,
        valid: errors.length === 0,
        skipped: false,
      };
    });
  }

  /**
   * Strips `$`, commas, whitespace and parses to a float.
   * Returns `null` if the value is unparseable.
   */
  parsePrice(value: string | number | boolean | null | undefined): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return value >= 0 ? value : null;

    const cleaned = String(value).replace(/[$,\s]/g, '');
    if (cleaned === '') return null;

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed) || parsed < 0) return null;

    return parsed;
  }

  /**
   * Maps common abbreviations and full names to a valid Condition enum value.
   * Returns `null` if the value cannot be matched.
   */
  parseCondition(value: string | null | undefined): Condition | null {
    if (value == null) return null;
    const normalized = String(value).toLowerCase().trim();
    if (normalized === '') return null;
    return CONDITION_ALIAS_MAP[normalized] ?? null;
  }

  /**
   * Parses a boolean foil value from various truthy/falsy representations.
   */
  parseFoil(value: string | number | boolean | null | undefined): boolean {
    if (value == null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    return TRUTHY_FOIL_VALUES.has(String(value).toLowerCase().trim());
  }

  /**
   * Parses a grading company value (case-insensitive).
   * Returns `null` if the value is not a recognized grading company.
   */
  parseGradingCompany(value: string | null | undefined): GradingCompany | null {
    if (value == null) return null;
    const normalized = String(value).toLowerCase().trim();
    if (normalized === '') return null;
    return VALID_GRADING_COMPANIES.includes(normalized as GradingCompany)
      ? (normalized as GradingCompany)
      : null;
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Applies a single field value from a raw cell to the data object,
   * adding errors for invalid values.
   */
  private applyFieldValue(
    field: keyof CreateInventoryItem,
    rawValue: string | number | boolean | null,
    data: Partial<CreateInventoryItem>,
    errors: FieldError[],
  ): void {
    const strVal = rawValue != null ? String(rawValue).trim() : '';

    switch (field) {
      case 'card_name':
        if (strVal.length > 200) {
          errors.push({
            field: 'card_name',
            message: 'Card Name must be 200 characters or fewer.',
          });
        }
        data.card_name = strVal;
        break;

      case 'set_name':
      case 'set_code':
      case 'card_number':
      case 'rarity':
      case 'notes':
        if (strVal) {
          data[field] = strVal;
        }
        break;

      case 'language':
        if (strVal) {
          data.language = strVal;
        }
        break;

      case 'condition': {
        if (strVal) {
          const condition = this.parseCondition(strVal);
          if (condition) {
            data.condition = condition;
          } else {
            errors.push({
              field: 'condition',
              message: `Invalid condition: "${strVal}". Expected values like NM, LP, Mint, Near Mint, etc.`,
            });
          }
        }
        break;
      }

      case 'grading_company': {
        if (strVal) {
          const company = this.parseGradingCompany(strVal);
          if (company) {
            data.grading_company = company;
          } else {
            errors.push({
              field: 'grading_company',
              message: `Invalid grading company: "${strVal}". Expected PSA, CGC, BGS, SGC, or ACE.`,
            });
          }
        }
        break;
      }

      case 'grade': {
        if (strVal) {
          const grade = parseFloat(strVal);
          if (isNaN(grade) || grade < 0 || grade > 10) {
            errors.push({
              field: 'grade',
              message: `Invalid grade: "${strVal}". Must be a number between 0 and 10.`,
            });
          } else {
            data.grade = grade;
          }
        }
        break;
      }

      case 'purchase_price': {
        if (strVal) {
          const price = this.parsePrice(rawValue);
          if (price == null) {
            errors.push({
              field: 'purchase_price',
              message: `Invalid purchase price: "${strVal}".`,
            });
          } else {
            data.purchase_price = price;
          }
        }
        break;
      }

      case 'selling_price': {
        if (strVal) {
          const price = this.parsePrice(rawValue);
          if (price == null) {
            errors.push({
              field: 'selling_price',
              message: `Invalid selling price: "${strVal}".`,
            });
          } else {
            data.selling_price = price;
          }
        }
        break;
      }

      case 'is_foil':
        data.is_foil = this.parseFoil(rawValue);
        break;

      case 'status':
        // Status is always set to 'available' — ignore any mapped value
        break;
    }
  }

  /**
   * Parses CSV text content into a ParsedSpreadsheet without requiring Node.js streams.
   * Handles quoted fields and escaped quotes.
   */
  private parseCSVText(text: string): ParsedSpreadsheet {
    const lines = this.splitCSVLines(text);
    if (lines.length === 0) {
      throw new Error('The file contains no data.');
    }

    const headers = this.parseCSVLine(lines[0]);
    const rows: RawRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue; // skip empty lines
      const values = this.parseCSVLine(lines[i]);
      // Pad or trim to match headers length
      const row: RawRow = new Array(headers.length).fill(null);
      for (let j = 0; j < headers.length; j++) {
        if (j < values.length && values[j] !== '') {
          // Try to parse as number
          const num = Number(values[j]);
          row[j] = !isNaN(num) && values[j].trim() !== '' ? num : values[j];
        }
      }
      rows.push(row);
    }

    return { headers, rows, sheetNames: ['Sheet1'] };
  }

  /**
   * Splits CSV text into lines, respecting quoted fields that contain newlines.
   */
  private splitCSVLines(text: string): string[] {
    const lines: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') i++; // skip \r\n
        lines.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current.length > 0) {
      lines.push(current);
    }
    return lines;
  }

  /**
   * Parses a single CSV line into an array of string values.
   * Handles quoted fields and escaped quotes (doubled quotes).
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    values.push(current);
    return values;
  }

  /**
   * Reads a File into an ArrayBuffer, using FileReader for environment compatibility.
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Converts a CellValue to a plain string for use as a header name.
   */
  private cellToString(value: CellValue): string {
    if (value == null) return '';
    if (typeof value === 'object' && 'text' in value) {
      return String(value.text);
    }
    return String(value);
  }

  /**
   * Normalizes an ExcelJS CellValue to a simple JS primitive.
   */
  private normalizeCellValue(value: CellValue): string | number | boolean | null {
    if (value == null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      if ('text' in value) return String(value.text);
      if ('result' in value && value.result != null) {
        return typeof value.result === 'object'
          ? String(value.result)
          : (value.result as string | number | boolean);
      }
      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map(rt => rt.text).join('');
      }
    }
    return String(value);
  }
}
