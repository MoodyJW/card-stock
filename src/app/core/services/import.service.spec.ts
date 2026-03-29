import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportService } from './import.service';
import { SupabaseService } from './supabase.service';
import { ValidatedRow } from '../models/import.model';
import { signal } from '@angular/core';

describe('ImportService', () => {
  let service: ImportService;
  let insertMock: ReturnType<typeof vi.fn>;

  const mockValidRows: ValidatedRow[] = [
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
  ];

  const mockSkippedRow: ValidatedRow = {
    rowNumber: 4,
    data: { card_name: 'Blastoise' },
    errors: [],
    valid: true,
    skipped: true,
  };

  const mockInvalidRow: ValidatedRow = {
    rowNumber: 5,
    data: {},
    errors: [{ field: 'card_name', message: 'Card Name is required.' }],
    valid: false,
    skipped: false,
  };

  beforeEach(() => {
    insertMock = vi.fn().mockResolvedValue({ error: null });

    const supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue({
          insert: insertMock,
        }),
      },
      user: signal({ id: 'user-1' }),
    };

    TestBed.configureTestingModule({
      providers: [ImportService, { provide: SupabaseService, useValue: supabaseMock }],
    });

    service = TestBed.inject(ImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should filter out skipped and invalid rows', async () => {
    const rows = [...mockValidRows, mockSkippedRow, mockInvalidRow];

    const result = await service.importCards(rows, 'org-1', 'user-1');

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(2); // 1 skipped + 1 invalid
    expect(result.failed).toBe(0);
  });

  it('should set organization_id and created_by on each row', async () => {
    await service.importCards(mockValidRows, 'org-1', 'user-1');

    const insertedPayload = insertMock.mock.calls[0][0];
    expect(insertedPayload[0].organization_id).toBe('org-1');
    expect(insertedPayload[0].created_by).toBe('user-1');
    expect(insertedPayload[1].organization_id).toBe('org-1');
    expect(insertedPayload[1].created_by).toBe('user-1');
  });

  it('should set status to available on each row', async () => {
    await service.importCards(mockValidRows, 'org-1', 'user-1');

    const insertedPayload = insertMock.mock.calls[0][0];
    expect(insertedPayload[0].status).toBe('available');
    expect(insertedPayload[1].status).toBe('available');
  });

  it('should insert in batches of 50', async () => {
    // Create 120 valid rows
    const manyRows: ValidatedRow[] = Array.from({ length: 120 }, (_, i) => ({
      rowNumber: i + 2,
      data: { card_name: `Card ${i}`, condition: 'near_mint' },
      errors: [],
      valid: true,
      skipped: false,
    }));

    await service.importCards(manyRows, 'org-1', 'user-1');

    // Should have been called 3 times: 50 + 50 + 20
    expect(insertMock).toHaveBeenCalledTimes(3);
    expect(insertMock.mock.calls[0][0].length).toBe(50);
    expect(insertMock.mock.calls[1][0].length).toBe(50);
    expect(insertMock.mock.calls[2][0].length).toBe(20);
  });

  it('should track progress signal correctly', async () => {
    const progressValues: ({ current: number; total: number } | null)[] = [];

    // Record progress values
    const originalSet = service.importProgress.set.bind(service.importProgress);
    vi.spyOn(service.importProgress, 'set').mockImplementation(val => {
      progressValues.push(val);
      originalSet(val);
    });

    await service.importCards(mockValidRows, 'org-1', 'user-1');

    // Should start at 0, then update, then reset to null
    expect(progressValues[0]).toEqual({ current: 0, total: 2 });
    // After batch completes
    expect(progressValues.some(p => p !== null && p.current > 0)).toBe(true);
    // Ends with null
    expect(progressValues[progressValues.length - 1]).toBeNull();
  });

  it('should handle partial batch failure', async () => {
    // Create 70 rows: first batch succeeds, second fails
    const rows: ValidatedRow[] = Array.from({ length: 70 }, (_, i) => ({
      rowNumber: i + 2,
      data: { card_name: `Card ${i}`, condition: 'near_mint' },
      errors: [],
      valid: true,
      skipped: false,
    }));

    insertMock
      .mockResolvedValueOnce({ error: null }) // first batch succeeds
      .mockResolvedValueOnce({ error: { message: 'Database error' } }); // second batch fails

    const result = await service.importCards(rows, 'org-1', 'user-1');

    expect(result.imported).toBe(50);
    expect(result.failed).toBe(20);
    expect(result.errors.length).toBe(20);
    expect(result.errors[0].message).toBe('Database error');
  });

  it('should return complete ImportResult', async () => {
    const rows = [...mockValidRows, mockSkippedRow, mockInvalidRow];

    const result = await service.importCards(rows, 'org-1', 'user-1');

    expect(result.totalRows).toBe(4);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('should return early with zero imports when all rows are skipped/invalid', async () => {
    const rows = [mockSkippedRow, mockInvalidRow];

    const result = await service.importCards(rows, 'org-1', 'user-1');

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(2);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('should handle network errors gracefully', async () => {
    insertMock.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await service.importCards(mockValidRows, 'org-1', 'user-1');

    expect(result.failed).toBe(2);
    expect(result.imported).toBe(0);
    expect(result.errors[0].message).toBe('Network timeout');
  });
});
