import { Injectable } from '@angular/core';
import { Workbook } from 'exceljs';
import { InventoryItem } from '../models/inventory.model';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  /**
   * Generates and downloads a CSV file containing the inventory items.
   */
  async exportCsv(items: InventoryItem[], shopSlug: string): Promise<void> {
    const workbook = new Workbook();
    this.populateWorksheet(workbook, items);

    const buffer = await workbook.csv.writeBuffer();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${shopSlug}-inventory-${dateStr}.csv`;

    this.downloadBlob(buffer, filename, 'text/csv;charset=utf-8;');
  }

  /**
   * Generates and downloads an Excel file containing the inventory items.
   */
  async exportExcel(items: InventoryItem[], shopSlug: string): Promise<void> {
    const workbook = new Workbook();
    const worksheet = this.populateWorksheet(workbook, items);

    // Style headers for Excel
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Auto-size columns based on header text length (approximate)
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell!({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    // Format price columns as currency numbers in Excel
    const purchaseCol = worksheet.getColumn('purchase_price');
    const sellingCol = worksheet.getColumn('selling_price');
    purchaseCol.numFmt = '#,##0.00';
    sellingCol.numFmt = '#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${shopSlug}-inventory-${dateStr}.xlsx`;

    this.downloadBlob(
      buffer,
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }

  /**
   * Helper to populate an ExcelJS worksheet with inventory data.
   */
  private populateWorksheet(workbook: Workbook, items: InventoryItem[]) {
    const worksheet = workbook.addWorksheet('Inventory');

    worksheet.columns = [
      { header: 'Card Name', key: 'card_name' },
      { header: 'Set Name', key: 'set_name' },
      { header: 'Set Code', key: 'set_code' },
      { header: 'Card Number', key: 'card_number' },
      { header: 'Rarity', key: 'rarity' },
      { header: 'Language', key: 'language' },
      { header: 'Foil', key: 'is_foil' },
      { header: 'Condition', key: 'condition' },
      { header: 'Grading Company', key: 'grading_company' },
      { header: 'Grade', key: 'grade' },
      { header: 'Purchase Price', key: 'purchase_price' },
      { header: 'Selling Price', key: 'selling_price' },
      { header: 'Status', key: 'status' },
      { header: 'Notes', key: 'notes' },
      { header: 'Date Added', key: 'created_at' },
    ];

    for (const item of items) {
      worksheet.addRow({
        card_name: item.card_name,
        set_name: item.set_name,
        set_code: item.set_code,
        card_number: item.card_number,
        rarity: item.rarity,
        language: item.language,
        is_foil: item.is_foil ? 'Yes' : 'No',
        condition: this.formatCondition(item.condition),
        grading_company: item.grading_company,
        grade: item.grade,
        purchase_price: item.purchase_price,
        selling_price: item.selling_price,
        status: item.status,
        notes: item.notes,
        created_at: new Date(item.created_at).toLocaleDateString(),
      });
    }

    return worksheet;
  }

  /**
   * Formats a raw condition value into a human-readable label.
   */
  private formatCondition(condition: string): string {
    const labels: Record<string, string> = {
      near_mint: 'Near Mint',
      lightly_played: 'Lightly Played',
      moderately_played: 'Moderately Played',
      heavily_played: 'Heavily Played',
      damaged: 'Damaged',
    };
    return labels[condition] ?? condition;
  }

  /**
   * Helper to trigger a browser file download from an ArrayBuffer.
   */
  private downloadBlob(buffer: BlobPart, filename: string, mimeType: string) {
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // Required for Firefox
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
