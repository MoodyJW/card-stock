# Phase 9: Enhancements & Polish

> Running list of improvement ideas to revisit after core features are complete.
> Add items here instead of derailing current work.

---

## 1. Reserve Card Dialog

Currently, reserve/unreserve is a simple toggle. Replace with a dialog that captures:

- **Reserver name** — who requested the hold
- **Email** — optional contact
- **Phone** — optional contact
- **Notes** — free-text (e.g. "picking up Saturday", "waiting on paycheck")
- Unreserving should clear the reservation details

This likely requires a `reservations` table or additional columns on `inventory` (e.g. `reserved_by_name`, `reserved_by_email`, `reserved_by_phone`, `reservation_notes`).

## 2. Foil Column in Inventory Table

The card grid already shows a foil indicator, but the table view does not. Add a "Foil" column (or icon badge in the card name cell) to the `mat-table` so foil status is visible without switching to grid view.

## 3. Improve grid cards layout

The grid cards are a bit cramped, might need to increase size or reorganize contents. Standardize size and content positioning for consistency between cards (currently buttons and content can be in different places)
