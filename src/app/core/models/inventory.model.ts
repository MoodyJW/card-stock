export type Condition =
  | 'mint'
  | 'near_mint'
  | 'lightly_played'
  | 'moderately_played'
  | 'heavily_played'
  | 'damaged';

export type GradingCompany = 'psa' | 'cgc' | 'bgs' | 'sgc' | 'ace';

export type InventoryStatus = 'available' | 'reserved' | 'sold';

export interface InventoryItem {
  id: string;
  organization_id: string;
  card_name: string;
  set_name?: string;
  set_code?: string;
  card_number?: string;
  rarity?: string;
  language: string;
  is_foil: boolean;
  condition: Condition;
  grading_company?: GradingCompany;
  grade?: number;
  purchase_price?: number;
  selling_price?: number;
  status: InventoryStatus;
  notes?: string;
  reserved_by_name?: string;
  reserved_by_email?: string;
  reserved_by_phone?: string;
  reservation_notes?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
  deleted_at?: string;
}

export interface InventoryImageRelation {
  id: string;
  storage_path: string;
  is_primary: boolean;
}

export interface InventoryItemWithImages extends InventoryItem {
  images?: InventoryImageRelation[];
}

export interface CreateInventoryItem {
  card_name: string;
  set_name?: string;
  set_code?: string;
  card_number?: string;
  rarity?: string;
  language?: string;
  is_foil?: boolean;
  condition?: Condition;
  grading_company?: GradingCompany;
  grade?: number;
  purchase_price?: number;
  selling_price?: number;
  status?: InventoryStatus;
  notes?: string;
}

export interface InventoryFilters {
  search?: string;
  status?: InventoryStatus | null;
  condition?: Condition | null;
  set_name?: string | null;
}

export interface ReserveCardParams {
  inventory_id: string;
  reserved_by_name: string;
  reserved_by_email?: string;
  reserved_by_phone?: string;
  reservation_notes?: string;
}

export interface MarkSoldParams {
  inventory_id: string;
  sold_price: number;
  buyer_email?: string;
  buyer_notes?: string;
}

export interface Transaction {
  id: string;
  organization_id: string;
  inventory_id: string;
  sold_price: number;
  sold_at: string;
  sold_by?: string;
  buyer_email?: string;
  buyer_notes?: string;
  created_at: string;
}
