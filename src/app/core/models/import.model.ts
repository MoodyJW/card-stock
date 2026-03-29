import { CreateInventoryItem } from './inventory.model';

export interface ParsedSpreadsheet {
  headers: string[];
  rows: RawRow[];
  sheetNames: string[];
}

export type RawRow = (string | number | boolean | null)[];

export interface ColumnMapping {
  sourceIndex: number;
  sourceHeader: string;
  targetField: keyof CreateInventoryItem | null;
  confidence: 'exact' | 'fuzzy' | 'unmapped';
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidatedRow {
  rowNumber: number;
  data: Partial<CreateInventoryItem>;
  errors: FieldError[];
  valid: boolean;
  skipped: boolean;
}

export interface ImportResult {
  totalRows: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: { rowNumber: number; message: string }[];
}
