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
- **Bucket:** `card-images` — `public: true` so images are served via public URL without auth tokens (simpler `<img>` tags). RLS still controls who can upload/delete. Since card images are not sensitive data, public read access is acceptable. The UUID-based path convention (`{org_id}/{inventory_id}/{uuid}.webp`) makes URLs effectively unguessable.
- **Primary image:** First uploaded image is `is_primary = true`, shown as thumbnail in table/grid views. Enforced at the DB level via a partial unique index.
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
Create the Supabase storage bucket with RLS policies, build the image compression utility, and create the `ImageService` for upload/delete/fetch operations. Includes a `set_primary_image` RPC for atomic primary toggling and a `cleanup_orphaned_images` RPC for storage hygiene.

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

     -- Members can view their org's images (for listing operations; public URLs bypass this)
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

   - Partial unique index to enforce at most one primary image per card:
     ```sql
     CREATE UNIQUE INDEX idx_images_one_primary
     ON inventory_images(inventory_id)
     WHERE is_primary = true;
     ```

   - `set_primary_image` RPC for atomic primary toggling:
     ```sql
     CREATE OR REPLACE FUNCTION public.set_primary_image(
       p_image_id UUID,
       p_inventory_id UUID
     ) RETURNS void
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path = ''
     AS $$
     DECLARE
       v_org_id UUID;
     BEGIN
       -- Verify the image belongs to this card and get the org_id
       SELECT organization_id INTO v_org_id
       FROM public.inventory_images
       WHERE id = p_image_id AND inventory_id = p_inventory_id;

       IF v_org_id IS NULL THEN
         RAISE EXCEPTION 'Image not found for this card';
       END IF;

       -- Verify caller is a member of the org
       IF v_org_id NOT IN (SELECT public.get_user_org_ids()) THEN
         RAISE EXCEPTION 'Access denied';
       END IF;

       -- Atomically unset existing primary and set the new one
       UPDATE public.inventory_images
       SET is_primary = false
       WHERE inventory_id = p_inventory_id AND is_primary = true;

       UPDATE public.inventory_images
       SET is_primary = true
       WHERE id = p_image_id;
     END;
     $$;
     ```

   - `cleanup_orphaned_storage` RPC for removing storage files whose `inventory_images` rows were CASCADE-deleted (e.g., when an org is hard-deleted). This is called manually or via a scheduled job:
     ```sql
     -- Returns the storage paths that are orphaned (no matching inventory_images row).
     -- The caller (admin/cron) deletes these from storage after reviewing.
     CREATE OR REPLACE FUNCTION public.cleanup_orphaned_storage()
     RETURNS TABLE(storage_path TEXT)
     LANGUAGE sql
     SECURITY DEFINER
     SET search_path = ''
     AS $$
       SELECT o.name AS storage_path
       FROM storage.objects o
       WHERE o.bucket_id = 'card-images'
         AND NOT EXISTS (
           SELECT 1 FROM public.inventory_images i
           WHERE i.storage_path = o.name
         );
     $$;
     ```

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
     - Calls `set_primary_image` RPC (atomic — unsets existing primary and sets new one in a single function)

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
   - Test: `setAsPrimary` calls `set_primary_image` RPC with correct params
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
- Partial unique index enforces at most one primary image per card
- `set_primary_image` RPC atomically toggles primary image
- `cleanup_orphaned_storage` RPC identifies orphaned storage files
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
   const { data: card, error } = await this.inventoryService.addCard(formData);
   if (error) { /* handle error, return */ }

   // 2. Upload images (if any selected) — non-blocking for card creation
   let imageErrors = 0;
   if (this.frontImage()) {
     const result = await this.imageService.uploadImage(card.id, this.frontImage()!, true);
     if (!result) imageErrors++;
   }
   if (this.backImage()) {
     const result = await this.imageService.uploadImage(card.id, this.backImage()!, !this.frontImage());
     if (!result) imageErrors++;
   }

   // 3. Show appropriate feedback
   if (imageErrors > 0) {
     this.notify.warn('Card created but some images failed to upload. You can add them later from the card detail page.');
   } else {
     this.notify.success('Card added successfully');
   }

   // 4. Close dialog — card was created regardless of image outcome
   this.dialogRef.close(card);
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
   - Test: partial image upload failure shows warning but still closes dialog with card
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
- Add mode: if card creation succeeds but image upload fails, card is still created and user is warned with instructions to retry from detail page
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

## Ticket 3a: Card Detail Page

**Branch:** `feat/phase-8.3a-card-detail`

### Summary
Create a card detail page that shows full card information with action buttons. Update table/grid row interactions: clicking a row navigates to the detail page, and an explicit "Edit" button is added to the action menu for inline editing via dialog.

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
   - Fetches card data on init
   - Signals:
     - `card = signal<InventoryItem | null>(null)`
     - `loading = signal(true)`

3. **Template layout:**
   ```
   ┌──────────────────────────────────────────┐
   │ ← Back to Inventory    Edit | Sell | Del │  (header)
   ├────────────────────┬─────────────────────┤
   │                    │  Card Name           │
   │  [Image placeholder│  Set · #025/198      │
   │   — populated in   │  Condition: Near Mint│
   │   Ticket 3b]       │  Grade: PSA 9.5      │
   │                    │  Purchase: $12.00    │
   │                    │  Selling: $25.00     │
   │                    │  Status: Available   │
   │                    │  Foil: Yes           │
   │                    │  Language: English    │
   │                    │  Notes: ...          │
   └────────────────────┴─────────────────────┘
   ```

   **Mobile:** stacked layout — image placeholder on top, details below

4. **Card info section**
   - Display all inventory fields in a structured layout
   - Use `mat-list` or definition list (`<dl>`) for field/value pairs
   - Condition shown with `ConditionLabelPipe` from Phase 6
   - Status shown as colored chip
   - Grade shown as "PSA 9.5" format (if graded)
   - Prices formatted with currency pipe
   - Left column reserved for image gallery (added in Ticket 3b), show a placeholder area for now

5. **Action buttons in header**
   - "Edit" → opens `CardFormDialogComponent` in edit mode
   - "Sell" → opens `MarkSoldDialogComponent` (only if status === 'available')
   - "Delete" → soft delete with undo toast (from Phase 6 Ticket 7 pattern), navigates back to inventory on success
   - On edit/sell success: refresh card data

6. **Navigation changes**
   - Back button → `router.navigate(['../'], { relativeTo: route })`
   - **Table row click** → navigates to `/shop/:slug/inventory/:cardId` (replaces current behavior of opening the edit dialog)
   - **Grid card click** → navigates to `/shop/:slug/inventory/:cardId` (replaces current behavior of opening the edit dialog)
   - **Edit button remains in the action menu** (both table and grid) — the `more_vert` menu already has an "Edit" menu item from Phase 6 that opens the `CardFormDialogComponent` in edit mode. This continues to work as before for quick edits without navigating away.

7. **Unit tests** — `card-detail.component.spec.ts`
   - Test: fetches card data on init
   - Test: displays all card fields
   - Test: edit button opens dialog
   - Test: sell button hidden for non-available cards
   - Test: delete navigates back to inventory
   - Test: back button navigates to inventory list

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
src/app/features/shop/inventory/inventory-list/inventory-list.component.html (row click → navigate)
src/app/features/shop/inventory/inventory-grid/inventory-grid.component.ts   (card click → navigate)
src/app/features/shop/inventory/inventory-grid/inventory-grid.component.html (card click → navigate)
```

### Acceptance Criteria
- Card detail page loads with all card info
- Edit/Sell/Delete actions work from detail page
- Table row click navigates to detail page (no longer opens edit dialog)
- Grid card click navigates to detail page (no longer opens edit dialog)
- Edit menu item in `more_vert` action menu still opens edit dialog (quick inline edit)
- Back button returns to inventory list
- Responsive: stacked layout on mobile
- Left column has a placeholder area for images (populated in Ticket 3b)

---

## Ticket 3b: Image Gallery & Lightbox on Detail Page

**Branch:** `feat/phase-8.3b-image-gallery`

### Summary
Add the image gallery and lightbox to the card detail page created in Ticket 3a. Users can view, add, delete, and manage images from this page.

### Tasks

1. **Add image signals to `CardDetailComponent`**
   - `images = signal<InventoryImage[]>([])`
   - Fetch images on init via `imageService.getImages(cardId)`
   - Refresh images after upload/delete/primary-toggle

2. **Image gallery section** (replaces the placeholder from Ticket 3a)
   - Show images as thumbnails (card-sized aspect ratio ~2.5:3.5)
   - Click thumbnail → open lightbox dialog (full-size image)
   - Primary image shown first, with a subtle star badge
   - "Add Image" slot (if under 2 images) — same `ImageUploadSlotComponent` from Ticket 2
   - Delete button on each image (with confirmation)
   - Set as primary button (calls `set_primary_image` RPC via `ImageService`)

3. **Lightbox dialog** — `MatDialog`-based implementation
   - Open a `MatDialog` with `maxWidth: '100vw'`, `width: '100vw'`, `height: '100vh'`, `panelClass: 'lightbox-dialog'`
   - Dark background via dialog backdrop
   - Image centered, `object-fit: contain` to fit viewport
   - Close button (X) top-right
   - Click backdrop to close (default `MatDialog` behavior)
   - Keyboard: Escape to close (default `MatDialog` behavior)
   - Left/Right arrow navigation between images (if 2 images exist)
   - Simple standalone component: `ImageLightboxDialogComponent`

4. **Unit tests** — update `card-detail.component.spec.ts`
   - Test: renders image thumbnails
   - Test: lightbox dialog opens on thumbnail click
   - Test: "Add Image" slot shown when under 2 images
   - Test: "Add Image" slot hidden when at 2-image limit
   - Test: delete image refreshes the gallery
   - Test: set as primary calls RPC

### Files Created
```
src/app/features/shop/inventory/image-lightbox-dialog/
  image-lightbox-dialog.component.ts
  image-lightbox-dialog.component.html
  image-lightbox-dialog.component.scss
```

### Files Modified
```
src/app/features/shop/inventory/card-detail/
  card-detail.component.ts    (add image gallery logic)
  card-detail.component.html  (add image gallery template)
  card-detail.component.scss  (add image gallery styles)
  card-detail.component.spec.ts (add image gallery tests)
```

### Acceptance Criteria
- Image gallery shows front/back thumbnails
- Lightbox opens via `MatDialog` on thumbnail click with keyboard close (Escape)
- Arrow key navigation between images in lightbox
- Add image works from detail page (if under limit)
- Delete image works with confirmation
- Primary image toggleable via `set_primary_image` RPC
- Gallery refreshes after upload/delete/primary-toggle
- Responsive: images stack on mobile

---

## Ticket 4: Image Thumbnails in Inventory List & Grid

**Branch:** `feat/phase-8.4-thumbnails`

### Summary
Show the primary image as a thumbnail in the inventory data table and card grid views. This makes the list visually scannable and leverages the uploaded images.

### Tasks

1. **Update `InventoryService.loadInventory()`**
   - Join `inventory_images` in the query to get images for each card using Supabase's relation query (LEFT JOIN — cards without images are still included):
     ```typescript
     .select(`
       *,
       images:inventory_images (
         id, storage_path, is_primary
       )
     `)
     ```
   - Then compute `primaryImageUrl` on the client side from the first `is_primary` image.

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
   - For grid view: use `content-visibility: auto` CSS for off-screen cards (supported in all modern browsers)
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
- Cards without images still display correctly (LEFT JOIN, not INNER JOIN)
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
   - `e2e/fixtures/card-front.jpg` — small test image (~50 KB), checked into repo as a static file
   - `e2e/fixtures/card-back.jpg` — small test image (~50 KB), checked into repo as a static file
   - **No oversized fixture committed** — the oversized image for rejection testing is generated programmatically in the test via a `Buffer.alloc()` written to a temp file (avoids bloating the repo with a 10 MB+ file)

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
   - Attempt upload of programmatically-generated oversized file → verify error toast
   - Verify 2-image limit enforced in UI (slot hidden)

5. **`e2e/card-detail.spec.ts`** — Card detail page
   - Navigate to card detail via table row click
   - Verify all card fields displayed
   - Click image → verify lightbox dialog opens
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
- File validation (type + size) tested — oversized file generated at runtime, not committed
- Card detail page navigation and display tested
- Lightbox open/close tested
- All tests isolated (own shop/cards)
- Tests pass reliably

---

## Dependency Graph & Suggested Merge Order

```
Ticket 1: Storage Bucket + Image Service      (foundational — bucket, compression, service, RPCs)
    ↓
Ticket 2: Upload in Card Dialog                (depends on 1 — upload from dialog)
    ↓
Ticket 3a: Card Detail Page                    (depends on Phase 6 — detail page, navigation changes)
    ↓
Ticket 3b: Image Gallery + Lightbox            (depends on 1, 2, 3a — images on detail page)
    ↓
Ticket 4: Thumbnails in List/Grid              (depends on 1 — query join, display)
    ↓
Ticket 5: E2E Tests                            (depends on all above)
```

**Recommended order:** 1 → 2 → 3a → 3b → 4 → 5

Notes:
- Ticket 3a can be started in parallel with Tickets 1 and 2 since it doesn't depend on image functionality (it just creates the detail page with a placeholder for images).
- Tickets 3b and 4 can be worked in parallel after their respective dependencies are met (3b needs 3a + image service; 4 only needs image service).

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
src/app/features/shop/inventory/card-detail/                            (Ticket 3a)
src/app/features/shop/inventory/image-lightbox-dialog/                  (Ticket 3b)
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
src/app/features/shop/shop.routes.ts                                    (Ticket 3a — add detail route)
src/app/features/shop/inventory/inventory-list/                         (Ticket 3a, 4 — row click → navigate, thumbnails)
src/app/features/shop/inventory/inventory-grid/                         (Ticket 3a, 4 — card click → navigate, thumbnails)
src/app/features/shop/inventory/card-detail/                            (Ticket 3b — add image gallery)
src/app/core/services/inventory.service.ts                              (Ticket 4 — join images in query)
src/app/core/models/inventory.model.ts                                  (Ticket 4 — add images relation)
```

### New Migration
One migration to create the Supabase storage bucket, its RLS policies, the `idx_images_one_primary` partial unique index, and two RPCs (`set_primary_image`, `cleanup_orphaned_storage`). The `inventory_images` table already exists from Phase 2.
