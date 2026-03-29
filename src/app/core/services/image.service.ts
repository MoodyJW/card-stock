import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ShopContextService } from './shop-context.service';
import { NotificationService } from './notification.service';
import { ImageCompressionService } from './image-compression.service';
import { InventoryImage } from '../models/image.model';

@Injectable({
  providedIn: 'root',
})
export class ImageService {
  private supabase = inject(SupabaseService).client;
  private shopContext = inject(ShopContextService);
  private notify = inject(NotificationService);
  private compression = inject(ImageCompressionService);

  private readonly BUCKET_NAME = 'card-images';

  async uploadImage(
    inventoryId: string,
    file: File,
    isPrimary: boolean,
  ): Promise<InventoryImage | null> {
    const orgId = this.shopContext.currentShopId() || this.shopContext.currentShop()?.id;
    if (!orgId) {
      this.notify.error('No shop context found');
      return null;
    }

    // 1. Compress image
    let compressedBlob: Blob;
    try {
      compressedBlob = await this.compression.compressImage(file);
    } catch (err) {
      this.notify.error('Failed to compress image');
      console.error(err);
      return null;
    }

    // 2. Generate storage path and upload
    const uuid = crypto.randomUUID();
    const storagePath = `${orgId}/${inventoryId}/${uuid}.webp`;

    const { error: uploadError } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .upload(storagePath, compressedBlob, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      this.notify.error('Failed to upload image to storage');
      console.error(uploadError);
      return null;
    }

    // 3. Create DB record
    const { data: record, error: dbError } = await this.supabase
      .from('inventory_images')
      .insert({
        inventory_id: inventoryId,
        organization_id: orgId,
        storage_path: storagePath,
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (dbError) {
      this.notify.error('Failed to save image record');
      console.error(dbError);
      // Rollback: try to clean up the orphaned uploaded file
      await this.supabase.storage.from(this.BUCKET_NAME).remove([storagePath]);
      return null;
    }

    return record as InventoryImage;
  }

  async deleteImage(image: InventoryImage): Promise<boolean> {
    // 1. Delete from storage
    const { error: storageError } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .remove([image.storage_path]);

    if (storageError) {
      this.notify.error('Failed to remove image from storage');
      console.error(storageError);
      return false;
    }

    // 2. Delete from DB (technically if we wanted to be super safe we could rely on CASCADE
    // but the DB record is the source of truth for the app UI, so we delete it)
    const { error: dbError } = await this.supabase
      .from('inventory_images')
      .delete()
      .eq('id', image.id);

    if (dbError) {
      this.notify.error('Failed to remove image record');
      console.error(dbError);
      return false;
    }

    return true;
  }

  async getImages(inventoryId: string): Promise<InventoryImage[]> {
    const { data, error } = await this.supabase
      .from('inventory_images')
      .select('*')
      .eq('inventory_id', inventoryId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      this.notify.error('Failed to fetch images');
      console.error(error);
      return [];
    }
    return data as InventoryImage[];
  }

  getPublicUrl(storagePath: string): string {
    const { data } = this.supabase.storage.from(this.BUCKET_NAME).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  async setAsPrimary(imageId: string, inventoryId: string): Promise<boolean> {
    const { error } = await this.supabase.rpc('set_primary_image', {
      p_image_id: imageId,
      p_inventory_id: inventoryId,
    });

    if (error) {
      this.notify.error('Failed to update primary image');
      console.error(error);
      return false;
    }
    return true;
  }

  async getImageCount(inventoryId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('inventory_images')
      .select('*', { count: 'exact', head: true })
      .eq('inventory_id', inventoryId);

    if (error) {
      console.error('Failed to get image count', error);
      return 0;
    }
    return count || 0;
  }
}
