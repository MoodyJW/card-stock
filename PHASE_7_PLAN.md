# Phase 7: Import + Export

> Broken into PR-sized work items. Each section is an independent, mergeable unit.
> Depends on: Phase 6 complete (inventory service, models, CRUD UI).

---

## Architecture Decisions (applies to all tickets)

- **Library:** ExcelJS (`exceljs` v4.4.0, already in dependencies) for both Excel read/write and CSV export
- **Import runs client-side** — file is parsed in the browser via ExcelJS; rows are inserted in batches to Supabase
- **Column mapping UI** — user maps spreadsheet columns to inventory fields via dropdowns (auto-detect common headers)
- **Validation before insert** — parse all rows, show validation errors inline, let user fix or skip bad rows before committing
- **Batch inserts** — insert rows in chunks of 50 to avoid Supabase payload limits and give progress feedback
- **CSV export** — generates CSV from the current filtered inventory view (respects active filters)
- **Excel export** — generates `.xlsx` with formatted headers and proper column types
- **No new database changes** — uses existing `inventory` table and RLS policies from Phase 2

### Inventory Fields for Import/Export

| Field | Import | Export | Required on Import | Auto-mapped Headers |
|-------|--------|--------|-------------------|---------------------|
| `card_name` | Yes | Yes | Yes | "Card Name", "Name", "Card" |
| `set_name` | Yes | Yes | No | "Set Name", "Set", "Expansion" |
| `set_code` | Yes | Yes | No | "Set Code", "Set #" |
| `card_number` | Yes | Yes | No | "Card Number", "Number", "#", "Card #" |
| `rarity` | Yes | Yes | No | "Rarity" |
| `language` | Yes | Yes | No | "Language", "Lang" |
| `is_foil` | Yes | Yes | No | "Foil", "Is Foil", "Holo" |
| `condition` | Yes | Yes | No (default: near_mint) | "Condition", "Cond" |
| `grading_company` | Yes | Yes | No | "Grading Company", "Grader" |
| `grade` | Yes | Yes | No | "Grade", "Score" |
| `purchase_price` | Yes | Yes | No | "Purchase Price", "Cost", "Buy Price" |
| `selling_price` | Yes | Yes | No | "Selling Price", "Price", "Sell Price" |
| `notes` | Yes | Yes | No | "Notes", "Comments" |
| `status` | No | Yes | — | — (always "available" on import) |
| `created_at` | No | Yes | — | — |

---

## Ticket 1: Import Parser Service

**Branch:** `feat/phase-7.1-import-parser`

### Summary
Create a service that reads Excel/CSV files via ExcelJS, extracts headers and row data, auto-detects column mappings, and validates rows against inventory field constraints.

### Tasks

1. **Create `ImportParserService`** in `src/app/core/services/import-parser.service.ts`
   - Injectable, `providedIn: 'root'`
   - No state signals — pure parsing utility

   **Methods:**

   - `async parseFile(file: File): Promise<ParsedSpreadsheet>`
     - Reads file using `ExcelJS.Workbook.xlsx.load()` for `.xlsx` / `.xls`
     - For `.csv`: use `ExcelJS.Workbook.csv.read()` with a readable stream from the file
     - Returns: `{ headers: string[], rows: RawRow[], sheetNames: string[] }`
     - Defaults to first worksheet; user can pick sheet in UI (Ticket 2)

   - `autoMapColumns(headers: string[]): ColumnMapping[]`
     - Matches spreadsheet headers to inventory fields using the auto-mapped headers table above
     - Case-insensitive, trim whitespace
     - Returns array of `{ sourceColumn: number, targetField: string, confidence: 'exact' | 'fuzzy' | 'unmapped' }`
     - Unmapped columns get `targetField: null`

   - `validateRows(rows: RawRow[], mapping: ColumnMapping[]): ValidatedRow[]`
     - Applies mapping to each row, producing typed objects
     - Validation rules:
       - `card_name`: required, non-empty string, max 200 chars
       - `condition`: must be valid `condition_enum` value (case-insensitive, map common aliases like "NM" → "near_mint", "LP" → "lightly_played")
       - `grading_company`: must be valid `grading_company_enum` or empty
       - `grade`: number 0.0–10.0, only valid if `grading_company` present
       - `purchase_price` / `selling_price`: non-negative numbers, strip `$` and commas
       - `is_foil`: accept "yes"/"no"/"true"/"false"/"1"/"0"/boolean
       - `language`: default "English" if empty
     - Each row gets: `{ data: Partial<CreateInventoryItem>, errors: FieldError[], rowNumber: number, valid: boolean }`

   - `parsePrice(value: string | number): number | null`
     - Strips `$`, `,`, whitespace; parses to float
     - Returns `null` if unparseable

   - `parseCondition(value: string): Condition | null`
     - Maps common abbreviations and full names to `condition_enum`
     - Alias map: `{ 'nm': 'near_mint', 'm': 'mint', 'lp': 'lightly_played', 'mp': 'moderately_played', 'hp': 'heavily_played', 'dmg': 'damaged', 'damaged': 'damaged', ... }`

   - `parseFoil(value: string | number | boolean): boolean`
     - Truthy: "yes", "true", "1", true, 1
     - Falsy: everything else

2. **Create models** in `src/app/core/models/import.model.ts`
   ```typescript
   export interface ParsedSpreadsheet {
     headers: string[];
     rows: RawRow[];
     sheetNames: string[];
   }

   export type RawRow = (string | number | boolean | null)[];

   export interface ColumnMapping {
     sourceIndex: number;
     sourceHeader: string;
     targetField: keyof CreateInventoryItem | null;
     confidence: 'exact' | 'fuzzy' | 'unmapped';
   }

   export interface FieldError {
     field: string;
     message: string;
   }

   export interface ValidatedRow {
     rowNumber: number;
     data: Partial<CreateInventoryItem>;
     errors: FieldError[];
     valid: boolean;
     skipped: boolean;   // user chose to skip this row
   }

   export interface ImportResult {
     totalRows: number;
     imported: number;
     skipped: number;
     failed: number;
     errors: { rowNumber: number; message: string }[];
   }
   ```

3. **Unit tests** — `import-parser.service.spec.ts`
   - Test: `parseFile` reads `.xlsx` and returns headers + rows
   - Test: `parseFile` reads `.csv` and returns headers + rows
   - Test: `autoMapColumns` maps "Card Name" → `card_name` (exact)
   - Test: `autoMapColumns` maps "Name" → `card_name` (fuzzy)
   - Test: `autoMapColumns` leaves unknown headers unmapped
   - Test: `validateRows` flags missing `card_name` as error
   - Test: `validateRows` parses condition aliases ("NM" → "near_mint")
   - Test: `parsePrice` strips `$` and commas ("$1,234.56" → 1234.56)
   - Test: `parseFoil` handles "yes"/"no"/true/false/1/0
   - Test: `validateRows` rejects grade without grading_company

### Files Created
```
src/app/core/models/import.model.ts
src/app/core/services/import-parser.service.ts
src/app/core/services/import-parser.service.spec.ts
```

### Acceptance Criteria
- Parses `.xlsx` and `.csv` files correctly via ExcelJS
- Auto-maps common header names to inventory fields
- Validates all field constraints with clear error messages
- Condition aliases (NM, LP, etc.) handled gracefully
- Price strings with `$` and commas parsed correctly
- Boolean foil field accepts multiple truthy/falsy formats
- All parsing is synchronous after initial file read (no Supabase calls)

---

## Ticket 2: Import Wizard — File Upload & Column Mapping

**Branch:** `feat/phase-7.2-import-wizard-mapping`

### Summary
Build the first two steps of the import wizard: file upload and column mapping UI. The wizard is a routed page under the shop layout.

### Tasks

1. **Create route** — add `import` child route in `shop.routes.ts`
   ```typescript
   {
     path: 'import',
     loadComponent: () => import('./import/import-wizard/import-wizard.component')
       .then(m => m.ImportWizardComponent)
   }
   ```

2. **Enable the import nav link** in `shop-layout.component.html`

3. **Create `ImportWizardComponent`** — `src/app/features/shop/import/import-wizard/`
   - Uses `MatStepper` (linear mode) with 3 steps:
     1. **Upload** — file selection
     2. **Map Columns** — column mapping
     3. **Review & Import** — validation preview + commit (Ticket 3)
   - Local signals:
     - `file = signal<File | null>(null)`
     - `parsedData = signal<ParsedSpreadsheet | null>(null)`
     - `columnMappings = signal<ColumnMapping[]>([])`
     - `selectedSheet = signal<number>(0)`
     - `parseError = signal<string | null>(null)`

4. **Step 1: File Upload**
   - Drag-and-drop zone + "Browse" button
   - Accept: `.xlsx`, `.xls`, `.csv`
   - Max file size: 5MB (validate client-side)
   - On file selected:
     - Call `importParser.parseFile(file)`
     - On success: populate `parsedData`, auto-advance to step 2
     - On error: show `parseError` with message
   - Show file name and size after selection
   - "Remove" button to clear selection and start over

   **Drag-and-drop implementation:**
   ```typescript
   onDragOver(event: DragEvent) {
     event.preventDefault();
     this.isDragging.set(true);
   }
   onDrop(event: DragEvent) {
     event.preventDefault();
     this.isDragging.set(false);
     const file = event.dataTransfer?.files[0];
     if (file) this.handleFile(file);
   }
   ```

5. **Step 2: Column Mapping**
   - Show a table with:
     - Column A: spreadsheet header names (from parsed data)
     - Column B: dropdown to select target inventory field (or "Skip this column")
     - Column C: confidence indicator (green check for exact, yellow for fuzzy, grey dash for unmapped)
   - Pre-populated from `autoMapColumns()` results
   - User can override any mapping via the dropdown
   - Each target field can only be mapped once (disable already-mapped fields in other dropdowns)
   - Show a preview of the first 3 rows below the mapping table to help users verify

   **Sheet selector** — if the workbook has multiple sheets, show a `mat-select` at the top of step 2 to pick which sheet to import. Changing the sheet re-parses and re-maps.

6. **Validation on "Next"**
   - `card_name` must be mapped to at least one column
   - Show error if `card_name` is not mapped: "Card Name is required. Please map a column to Card Name."

7. **Unit tests** — `import-wizard.component.spec.ts`
   - Test: file input accepts .xlsx, .xls, .csv
   - Test: drag-and-drop sets file signal
   - Test: file over 5MB shows error
   - Test: auto-mapping populates dropdowns
   - Test: duplicate target field mapping prevented
   - Test: cannot proceed without card_name mapped

### Files Created
```
src/app/features/shop/import/import-wizard/
  import-wizard.component.ts
  import-wizard.component.html
  import-wizard.component.scss
  import-wizard.component.spec.ts
```

### Acceptance Criteria
- Drag-and-drop and browse both work for file selection
- Accepted formats: .xlsx, .xls, .csv
- File size limit enforced (5MB)
- Column mapping auto-populates from header detection
- User can override any mapping
- Duplicate mappings prevented
- Preview rows help user verify mapping correctness
- Multi-sheet workbooks supported with sheet selector
- Cannot advance without `card_name` mapped

---

## Ticket 3: Import Wizard — Review, Validate & Commit

**Branch:** `feat/phase-7.3-import-wizard-commit`

### Summary
Build the third step of the import wizard: validation preview table, row-level skip/fix, and batch insert with progress feedback.

### Tasks

1. **Step 3: Review & Import** (in `ImportWizardComponent`)
   - On entering step 3, run `importParser.validateRows()` with current mappings
   - Store results in `validatedRows = signal<ValidatedRow[]>([])`
   - Compute summary signals:
     - `validCount = computed(() => validatedRows().filter(r => r.valid && !r.skipped).length)`
     - `errorCount = computed(() => validatedRows().filter(r => !r.valid && !r.skipped).length)`
     - `skippedCount = computed(() => validatedRows().filter(r => r.skipped).length)`

2. **Validation preview table**
   - `mat-table` showing all rows with columns:
     - Row # (original spreadsheet row number)
     - Card Name (mapped value)
     - Set Name (mapped value)
     - Condition (mapped value)
     - Status icon: green check (valid), red X (errors), grey dash (skipped)
     - Errors: list of error messages for invalid rows
     - Action: "Skip" toggle button to exclude rows
   - Color-code rows: valid = default, errors = light red background, skipped = grey/muted
   - Scrollable with virtual scrolling (`cdk-virtual-scroll-viewport`) if > 100 rows

3. **Summary bar** above the table
   - "Ready to import: X cards | Errors: Y | Skipped: Z"
   - Import button disabled if `validCount() === 0`

4. **Import execution** — `ImportService` in `src/app/core/services/import.service.ts`
   - Injectable, `providedIn: 'root'`
   - Method: `async importCards(rows: ValidatedRow[], orgId: string): Promise<ImportResult>`
   - Filters to valid, non-skipped rows
   - Inserts in batches of 50 using `supabase.client.from('inventory').insert(batch)`
   - Sets `organization_id`, `created_by`, `status: 'available'` on each row
   - Tracks progress via signal: `importProgress = signal<{ current: number, total: number } | null>(null)`
   - Returns `ImportResult` with counts

5. **Progress UI during import**
   - `mat-progress-bar` (determinate mode, value = `current / total * 100`)
   - "Importing X of Y cards..." text
   - Disable back/cancel during import
   - On complete: show result summary

6. **Result summary**
   - "Import complete: X cards imported, Y skipped, Z failed"
   - If failures: list the first 10 failed rows with error messages
   - "Go to Inventory" button → navigate to inventory list
   - "Import More" button → reset wizard to step 1

7. **Error handling**
   - If a batch fails: log which rows failed, continue with remaining batches
   - Failed rows tracked in `ImportResult.errors`
   - On total failure (e.g., network): stop import, show error, allow retry

8. **Unit tests** — `import.service.spec.ts`
   - Test: filters out skipped and invalid rows
   - Test: inserts in batches of 50
   - Test: sets organization_id and created_by on each row
   - Test: tracks progress signal correctly
   - Test: partial batch failure reports correct counts
   - Test: returns complete ImportResult

### Files Created
```
src/app/core/services/import.service.ts
src/app/core/services/import.service.spec.ts
```

### Files Modified
```
src/app/features/shop/import/import-wizard/import-wizard.component.ts   (add step 3 logic)
src/app/features/shop/import/import-wizard/import-wizard.component.html (add step 3 template)
src/app/features/shop/import/import-wizard/import-wizard.component.scss (add step 3 styles)
```

### Acceptance Criteria
- All rows validated and displayed with status indicators
- Users can skip individual rows
- Import button disabled when no valid rows
- Batch inserts in groups of 50 with progress bar
- Progress shows current/total count
- Partial failures reported (successful rows still committed)
- Result summary shows imported/skipped/failed counts
- Navigation to inventory or restart wizard after import
- Virtual scrolling for large imports (100+ rows)

---

## Ticket 4: CSV Export

**Branch:** `feat/phase-7.4-csv-export`

### Summary
Add a CSV export button to the inventory list page. Exports the current filtered view (respects active filters) to a downloadable `.csv` file.

### Tasks

1. **Create `ExportService`** in `src/app/core/services/export.service.ts`
   - Injectable, `providedIn: 'root'`

   **Methods:**

   - `async exportCsv(items: InventoryItem[], shopName: string): Promise<void>`
     - Builds CSV using ExcelJS `Workbook.csv.writeBuffer()`
     - Columns: Card Name, Set Name, Set Code, Card Number, Rarity, Language, Foil, Condition, Grading Company, Grade, Purchase Price, Selling Price, Status, Notes, Date Added
     - Condition values formatted as labels (e.g., "Near Mint" not "near_mint")
     - Foil as "Yes"/"No"
     - Prices formatted as numbers (no `$` — let spreadsheet apps handle currency)
     - Filename: `{shop-slug}-inventory-{YYYY-MM-DD}.csv`
     - Triggers browser download via `Blob` + `URL.createObjectURL` + temporary `<a>` click

   - `async exportExcel(items: InventoryItem[], shopName: string): Promise<void>`
     - Builds `.xlsx` using ExcelJS `Workbook.xlsx.writeBuffer()`
     - Same columns as CSV
     - Header row: bold, frozen
     - Column widths auto-sized based on header length
     - Price columns formatted as currency number format
     - Filename: `{shop-slug}-inventory-{YYYY-MM-DD}.xlsx`

   **Download helper:**
   ```typescript
   private downloadBlob(buffer: ArrayBuffer, filename: string, mimeType: string) {
     const blob = new Blob([buffer], { type: mimeType });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     a.click();
     URL.revokeObjectURL(url);
   }
   ```

2. **Fetch all matching rows for export** (not just the current page)
   - Add method to `InventoryService`: `async fetchAllFiltered(): Promise<InventoryItem[]>`
   - Applies current filters but no `.range()` limit
   - Cap at 10,000 rows to prevent memory issues
   - Show warning toast if export is capped

3. **Export button** in `InventoryListComponent` header
   - `mat-icon-button` with `download` icon + tooltip "Export"
   - Click opens a `mat-menu` with two options:
     - "Export as CSV"
     - "Export as Excel"
   - Both call respective export methods
   - Show loading spinner while generating (replace icon with `mat-spinner`)
   - Disabled when inventory is empty

4. **Unit tests** — `export.service.spec.ts`
   - Test: CSV output contains correct headers
   - Test: CSV condition values are human-readable labels
   - Test: CSV foil values are "Yes"/"No"
   - Test: Excel output creates valid workbook buffer
   - Test: filename includes shop slug and date
   - Test: download triggers blob creation

### Files Created
```
src/app/core/services/export.service.ts
src/app/core/services/export.service.spec.ts
```

### Files Modified
```
src/app/core/services/inventory.service.ts                          (add fetchAllFiltered method)
src/app/features/shop/inventory/inventory-list/inventory-list.component.ts    (add export button)
src/app/features/shop/inventory/inventory-list/inventory-list.component.html  (add export button + menu)
```

### Acceptance Criteria
- CSV export downloads with correct filename and data
- Excel export downloads with formatted headers and proper types
- Export respects active filters (status, condition, set, search)
- Export fetches all matching rows, not just current page
- 10,000 row cap with warning toast
- Condition and foil values human-readable in export
- Export button disabled when inventory is empty
- Loading indicator during export generation

---

## Ticket 5: Import/Export E2E Tests

**Branch:** `feat/phase-7.5-import-export-e2e`

### Summary
End-to-end Playwright tests covering the import wizard flow and export functionality.

### Tasks

1. **Create test fixture files**
   - `e2e/fixtures/valid-import.xlsx` — 5 rows with all fields populated, valid data
   - `e2e/fixtures/mixed-import.xlsx` — 10 rows: 7 valid, 2 with errors (missing card_name, invalid condition), 1 with edge cases (prices with `$`, foil as "yes")
   - `e2e/fixtures/simple-import.csv` — 3 rows, basic fields only (card_name, set_name, condition)
   - Generate these fixtures via a setup script using ExcelJS

2. **`e2e/import.spec.ts`** — Import wizard flow
   - Log in, create/select shop
   - Navigate to import page
   - Upload `valid-import.xlsx` via file input (Playwright `setInputFiles`)
   - Verify column mapping auto-populated
   - Advance to review step → verify all rows valid
   - Click Import → verify progress bar appears
   - Verify result summary shows "5 cards imported"
   - Navigate to inventory → verify 5 cards in table

3. **`e2e/import-validation.spec.ts`** — Error handling flow
   - Upload `mixed-import.xlsx`
   - Verify error rows highlighted in review step
   - Skip one error row → verify skipped count updates
   - Import → verify result: "7 imported, 1 skipped, 2 failed" (or similar counts based on fixture)
   - Navigate to inventory → verify correct number of cards

4. **`e2e/import-csv.spec.ts`** — CSV import
   - Upload `simple-import.csv`
   - Verify headers detected and mapped
   - Import → verify success
   - Navigate to inventory → verify cards present

5. **`e2e/export.spec.ts`** — Export flow
   - Log in, select shop with existing cards (seed or create via import)
   - Click export → CSV
   - Verify download triggered (Playwright `page.waitForEvent('download')`)
   - Read downloaded file, verify headers and row count match
   - Apply a filter (e.g., status = "available")
   - Export again → verify exported rows match filtered count

6. **Fixture generation script** — `e2e/fixtures/generate-fixtures.ts`
   - Node script that creates the test Excel/CSV files using ExcelJS
   - Run as part of `e2e:setup` or checked into the repo as static files

### Files Created
```
e2e/import.spec.ts
e2e/import-validation.spec.ts
e2e/import-csv.spec.ts
e2e/export.spec.ts
e2e/fixtures/
  generate-fixtures.ts
  valid-import.xlsx      (generated or static)
  mixed-import.xlsx      (generated or static)
  simple-import.csv      (generated or static)
```

### Acceptance Criteria
- Happy-path import tested end-to-end (upload → map → review → import → verify in inventory)
- Validation errors displayed and skippable
- CSV import tested
- Export downloads verified with correct content
- Filtered export tested (fewer rows than total)
- Test fixtures checked in or generated reliably
- All tests isolated (each creates own shop)
- Tests pass reliably

---

## Dependency Graph & Suggested Merge Order

```
Ticket 1: Import Parser Service      (foundational — parsing + validation)
    ↓
Ticket 2: Import Wizard (Upload + Mapping)  (depends on 1 — uses parser)
    ↓
Ticket 3: Import Wizard (Review + Commit)   (depends on 1, 2 — final wizard step)
    ↓
Ticket 4: CSV/Excel Export            (independent of 1-3, depends on Phase 6 inventory service)
    ↓
Ticket 5: E2E Tests                   (depends on all above)
```

**Recommended order:** 1 → 2 → 3 → 4 → 5

Ticket 4 (Export) can be worked in parallel with Tickets 2–3 since it doesn't depend on import functionality.

---

## Files Changed Across All Tickets (Summary)

### New Files
```
src/app/core/models/import.model.ts                                  (Ticket 1)
src/app/core/services/import-parser.service.ts                       (Ticket 1)
src/app/core/services/import-parser.service.spec.ts                  (Ticket 1)
src/app/features/shop/import/import-wizard/
  import-wizard.component.ts                                          (Ticket 2)
  import-wizard.component.html                                        (Ticket 2)
  import-wizard.component.scss                                        (Ticket 2)
  import-wizard.component.spec.ts                                     (Ticket 2)
src/app/core/services/import.service.ts                              (Ticket 3)
src/app/core/services/import.service.spec.ts                         (Ticket 3)
src/app/core/services/export.service.ts                              (Ticket 4)
src/app/core/services/export.service.spec.ts                         (Ticket 4)
e2e/import.spec.ts                                                    (Ticket 5)
e2e/import-validation.spec.ts                                         (Ticket 5)
e2e/import-csv.spec.ts                                                (Ticket 5)
e2e/export.spec.ts                                                    (Ticket 5)
e2e/fixtures/                                                         (Ticket 5)
```

### Modified Files
```
src/app/features/shop/shop.routes.ts                                  (Ticket 2 — add import route)
src/app/features/shop/shop-layout/shop-layout.component.html          (Ticket 2 — enable import link)
src/app/core/services/inventory.service.ts                            (Ticket 4 — add fetchAllFiltered)
src/app/features/shop/inventory/inventory-list/inventory-list.component.ts    (Ticket 4 — export button)
src/app/features/shop/inventory/inventory-list/inventory-list.component.html  (Ticket 4 — export menu)
```

### No New Migrations Needed
The `inventory` table and all relevant RLS policies already exist from Phase 2 migrations. Import inserts use standard `INSERT` through the existing "Members add" RLS policy. No new database changes required for Phase 7.
