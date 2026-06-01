-- ==========================================
-- MIGRATION: Allow no-show booking status
-- ==========================================

ALTER TABLE booking DROP CONSTRAINT IF EXISTS booking_status_check;
ALTER TABLE booking
  ADD CONSTRAINT booking_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));
