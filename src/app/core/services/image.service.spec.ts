/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { ImageService } from './image.service';
import { SupabaseService } from './supabase.service';
import { ShopContextService } from './shop-context.service';
import { NotificationService } from './notification.service';
import { ImageCompressionService } from './image-compression.service';
import { vi } from 'vitest';

describe('ImageService', () => {
  let service: ImageService;
  let mockSupabase: any;
  let mockShopContext: any;
  let mockNotify: any;
  let mockCompression: any;

  beforeEach(() => {
    const mockStorageFrom = {
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://test.com/image.webp' } }),
    };

    const countBuilder = {
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    };

    const mockDbFrom = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'img-1' }, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }),
      select: vi.fn().mockImplementation((fields: string, opts?: any) => {
        if (opts && opts.count === 'exact') {
          return countBuilder;
        }
        return {
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }),
    };

    mockSupabase = {
      client: {
        storage: {
          from: vi.fn().mockReturnValue(mockStorageFrom),
        },
        from: vi.fn().mockReturnValue(mockDbFrom),
        rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    };

    mockShopContext = {
      currentShopId: vi.fn().mockReturnValue('org-1'),
      currentShop: vi.fn().mockReturnValue({ id: 'org-1' }),
    };

    mockNotify = {
      success: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockCompression = {
      compressImage: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/webp' })),
    };

    TestBed.configureTestingModule({
      providers: [
        ImageService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ShopContextService, useValue: mockShopContext },
        { provide: NotificationService, useValue: mockNotify },
        { provide: ImageCompressionService, useValue: mockCompression },
      ],
    });
    service = TestBed.inject(ImageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('uploadImage', () => {
    it('should compress and upload image successfully', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = await service.uploadImage('inv-1', file, true);

      expect(mockCompression.compressImage).toHaveBeenCalledWith(file);
      expect(mockSupabase.client.storage.from).toHaveBeenCalledWith('card-images');
      expect(result).toEqual({ id: 'img-1' } as any);
    });

    it('should return null and warn if orgId is missing', async () => {
      mockShopContext.currentShopId.mockReturnValue(null);
      mockShopContext.currentShop.mockReturnValue(null);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = await service.uploadImage('inv-1', file, true);

      expect(mockNotify.error).toHaveBeenCalledWith('No shop context found');
      expect(result).toBeNull();
    });
  });

  describe('deleteImage', () => {
    it('should remove image from storage and db', async () => {
      const image = { id: 'img-1', storage_path: 'org-1/inv-1/123.webp' } as any;
      const result = await service.deleteImage(image);

      expect(mockSupabase.client.storage.from('card-images').remove).toHaveBeenCalledWith([
        image.storage_path,
      ]);
      expect(result).toBe(true);
    });
  });

  describe('getImages', () => {
    it('should query inventory_images with correct ordering', async () => {
      await service.getImages('inv-1');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('inventory_images');
    });
  });

  describe('getPublicUrl', () => {
    it('should return the public generated URL string', () => {
      const url = service.getPublicUrl('path/to/img.webp');
      expect(url).toBe('http://test.com/image.webp');
    });
  });

  describe('setAsPrimary', () => {
    it('should call set_primary_image RPC', async () => {
      const result = await service.setAsPrimary('img-1', 'inv-1');
      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('set_primary_image', {
        p_image_id: 'img-1',
        p_inventory_id: 'inv-1',
      });
      expect(result).toBe(true);
    });
  });

  describe('getImageCount', () => {
    it('should return the count from db exact query', async () => {
      const result = await service.getImageCount('inv-1');
      expect(result).toBe(2);
    });
  });
});
