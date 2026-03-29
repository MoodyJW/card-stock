import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ValidatedRow, ImportResult } from '../models/import.model';

const BATCH_SIZE = 50;

@Injectable({
  providedIn: 'root',
})
export class ImportService {
  private readonly supabase = inject(SupabaseService);

  /** Tracks import progress; null when idle. */
  readonly importProgress = signal<{ current: number; total: number } | null>(null);

  /**
   * Imports validated rows into the inventory table in batches.
   * Only valid, non-skipped rows are inserted.
   * Continues on batch failure, tracking errors for partial success.
   */
  async importCards(
    rows: ValidatedRow[],
    orgId: string,
    userId: string | undefined,
  ): Promise<ImportResult> {
    const importableRows = rows.filter(r => r.valid && !r.skipped);
    const skippedCount = rows.filter(r => r.skipped).length;
    const invalidCount = rows.filter(r => !r.valid && !r.skipped).length;

    const result: ImportResult = {
      totalRows: rows.length,
      imported: 0,
      skipped: skippedCount + invalidCount,
      failed: 0,
      errors: [],
    };

    if (importableRows.length === 0) {
      this.importProgress.set(null);
      return result;
    }

    this.importProgress.set({ current: 0, total: importableRows.length });

    // Process in batches
    for (let i = 0; i < importableRows.length; i += BATCH_SIZE) {
      const batch = importableRows.slice(i, i + BATCH_SIZE);

      const insertPayload = batch.map(row => ({
        ...row.data,
        organization_id: orgId,
        created_by: userId,
        status: 'available' as const,
      }));

      try {
        const { error } = await this.supabase.client.from('inventory').insert(insertPayload);

        if (error) {
          // Entire batch failed
          result.failed += batch.length;
          for (const row of batch) {
            result.errors.push({
              rowNumber: row.rowNumber,
              message: error.message || 'Insert failed',
            });
          }
        } else {
          result.imported += batch.length;
        }
      } catch (err) {
        // Network or unexpected error — batch failed
        result.failed += batch.length;
        const message = err instanceof Error ? err.message : 'Unexpected error';
        for (const row of batch) {
          result.errors.push({ rowNumber: row.rowNumber, message });
        }
      }

      this.importProgress.set({
        current: Math.min(i + BATCH_SIZE, importableRows.length),
        total: importableRows.length,
      });
    }

    this.importProgress.set(null);
    return result;
  }
}
