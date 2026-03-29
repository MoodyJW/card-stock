import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from './export.service';
import { InventoryItem } from '../models/inventory.model';

describe('ExportService', () => {
  let service: ExportService;

  const mockItem: InventoryItem = {
    id: '1',
    organization_id: 'org-1',
    card_name: 'Charizard',
    set_name: 'Base Set',
    set_code: 'BS',
    card_number: '4/102',
    rarity: 'Rare Holo',
    language: 'English',
    is_foil: true,
    condition: 'near_mint',
    grading_company: 'psa',
    grade: 9,
    purchase_price: 50.0,
    selling_price: 150.0,
    status: 'available',
    notes: 'Classic card',
    created_at: '2023-01-01T12:00:00Z',
    created_by: 'user-1',
    updated_at: '2023-01-01T12:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExportService],
    });
    service = TestBed.inject(ExportService);

    // Mock global DOM APIs for download triggers
    vi.spyOn(globalThis.URL, 'createObjectURL').mockReturnValue('blob:url');
    vi.spyOn(globalThis.URL, 'revokeObjectURL').mockImplementation(() => undefined);

    // Custom document.createElement spy
    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const mockAnchor = {
          href: '',
          download: '',
          click: vi.fn(),
        } as unknown as HTMLAnchorElement;
        return mockAnchor;
      }
      return document.createElement(tagName);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should export CSV and trigger download', async () => {
    await service.exportCsv([mockItem], 'test-shop');

    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    const createElementCalls = (document.createElement as ReturnType<typeof vi.fn>).mock.calls;
    expect(createElementCalls.some(call => call[0] === 'a')).toBe(true);
  });

  it('should format foil and condition fields correctly', async () => {
    const foilMockItem = {
      ...mockItem,
      is_foil: true,
      condition: 'moderately_played' as InventoryItem['condition'],
    };

    // We can spy on downloadBlob to read the buffer indirectly,
    // but the easiest way is to mock downloadBlob and check its arguments.
    // However, downloadBlob is private. We can cast service to any.
    const downloadSpy = vi
      .spyOn(
        service as unknown as { downloadBlob: (b: BlobPart, f: string, m: string) => void },
        'downloadBlob',
      )
      .mockImplementation(() => undefined);

    await service.exportCsv([foilMockItem], 'test-shop');

    const buffer = downloadSpy.mock.calls[0][0];
    const csvContent = (buffer as unknown as { toString: () => string }).toString();

    expect(csvContent).toContain('Yes'); // Foil transformed from true to Yes
    expect(csvContent).toContain('Moderately Played'); // Condition transformed from moderately_played
  });

  it('should export Excel (XLSX) and trigger download', async () => {
    const downloadSpy = vi
      .spyOn(
        service as unknown as { downloadBlob: (b: BlobPart, f: string, m: string) => void },
        'downloadBlob',
      )
      .mockImplementation(() => undefined);

    await service.exportExcel([mockItem], 'test-shop');

    expect(downloadSpy).toHaveBeenCalled();
    const args = downloadSpy.mock.calls[0];
    expect(args[1]).toMatch(/^test-shop-inventory-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(args[2]).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
