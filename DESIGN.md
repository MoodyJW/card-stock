# CardStock UI/UX Wireframes & Flow

## 1. Authentication & Onboarding (Phases 3 & 4)

### Screen: Login / Register
**Goal:** Clean, focused entry point.
**Flow:** Login -> Check `ShopContextService` -> Redirect based on membership count.

```text
+-------------------------------------------------------+
|                                                       |
|       +---------------------------------------+       |
|       |               CardStock               |       |
|       |                                       |       |
|       |  [ Email Address                    ] |       |
|       |  [ Password                         ] |       |
|       |                                       |       |
|       |       [ PRIMARY BUTTON: SIGN IN ]     |       |
|       |                                       |       |
|       |  [Link: Need an account? Register]    |       |
|       |  [Link: Forgot Password?]             |       |
|       +---------------------------------------+       |
|                                                       |
+-------------------------------------------------------+
```

### Screen: Shop Selector
**Goal:** Handle multi-tenancy. Users belonging to multiple stores must choose a context.
**Logic:**
- If user has 0 shops -> Show "Create New Store" form.
- If user has 1 shop -> Auto-skip this screen and go to Dashboard.
- If user has >1 shop -> Show list below.

```text
+-------------------------------------------------------+
|  CardStock                                   [Logout] |
|-------------------------------------------------------|
|                                                       |
|           Select a Store Context                      |
|                                                       |
|  +---------------------------+                        |
|  | Wildcat Cards             |  [ BUTTON: ENTER ]     |
|  | Role: Owner               |                        |
|  +---------------------------+                        |
|                                                       |
|  +---------------------------+                        |
|  | Pallet Town PokeShop      |  [ BUTTON: ENTER ]     |
|  | Role: Admin               |                        |
|  +---------------------------+                        |
|                                                       |
|                 --- OR ---                            |
|                                                       |
|      (Secondary Button: + Register New Store)         |
|                                                       |
+-------------------------------------------------------+
```

---

## 2. Main Navigation Layout (Phase 5)

### Desktop View (Sidebar)
**Goal:** Quick access to high-frequency admin tasks.

```text
+-------------------+-----------------------------------+
| [Logo] CardStock  |  [Global Search...]      [User v] |
|-------------------|-----------------------------------|
|                   |                                   |
|  Context:         |  +-----------------------------+  |
|  [Wildcat Cards v]|  |                             |  |
|                   |  |                             |  |
|  NAVIGATION       |  |                             |  |
|  - Dashboard      |  |      ROUTER OUTLET          |  |
|  - Inventory      |  |     (Page Content)          |  |
|  - Bounties       |  |                             |  |
|  - Settings       |  |                             |  |
|                   |  |                             |  |
|                   |  +-----------------------------+  |
|                   |                                   |
+-------------------+-----------------------------------+
```

### Mobile View (Bottom Nav)
**Goal:** Thumb-friendly navigation for walking around the physical store.

```text
+-------------------------------------------------------+
| [Menu]  Wildcat Cards v                          [🔍] |
+-------------------------------------------------------+
|                                                       |
|                                                       |
|                  ROUTER OUTLET                        |
|                                                       |
|                                                       |
+-------------------------------------------------------+
|                                                       |
|  [Dashboard]   [Inventory]   [SCAN (+)]   [More]    |
|                                                       |
+-------------------------------------------------------+
```
*Note:* The **[SCAN (+)]** button should be emphasized (FAB style) as it is the primary action on mobile.

---

## 3. Inventory Management (Phases 6, 7 & 8)

### Screen: Inventory List (Data Grid)
**Goal:** Dense information display with quick actions.

```text
+-------------------------------------------------------+
| Inventory                            [Export] [Import]|
|                                      [+ Add Card]     |
|-------------------------------------------------------|
| Filters: [Set: All v] [Cond: All v] [Search: Name...] |
|-------------------------------------------------------|
| IMG | NAME         | SET    | COND | PRICE | QTY |    |
|-----|--------------|--------|------|-------|-----|----|
| [ ] | Charizard    | Base   | NM   | $150  |  1  | [⋮]|
| [ ] | Blastoise    | Base   | LP   | $45   |  2  | [⋮]|
| [ ] | Pikachu      | Jungle | MP   | $5    |  10 | [⋮]|
|-------------------------------------------------------|
| < Prev    Page 1 of 12    Next >                      |
+-------------------------------------------------------+
```
*Note:* The `[⋮]` menu should include quick actions like "Mark Sold" or "Edit Quantity" to avoid opening the full form.

### Screen: Add / Edit Card Form
**Goal:** Rapid data entry.
**Desktop:** Two columns (Image left, Data right).
**Mobile:** Single column stack.

```text
+-------------------------------------------------------+
|  < Back to Inventory                                  |
|-------------------------------------------------------|
|  Edit Card: Charizard (Base Set)                      |
|                                                       |
|  +---------------------+  +------------------------+  |
|  |                     |  | Basic Info             |  |
|  |                     |  | [Name Input          ] |  |
|  |     IMAGE           |  | [Set Dropdown        ] |  |
|  |    PREVIEW          |  | [Language Dropdown   ] |  |
|  |                     |  |                        |  |
|  | [Upload / Camera]   |  | Pricing & Condition    |  |
|  |                     |  | [Condition Dropdown  ] |  |
|  +---------------------+  | [Qty] [Purchase Price] |  |
|                           | [List Price          ] |  |
|                           +------------------------+  |
|                                                       |
|                  [ Cancel ] [ Save Changes ]          |
+-------------------------------------------------------+
```

---

## 4. Special Flows

### Excel Import Wizard (Phase 7)
**Goal:** Map user's messy Excel columns to our clean DB schema.

```text
+-------------------------------------------------------+
| Import Inventory                                      |
|-------------------------------------------------------|
| Step 2: Map Columns                                   |
|                                                       |
| We found the following columns in your file.          |
| Please match them to CardStock fields:                |
|                                                       |
| YOUR FILE HEADER      ->      DESTINATION FIELD       |
| ----------------------------------------------------- |
| "Card Name"           ->      [ Name             v]   |
| "Expansion"           ->      [ Set              v]   |
| "How much I paid"     ->      [ Purchase Price   v]   |
| "Selling For"         ->      [ List Price       v]   |
|                                                       |
| [ Cancel ]                    [ Import 154 Cards ]    |
+-------------------------------------------------------+
```