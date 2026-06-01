-- ==========================================
-- MIGRATION: Patient booking flow
-- ==========================================

ALTER TABLE booking
  ADD COLUMN IF NOT EXISTS reason_text TEXT,
  ADD COLUMN IF NOT EXISTS reason_audio_path TEXT;

ALTER TABLE booking DROP CONSTRAINT IF EXISTS booking_status_check;
ALTER TABLE booking
  ADD CONSTRAINT booking_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));

DROP POLICY IF EXISTS "Patients can view doctors for booking" ON doctor;
DROP POLICY IF EXISTS "Patients can create own bookings" ON booking;

CREATE POLICY "Patients can view doctors for booking" ON doctor
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'patient'
    )
  );

CREATE POLICY "Patients can create own bookings" ON booking
  FOR INSERT WITH CHECK (auth.uid() = patient_id);
