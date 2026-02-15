# CardStock UI/UX Wireframes & Flow

## 0. Design System
**Framework:** Angular Material
**Icons:** Material Icons (Outlined)
**Styling:** Custom theme based on Material Design principles. All components should use standard Angular Material components (`<mat-card>`, `<mat-table>`, etc.) where possible to minimize custom CSS.

---

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
|  [Dashboard]   [Inventory]   [SCAN (+)]   [More]      |
|                                                       |
+-------------------------------------------------------+
```
*Note:* The **[SCAN (+)]** button should be emphasized (FAB style) as it is the primary action on mobile.

### Mobile [More] Menu (Slide-up Sheet)
**Goal:** House secondary nav items that don't fit in the bottom bar.

```text
+-------------------------------------------------------+
|                                                       |
|  +-----------------------------------------------+    |
|  |  More                                    [X]   |   |
|  |                                                |   |
|  |  🎯  Bounties                                  |   |
|  |  ⚙️   Settings                                 |   |
|  |  🔄  Switch Store                              |   |
|  |  🚪  Log Out                                   |   |
|  |                                                |   |
|  +-----------------------------------------------+    |
+-------------------------------------------------------+
```

---

## 3. Dashboard (Phase 5)

### Desktop View
**Goal:** At-a-glance shop health — what needs attention today.

```text
+--------------------------------------------------------+
| Dashboard                                              |
|--------------------------------------------------------|
|                                                        |
| +----------------+ +----------------+ +--------------+ |
| | Total Cards    | | Total Value    | | Pending      | |
| |    1,247       | |   $14,820      | | Bounties: 3  | |
| +----------------+ +----------------+ +--------------+ |
|                                                        |
| +---------------------------+ +-----------------------+|
| | Recent Activity           | | Low Stock Alerts      ||
| |---------------------------| |-----------------------||
| | • Charizard sold ($150)   | | Pikachu (Jungle) — 1  ||
| | • 42 cards imported       | | Snorlax (Base) — 0    ||
| | • Blastoise graded NM     | | Mewtwo (Base) — 2     ||
| | • New bounty from Jay M.  | |                       ||
| +---------------------------+ +-----------------------+|
|                                                        |
+-------------------------------------------------------+
```

### Mobile View
**Goal:** Same info, stacked vertically. Summary cards swipeable.

```text
+-------------------------------------------------------+
| Dashboard                                             |
|-------------------------------------------------------|
|                                                       |
| +---------------------------------------------------+ |
| |  Total Cards: 1,247  |  Value: $14,820  |  📋 3   | |
| +---------------------------------------------------+ |
|   (Horizontally scrollable summary cards)             |
|                                                       |
| Recent Activity                                       |
| +-------------------------------------------------+   |
| | • Charizard sold ($150)              2 min ago  |   |
| | • 42 cards imported                  1 hr ago   |   |
| | • Blastoise graded NM               3 hr ago    |   |
| +-------------------------------------------------+   |
|                                                       |
| Low Stock Alerts                                      |
| +-------------------------------------------------+   |
| | Pikachu (Jungle) — 1 remaining                  |   |
| | Snorlax (Base) — 0 remaining                    |   |
| +-------------------------------------------------+   |
|                                                       |
+-------------------------------------------------------+
```

---

## 4. Inventory Management (Phases 6, 7 & 8)

### Screen: Inventory List — Desktop (Data Grid)
**Goal:** Dense information display with quick actions.

```text
+-------------------------------------------------------+
| Inventory                            [Export] [Import]|
|                                      [+ Add Card]     |
|-------------------------------------------------------|
| Filters: [Set: All v] [Cond: All v] [Search: Name...] |
|-------------------------------------------------------|
| IMG | NAME         | SET    | COND | PRICE | QTY |    |
|-----|--------------|--------|------|-------|-----|-----|
| [ ] | Charizard    | Base   | NM   | $150  |  1  | [⋮]|
| [ ] | Blastoise    | Base   | LP   | $45   |  2  | [⋮]|
| [ ] | Pikachu      | Jungle | MP   | $5    |  10 | [⋮]|
|-------------------------------------------------------|
| < Prev    Page 1 of 12    Next >                      |
+-------------------------------------------------------+
```
*Note:* The `[⋮]` menu should include quick actions like "Mark Sold" or "Edit Quantity" to avoid opening the full form.

### Screen: Inventory List — Mobile (Cards)
**Goal:** Touch-friendly browsing. Card-based layout replaces data grid.

```text
+-------------------------------------------------------+
| Inventory                                    [+ Add]  |
|-------------------------------------------------------|
| [🔍 Search...         ] [Filter v]                    |
|-------------------------------------------------------|
|                                                       |
| +-------------------------------------------------+   |
| | [IMG]  Charizard                                |   |
| |        Base Set  •  NM           $150  Qty: 1   |   |
| +-------------------------------------------------+   |
|                                                       |
| +-------------------------------------------------+   |
| | [IMG]  Blastoise                                |   |
| |        Base Set  •  LP            $45  Qty: 2   |   |
| +-------------------------------------------------+   |
|                                                       |
| +-------------------------------------------------+   |
| | [IMG]  Pikachu                                  |   |
| |        Jungle  •  MP               $5  Qty: 10  |   |
| +-------------------------------------------------+   |
|                                                       |
|          [ Load More / Infinite Scroll ]              |
+-------------------------------------------------------+
```
*Note:* Tap a card to open detail/edit. Long-press or swipe for quick actions (Mark Sold, Edit Qty).

### Screen: Add / Edit Card — Desktop (Two Column)
**Goal:** Rapid data entry.

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

### Screen: Add / Edit Card — Mobile (Single Column)
**Goal:** Same form, stacked for thumb-reachable input.

```text
+-------------------------------------------------------+
|  < Back                          Edit Card            |
|-------------------------------------------------------|
|                                                       |
|  +-----------------------------------------------+   |
|  |                                               |   |
|  |              IMAGE PREVIEW                    |   |
|  |                                               |   |
|  |          [ Upload / Camera ]                  |   |
|  +-----------------------------------------------+   |
|                                                       |
|  Basic Info                                           |
|  [ Name Input                                   ]    |
|  [ Set Dropdown                                 ]    |
|  [ Language Dropdown                            ]    |
|                                                       |
|  Pricing & Condition                                  |
|  [ Condition Dropdown                           ]    |
|  [ Qty              ] [ Purchase Price          ]    |
|  [ List Price                                   ]    |
|                                                       |
|  +-----------------------------------------------+   |
|  |  [ Cancel ]              [ Save Changes ]     |   |
|  +-----------------------------------------------+   |
+-------------------------------------------------------+
```
*Note:* On mobile, the save/cancel bar should be sticky at the bottom of the viewport.

---

## 5. Special Flows

### Excel Import Wizard (Phase 7)

#### Step 1: File Upload
**Goal:** Simple drag-and-drop or file picker.

```text
+-------------------------------------------------------+
| Import Inventory                                      |
|-------------------------------------------------------|
| Step 1: Upload File                                   |
|                                                       |
|  +-----------------------------------------------+   |
|  |                                               |   |
|  |    📄  Drag & drop your .xlsx or .csv here    |   |
|  |                                               |   |
|  |          — or —                               |   |
|  |                                               |   |
|  |       [ Browse Files ]                        |   |
|  |                                               |   |
|  +-----------------------------------------------+   |
|                                                       |
|  Supported formats: .xlsx, .csv                       |
|  Max file size: 10 MB                                 |
|                                                       |
| [ Cancel ]                                            |
+-------------------------------------------------------+
```

#### Step 2: Map Columns
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

---

## 6. Bounties (Phase 9+)

### Desktop View
**Goal:** Let customers request cards the shop doesn't have. Shop staff can track and fulfill.

```text
+-------------------------------------------------------+
| Bounties                                  [+ New]     |
|-------------------------------------------------------|
| [Active (3)]   [Fulfilled (12)]   [Expired (5)]      |
|-------------------------------------------------------|
|                                                       |
| REQUESTER    | CARD WANTED        | BUDGET | STATUS   |
|--------------|--------------------| -------|----------|
| Jay M.       | Charizard VMAX     | $200   | 🟡 Open  |
| Sarah K.     | Pikachu Gold Star  | $500   | 🟡 Open  |
| Mike D.      | Blastoise (Base)   | $80    | 🟢 Found |
|-------------------------------------------------------|
```

### Mobile View (Cards)

```text
+-------------------------------------------------------+
| Bounties                                     [+ New]  |
|-------------------------------------------------------|
| [Active (3)]   [Fulfilled]   [Expired]               |
|-------------------------------------------------------|
|                                                       |
| +-------------------------------------------------+   |
| | 🟡  Charizard VMAX                              |   |
| |     Jay M.  •  Budget: $200          Open       |   |
| +-------------------------------------------------+   |
|                                                       |
| +-------------------------------------------------+   |
| | 🟡  Pikachu Gold Star                           |   |
| |     Sarah K.  •  Budget: $500        Open       |   |
| +-------------------------------------------------+   |
|                                                       |
| +-------------------------------------------------+   |
| | 🟢  Blastoise (Base)                            |   |
| |     Mike D.  •  Budget: $80          Found      |   |
| +-------------------------------------------------+   |
|                                                       |
+-------------------------------------------------------+
```

---

## 7. Settings (Phase 5)

### Desktop View
**Goal:** Store configuration and team management.

```text
+-------------------------------------------------------+
| Settings                                              |
|-------------------------------------------------------|
|                                                       |
| +-------------+ +-----------------------------------+ |
| | SECTIONS    | |                                   | |
| |             | | Store Details                     | |
| | Store       | |-----------------------------------| |
| | Team        | | Store Name: [ Wildcat Cards     ] | |
| | Billing     | | Location:   [ Lexington, KY     ] | |
| | Account     | | Currency:   [ USD              v] | |
| |             | |                                   | |
| |             | |         [ Save Changes ]          | |
| |             | |                                   | |
| +-------------+ +-----------------------------------+ |
|                                                       |
+-------------------------------------------------------+
```

### Settings: Team Management (Sub-section)

```text
+-------------------------------------------------------+
| Settings > Team                                       |
|-------------------------------------------------------|
|                                                       |
| Team Members                         [+ Invite]       |
|                                                       |
| NAME             | EMAIL              | ROLE    |     |
|------------------|--------------------|---------|-----|
| Jay Walker       | jay@wildcat.com    | Owner   |     |
| Sarah Kim        | sarah@wildcat.com  | Admin   | [⋮] |
| Mike Davis       | mike@wildcat.com   | Member  | [⋮] |
|-------------------------------------------------------|
|                                                       |
| Pending Invites                                       |
| +-------------------------------------------------+   |
| | alex@example.com  •  Role: Member  •  Sent 2d   |   |
| |                         [ Resend ] [ Revoke ]   |   |
| +-------------------------------------------------+   |
|                                                       |
+-------------------------------------------------------+
```

### Mobile View
**Goal:** Stacked sections, tap to expand.

```text
+-------------------------------------------------------+
| Settings                                              |
|-------------------------------------------------------|
|                                                       |
| +-------------------------------------------------+   |
| | 🏪  Store Details                            >  |   |
| +-------------------------------------------------+   |
| | 👥  Team Members (3)                         >  |   |
| +-------------------------------------------------+   |
| | 💳  Billing                                  >  |   |
| +-------------------------------------------------+   |
| | 👤  Account                                  >  |   |
| +-------------------------------------------------+   |
|                                                       |
+-------------------------------------------------------+
```
*Note:* Each row navigates to a full-screen sub-page on mobile rather than inline expansion.