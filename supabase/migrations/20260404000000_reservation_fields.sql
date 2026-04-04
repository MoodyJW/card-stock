-- Add reservation detail columns to inventory table
ALTER TABLE inventory
  ADD COLUMN reserved_by_name  TEXT,
  ADD COLUMN reserved_by_email TEXT,
  ADD COLUMN reserved_by_phone TEXT,
  ADD COLUMN reservation_notes TEXT;

COMMENT ON COLUMN inventory.reserved_by_name  IS 'Name of person who requested the hold';
COMMENT ON COLUMN inventory.reserved_by_email IS 'Optional contact email for the reserver';
COMMENT ON COLUMN inventory.reserved_by_phone IS 'Optional contact phone for the reserver';
COMMENT ON COLUMN inventory.reservation_notes IS 'Free-text notes about the reservation';
