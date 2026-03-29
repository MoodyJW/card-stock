export interface InventoryImage {
  id: string;
  inventory_id: string;
  organization_id: string;
  storage_path: string;
  is_primary: boolean;
  created_by?: string;
  created_at: string;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg';
}
