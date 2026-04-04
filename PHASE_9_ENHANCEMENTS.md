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

## 4. Improve mobile import wizard layout

The import wizard is not mobile friendly. The stepper labels are not entirely visible on mobile. Perhaps use a vertical stepper instead of horizontal or something like that. Will require some investigation for solutions.

## 5. Dashboard

Improve dashboard, add features like recent activity, sales, inventory value, etc.


## 6. Guest/Demo Mode

Add guest/demo mode that does not require login. Potentially save an id or something locally and if they DO create an account, the data they entered could still be associated with their account. This would allow users to try out the app without creating an account.

## 7. Improve add/edit form

- Add all sets and require the chosen set to match an option in the autocomplete.
- Make card number numeric and provide the total number of cards as a static value. So if a set has 150 cards, the input would be a number and the total would just show next to the input as "/150" or something similar.
- Make rarity an autocomplete with all rarity options based on the set
- Ensure language options are complete
- Ensure condition options are accurate according to various grading sites
- Ensure all grading companies are listed

## 8. Add image upload for avatar

- Add image upload for avatar

## 9. Expand shop settings

- Add edit shop name if possible
- Add edit shop slug if possible
- Add edit shop description if possible

## 9. Improve grid view pagination and filters on mobile

- on small devices the grid view pagination/filters takes up a lot of space and should be made more minimal
- potentially convert paginator into a popover with a button in the same row as the title or maybe where filters are now
- potentially convert filters into a popover with a button in the same row as the title
- add sorting options (price, rarity, etc.)