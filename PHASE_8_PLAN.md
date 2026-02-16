# Phase 8: Card Images

> Broken into PR-sized work items. Each section is an independent, mergeable unit.
> Depends on: Phase 6 complete (inventory service, card form dialog, inventory list/grid).

---

## Architecture Decisions (applies to all tickets)

- **Storage:** Supabase Storage with client-side compression before upload
- **Compression:** Resize to max 1200px on longest edge, convert to WebP (fallback JPEG), target ~150–200 KB per image using `OffscreenCanvas` or `<canvas>`
- **Limit:** Up to 2 images per card (front + back)
- **Camera support:** `accept="image/*" capture="environment"` on file input for mobile camera access
- **UX:** Quick upload in the Add/Edit Card dialog (1–2 images) + full gallery on a card detail page for viewing/managing
- **Storage path convention:** `{organization_id}/{inventory_id}/{uuid}.webp`
- **Bucket:** `card-images` with RLS policies tied to organization membership
- **Primary image:** First uploaded image is `is_primary = true`, shown as thumbnail in table/grid views
- **Existing schema:** `inventory_images` table already exists from Phase 2 with `storage_path`, `is_primary`, `organization_id`, `inventory_id`, `created_by`

### Storage Budget (Supabase Free Tier: 1 GB)

| Scenario | Images | Avg Size | Total Storage |
|----------|--------|----------|---------------|
| 500 cards, 1 image each | 500 | 200 KB | ~100 MB |
| 500 cards, 2 images each | 1,000 | 200 KB | ~200 MB |
| 2,000 cards, 1 image each | 2,000 | 200 KB | ~400 MB |
| 2,000 cards, 2 images each | 4,000 | 200 KB | ~800 MB |

With compression, you can store 2,500–5,000 images within the 1 GB free tier.

---

## Ticket 1: Storage Bucket Setup & Image Service

**Branch:** `feat/phase-8.1-image-service`

### Summary
Create the Supabase storage bucket with RLS policies, build the image compression utility, and create the `ImageService` for upload/delete/fetch operations.

### Tasks

1. **Create migration** — `supabase/migrations/YYYYMMDD_card_images_bucket.sql`
   - Create storage bucket via Supabase SQL:
     ```sql
     INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
     VALUES (
       'card-images',
       'card-images',
       true,  -- public read (images served via public URL, no auth needed for viewing)
       2097152,  -- 2 MB max per file (after compression, should be well under)
       ARRAY['image/webp', 'image/jpeg', 'image/png']
     );
     ```
   - Storage RLS policies:
     ```sql
     -- Members can upload to their org's folder
     CREATE POLICY "Members upload" ON storage.objects FOR INSERT
       WITH CHECK (
         bucket_id = 'card-images'
         AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_org_ids())
       );

     -- Members can view their org's images
     CREATE POLICY "Members view" ON storage.objects FOR SELECT
       USING (
         bucket_id = 'card-images'
         AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_org_ids())
       );

     -- Uploaders or admins can delete
     CREATE POLICY "Uploader or admin delete" ON storage.objects FOR DELETE
       USING (
         bucket_id = 'card-images'
         AND (
           owner = auth.uid()
           OR is_org_admin_or_owner((storage.foldername(name))[1]::uuid)
         )
       );
     ```
   - Note: bucket is `public: true` so images can be displayed via public URL without auth tokens (simpler `<img>` tags). RLS still controls who can upload/delete.

2. **Create `ImageCompressionService`** in `src/app/core/services/image-compression.service.ts`
   - Injectable, `providedIn: 'root'`

   **Methods:**

   - `async compressImage(file: File, options?: CompressionOptions): Promise<Blob>`
     - Default options: `{ maxWidth: 1200, maxHeight: 1200, quality: 0.8, format: 'webp' }`
     - Uses `createImageBitmap()` for decoding (works in web workers too)
     - Draws to `OffscreenCanvas` (or `<canvas>` fallback) at target dimensions
     - Converts to WebP via `canvas.convertToBlob({ type: 'image/webp', quality })`
     - Falls back to JPEG if WebP not supported: `canvas.convertToBlob({ type: 'image/jpeg', quality })`
     - Returns compressed Blob

   - `async getImageDimensions(file: File): Promise<{ width: number, height: number }>`
     - Uses `createImageBitmap()` to read dimensions without loading full image

   - `calculateTargetSize(width: number, height: number, maxWidth: number, maxHeight: number): { width: number, height: number }`
     - Maintains aspect ratio
     - Only downscales, never upscales

3. **Create `ImageService`** in `src/app/core/services/image.service.ts`
   - Injectable, `providedIn: 'root'`
   - Injects: `SupabaseService`, `ShopContextService`, `ImageCompressionService`, `NotificationService`

   **Methods:**

   - `async uploadImage(inventoryId: string, file: File, isPrimary: boolean): Promise<InventoryImage | null>`
     - Compress the image via `ImageCompressionService`
     - Generate storage path: `{orgId}/{inventoryId}/{crypto.randomUUID()}.webp`
     - Upload to Supabase Storage: `supabase.storage.from('card-images').upload(path, blob)`
     - Insert row in `inventory_images` table with `storage_path`, `is_primary`, `organization_id`, `inventory_id`, `created_by`
     - Return the created `InventoryImage` record
     - On error: clean up uploaded file if DB insert fails, toast error

   - `async deleteImage(image: InventoryImage): Promise<boolean>`
     - Delete from storage: `supabase.storage.from('card-images').remove([image.storage_path])`
     - Delete from `inventory_images` table
     - On error: toast error, return false

   - `async getImages(inventoryId: string): Promise<InventoryImage[]>`
     - Query `inventory_images` table filtered by `inventory_id`, ordered by `is_primary DESC, created_at ASC`

   - `getPublicUrl(storagePath: string): string`
     - Returns `supabase.storage.from('card-images').getPublicUrl(storagePath).data.publicUrl`

   - `async setAsPrimary(imageId: string, inventoryId: string): Promise<void>`
     - Unset all `is_primary` for this `inventory_id`
     - Set `is_primary = true` for the target image
     - Both in a single transaction-like sequence

   - `async getImageCount(inventoryId: string): Promise<number>`
     - Returns count of images for a card (used to enforce 2-image limit)

4. **Create models** in `src/app/core/models/image.model.ts`
   ```typescript
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
     maxWidth?: number;   // default 1200
     maxHeight?: number;  // default 1200
     quality?: number;    // default 0.8, range 0-1
     format?: 'webp' | 'jpeg';  // default 'webp'
   }
   ```

5. **Unit tests** — `image.service.spec.ts` and `image-compression.service.spec.ts`
   - Test: `compressImage` returns a Blob smaller than input
   - Test: `compressImage` respects max dimensions
   - Test: `calculateTargetSize` maintains aspect ratio
   - Test: `uploadImage` calls storage upload then inserts DB row
   - Test: `uploadImage` cleans up storage on DB insert failure
   - Test: `deleteImage` removes from both storage and DB
   - Test: `getPublicUrl` returns correct URL format
   - Test: `setAsPrimary` unsets existing primary and sets new one
   - Test: upload rejected if image count already at limit (2)

### Files Created
```
supabase/migrations/YYYYMMDD_card_images_bucket.sql
src/app/core/models/image.model.ts
src/app/core/services/image-compression.service.ts
src/app/core/services/image-compression.service.spec.ts
src/app/core/services/image.service.ts
src/app/core/services/image.service.spec.ts
```

### Acceptance Criteria
- Storage bucket created with correct RLS policies
- Images compressed to ~150–200 KB before upload
- WebP format used (JPEG fallback)
- Upload creates both storage object and DB record
- Cleanup on partial failure (storage uploaded but DB insert fails)
- 2-image-per-card limit enforced
- Primary image tracked correctly
- Public URLs generated for display

---

## Ticket 2: Image Upload in Card Form Dialog

**Branch:** `feat/phase-8.2-dialog-upload`

### Summary
Add image upload capability to the existing Add/Edit Card dialog (from Phase 6 Ticket 4). Users can attach 1–2 images when adding or editing a card.

### Tasks

1. **Add image section to `CardFormDialogComponent`**
   - New section at the top of the form (before Card Identity):

     **Add mode:**
     - Two upload slots: "Front" and "Back" (optional)
     - Each slot shows a dashed border placeholder with camera/upload icon
     - Click → file input with `accept="image/*" capture="environment"`
     - After selection: show compressed image preview (thumbnail)
     - Remove button (X) to clear selection
     - Images uploaded after the card is created (on form submit)

     **Edit mode:**
     - Show existing images (fetched via `imageService.getImages()`)
     - Empty slots for remaining capacity (e.g., if 1 image exists, show 1 empty slot)
     - Existing images: show thumbnail with delete button
     - New images: show preview with remove button
     - Star icon to toggle primary image

2. **Upload flow on submit:**

   **Add mode:**
   ```typescript
   // 1. Create the card first
   const card = await this.inventoryService.addCard(formData);
   // 2. Upload images (if any selected)
   if (this.frontImage()) {
     await this.imageService.uploadImage(card.id, this.frontImage()!, true);
   }
   if (this.backImage()) {
     await this.imageService.uploadImage(card.id, this.backImage()!, !this.frontImage());
   }
   // 3. Close dialog
   ```

   **Edit mode:**
   - New images uploaded immediately when selected (card already exists)
   - Deletions happen immediately when delete button clicked
   - Confirm delete with a simple "Delete this image?" inline prompt

3. **Image preview component** — `src/app/shared/components/image-upload-slot/`
   - Standalone component, reused in dialog and detail page
   - Inputs: `image: InventoryImage | null`, `previewFile: File | null`, `isPrimary: boolean`, `label: string`
   - Outputs: `fileSelected: EventEmitter<File>`, `deleteClicked: EventEmitter<void>`, `primaryClicked: EventEmitter<void>`
   - Template:
     - Empty state: dashed border, camera icon, "Add {label}" text, click triggers file input
     - Preview state: image thumbnail, delete (X) button overlay, primary star overlay
     - Loading state: spinner overlay during upload

4. **Mobile camera support**
   - File input: `<input type="file" accept="image/*" capture="environment">`
   - `capture="environment"` opens rear camera on mobile
   - Falls back to standard file picker on desktop
   - Also accept gallery selection (the `accept="image/*"` allows both)

5. **Client-side validation before upload:**
   - File type: image/* only
   - Max raw file size: 10 MB (before compression)
   - Show toast if file too large or wrong type

6. **Unit tests** — update `card-form-dialog.component.spec.ts`
   - Test: image slots render in add mode (empty)
   - Test: image slots render in edit mode (with existing images)
   - Test: file selection shows preview
   - Test: removing a file clears the preview
   - Test: submit in add mode uploads images after card creation
   - Test: 2-image limit enforced (third slot not shown)

### Files Created
```
src/app/shared/components/image-upload-slot/
  image-upload-slot.component.ts
  image-upload-slot.component.html
  image-upload-slot.component.scss
  image-upload-slot.component.spec.ts
```

### Files Modified
```
src/app/features/shop/inventory/card-form-dialog/
  card-form-dialog.component.ts    (add image section logic)
  card-form-dialog.component.html  (add image section template)
  card-form-dialog.component.scss  (add image section styles)
  card-form-dialog.component.spec.ts (add image tests)
```

### Acceptance Criteria
- Add mode: select up to 2 images, uploaded after card creation
- Edit mode: view existing images, add new, delete existing
- Camera opens on mobile with rear camera default
- Gallery picker works on all platforms
- Preview thumbnails shown after selection
- Compression happens before upload (no raw files sent)
- 10 MB raw file limit enforced client-side
- 2-image limit enforced (slots hidden when full)
- Primary image toggleable
- Loading spinner during upload

---

## Ticket 3: Card Detail Page with Image Gallery

**Branch:** `feat/phase-8.3-card-detail`

### Summary
Create a card detail page that shows full card information and an image gallery. This gives users a dedicated space to view images at full size and manage them.

### Tasks

1. **Create route** — add `inventory/:cardId` child route in `shop.routes.ts`
   ```typescript
   {
     path: 'inventory/:cardId',
     loadComponent: () => import('./inventory/card-detail/card-detail.component')
       .then(m => m.CardDetailComponent)
   }
   ```

2. **Create `CardDetailComponent`** — `src/app/features/shop/inventory/card-detail/`
   - Route param: `cardId` from URL
   - Fetches card data and images on init
   - Signals:
     - `card = signal<InventoryItem | null>(null)`
     - `images = signal<InventoryImage[]>([])`
     - `loading = signal(true)`
     - `selectedImage = signal<InventoryImage | null>(null)` (for lightbox)

3. **Template layout:**
   ```
   ┌──────────────────────────────────────────┐
   │ ← Back to Inventory         Edit | Sell  │  (header)
   ├────────────────────┬─────────────────────┤
   │                    │  Card Name           │
   │   Image Gallery    │  Set · #025/198      │
   │   [Front] [Back]   │  Condition: Near Mint│
   │                    │  Grade: PSA 9.5      │
   │   + Add Image      │  Purchase: $12.00    │
   │                    │  Selling: $25.00     │
   │                    │  Status: Available   │
   │                    │  Foil: Yes           │
   │                    │  Language: English    │
   │                    │  Notes: ...          │
   └────────────────────┴─────────────────────┘
   ```

   **Mobile:** stacked layout — images on top, details below

4. **Image gallery section**
   - Show images as thumbnails (card-sized aspect ratio ~2.5:3.5)
   - Click thumbnail → open lightbox overlay (full-size image)
   - Primary image shown first, with a subtle star badge
   - "Add Image" slot (if under 2 images) — same `ImageUploadSlotComponent` from Ticket 2
   - Delete button on each image (with confirmation)
   - Set as primary button

5. **Lightbox overlay** — simple implementation
   - Full-screen overlay with dark background
   - Image centered, fit to viewport
   - Close button (X) top-right
   - Click outside image to close
   - Keyboard: Escape to close, Left/Right arrows to navigate between images
   - No external library — keep it lightweight

6. **Card info section**
   - Display all inventory fields in a structured layout
   - Use `mat-list` or definition list (`<dl>`) for field/value pairs
   - Condition shown with `ConditionLabelPipe` from Phase 6
   - Status shown as colored chip
   - Grade shown as "PSA 9.5" format (if graded)
   - Prices formatted with currency pipe

7. **Action buttons in header**
   - "Edit" → opens `CardFormDialogComponent` in edit mode
   - "Sell" → opens `MarkSoldDialogComponent` (only if status === 'available')
   - "Delete" → soft delete with undo toast (from Phase 6 Ticket 7 pattern)
   - On edit/sell success: refresh card data

8. **Navigation**
   - Back button → `router.navigate(['../'], { relativeTo: route })`
   - Table/grid row click in inventory list → navigates to `/shop/:slug/inventory/:cardId`

9. **Unit tests** — `card-detail.component.spec.ts`
   - Test: fetches card data on init
   - Test: displays all card fields
   - Test: renders image thumbnails
   - Test: lightbox opens on thumbnail click
   - Test: lightbox closes on Escape key
   - Test: "Add Image" slot shown when under 2 images
   - Test: edit button opens dialog
   - Test: sell button hidden for non-available cards

### Files Created
```
src/app/features/shop/inventory/card-detail/
  card-detail.component.ts
  card-detail.component.html
  card-detail.component.scss
  card-detail.component.spec.ts
```

### Files Modified
```
src/app/features/shop/shop.routes.ts                                    (add card detail route)
src/app/features/shop/inventory/inventory-list/inventory-list.component.ts   (row click → navigate)
src/app/features/shop/inventory/inventory-list/inventory-list.component.html (row click handler)
src/app/features/shop/inventory/inventory-grid/inventory-grid.component.ts   (card click → navigate)
```

### Acceptance Criteria
- Card detail page loads with all card info and images
- Image gallery shows front/back thumbnails
- Lightbox opens on click with keyboard navigation
- Add image works from detail page (if under limit)
- Delete image works with confirmation
- Primary image toggleable
- Edit/Sell/Delete actions work from detail page
- Row click in table/grid navigates to detail page
- Back button returns to inventory list
- Responsive: stacked layout on mobile

---

## Ticket 4: Image Thumbnails in Inventory List & Grid

**Branch:** `feat/phase-8.4-thumbnails`

### Summary
Show the primary image as a thumbnail in the inventory data table and card grid views. This makes the list visually scannable and leverages the uploaded images.

### Tasks

1. **Update `InventoryService.loadInventory()`**
   - Join `inventory_images` in the query to get the primary image for each card:
     ```typescript
     .select(`
       *,
       primary_image:inventory_images!inner (
         id, storage_path
       )
     `)
     ```
   - Or: use a separate query to batch-fetch primary images for the current page's card IDs
   - Simpler approach: add optional `primary_image_url` to the loaded items via a post-fetch enrichment step

   **Recommended approach** — use Supabase's relation query:
   ```typescript
   .select(`
     *,
     images:inventory_images (
       id, storage_path, is_primary
     )
   `)
   ```
   Then compute `primaryImageUrl` on the client side from the first `is_primary` image.

2. **Update `InventoryItem` model** — add optional `images` relation:
   ```typescript
   export interface InventoryItemWithImages extends InventoryItem {
     images?: Pick<InventoryImage, 'id' | 'storage_path' | 'is_primary'>[];
   }
   ```

3. **Table view thumbnail column**
   - Add as first column (before Card Name)
   - Small thumbnail: 40×56px (card aspect ratio)
   - Placeholder icon (`image` mat-icon) when no image
   - Use `loading="lazy"` on `<img>` tags
   - `object-fit: cover` with rounded corners

4. **Grid view thumbnail**
   - Show primary image as the card tile's hero image (top section)
   - Placeholder: gradient background with card icon
   - Aspect ratio: 2.5:3.5 (standard trading card)
   - `loading="lazy"` for images below the fold

5. **Performance considerations**
   - Images are already small (~200 KB after compression) so no additional thumbnail generation needed
   - Use `loading="lazy"` native attribute
   - For grid view: consider `content-visibility: auto` CSS for off-screen cards
   - Public URLs from Supabase Storage are CDN-cached

6. **Unit tests**
   - Test: table renders thumbnail column with image
   - Test: table renders placeholder when no image
   - Test: grid renders hero image
   - Test: grid renders placeholder when no image

### Files Modified
```
src/app/core/services/inventory.service.ts                             (join images in query)
src/app/core/models/inventory.model.ts                                 (add InventoryItemWithImages)
src/app/features/shop/inventory/inventory-list/
  inventory-list.component.ts
  inventory-list.component.html
  inventory-list.component.scss
src/app/features/shop/inventory/inventory-grid/
  inventory-grid.component.ts
  inventory-grid.component.html
  inventory-grid.component.scss
```

### Acceptance Criteria
- Primary image shown as thumbnail in table (40×56px)
- Primary image shown as hero in grid view
- Placeholder icon when no image
- Lazy loading for off-screen images
- No performance regression on inventory list load
- Images load from Supabase public URLs

---

## Ticket 5: E2E Image Tests

**Branch:** `feat/phase-8.5-image-e2e`

### Summary
End-to-end Playwright tests covering image upload, display, and management.

### Tasks

1. **Create test fixture images**
   - `e2e/fixtures/card-front.jpg` — small test image (~50 KB)
   - `e2e/fixtures/card-back.jpg` — small test image (~50 KB)
   - `e2e/fixtures/oversized.jpg` — >10 MB test image (for rejection testing)
   - Can be generated programmatically or checked in as small static files

2. **`e2e/card-images.spec.ts`** — Upload flow
   - Log in, create shop, add a card (no images)
   - Open edit dialog → upload front image via `setInputFiles`
   - Verify image preview appears in dialog
   - Save → verify thumbnail appears in inventory table
   - Open card detail page → verify image in gallery
   - Upload back image from detail page
   - Verify both images shown in gallery

3. **`e2e/card-images-management.spec.ts`** — Image management
   - Add card with 2 images
   - Open detail page → delete one image
   - Verify only 1 image remains
   - Set the remaining image as primary
   - Verify primary badge shown
   - Upload a new image to fill the second slot
   - Verify "Add Image" slot disappears (at 2-image limit)

4. **`e2e/card-images-validation.spec.ts`** — Error cases
   - Attempt upload of non-image file → verify rejection
   - Attempt upload of oversized file → verify error toast
   - Verify 2-image limit enforced in UI (slot hidden)

5. **`e2e/card-detail.spec.ts`** — Card detail page
   - Navigate to card detail via table row click
   - Verify all card fields displayed
   - Click image → verify lightbox opens
   - Press Escape → verify lightbox closes
   - Click edit → verify dialog opens
   - Click back → verify returns to inventory list

### Files Created
```
e2e/card-images.spec.ts
e2e/card-images-management.spec.ts
e2e/card-images-validation.spec.ts
e2e/card-detail.spec.ts
e2e/fixtures/card-front.jpg
e2e/fixtures/card-back.jpg
```

### Acceptance Criteria
- Upload from dialog tested (add + edit modes)
- Upload from detail page tested
- Image deletion tested
- Primary image toggling tested
- 2-image limit enforced
- File validation (type + size) tested
- Card detail page navigation and display tested
- Lightbox open/close tested
- All tests isolated (own shop/cards)
- Tests pass reliably

---

## Dependency Graph & Suggested Merge Order

```
Ticket 1: Storage Bucket + Image Service      (foundational — bucket, compression, service)
    ↓
Ticket 2: Upload in Card Dialog                (depends on 1 — upload from dialog)
    ↓
Ticket 3: Card Detail Page + Gallery           (depends on 1, 2 — detail page, lightbox)
    ↓
Ticket 4: Thumbnails in List/Grid              (depends on 1 — query join, display)
    ↓
Ticket 5: E2E Tests                            (depends on all above)
```

**Recommended order:** 1 → 2 → 3 → 4 → 5

Tickets 3 and 4 can be worked in parallel after Ticket 2 since they're independent (detail page vs list thumbnails).

---

## Files Changed Across All Tickets (Summary)

### New Files
```
supabase/migrations/YYYYMMDD_card_images_bucket.sql                   (Ticket 1)
src/app/core/models/image.model.ts                                     (Ticket 1)
src/app/core/services/image-compression.service.ts                     (Ticket 1)
src/app/core/services/image-compression.service.spec.ts                (Ticket 1)
src/app/core/services/image.service.ts                                 (Ticket 1)
src/app/core/services/image.service.spec.ts                            (Ticket 1)
src/app/shared/components/image-upload-slot/                            (Ticket 2)
src/app/features/shop/inventory/card-detail/                            (Ticket 3)
e2e/card-images.spec.ts                                                 (Ticket 5)
e2e/card-images-management.spec.ts                                      (Ticket 5)
e2e/card-images-validation.spec.ts                                      (Ticket 5)
e2e/card-detail.spec.ts                                                 (Ticket 5)
e2e/fixtures/card-front.jpg                                             (Ticket 5)
e2e/fixtures/card-back.jpg                                              (Ticket 5)
```

### Modified Files
```
src/app/features/shop/inventory/card-form-dialog/                       (Ticket 2 — add image section)
src/app/features/shop/shop.routes.ts                                    (Ticket 3 — add detail route)
src/app/features/shop/inventory/inventory-list/                         (Ticket 3, 4 — row click, thumbnails)
src/app/features/shop/inventory/inventory-grid/                         (Ticket 3, 4 — card click, thumbnails)
src/app/core/services/inventory.service.ts                              (Ticket 4 — join images in query)
src/app/core/models/inventory.model.ts                                  (Ticket 4 — add images relation)
```

### New Migration Required
One migration to create the Supabase storage bucket and its RLS policies. The `inventory_images` table already exists from Phase 2.
