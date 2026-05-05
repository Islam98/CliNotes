-- ==========================================
-- MIGRATION: Allow Doctors to Search All Patients
-- ==========================================
-- This policy allows any authenticated doctor to search/view patient profiles.
-- Required for the patient search feature on the doctor's dashboard.

-- Allow doctors to view all patient profiles (for search)
CREATE POLICY "Doctors can search all patients" ON patient_profile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );

-- Allow doctors to view all consultations for patients they're viewing
-- (needed for patient profile page to load consultation history)
CREATE POLICY "Doctors can view patient consultations" ON consultation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );

-- Allow doctors to view AI summaries for consultations they can see
CREATE POLICY "Doctors can view all summaries" ON ai_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );

-- Allow doctors to view recommendations for consultations they can see
CREATE POLICY "Doctors can view all recommendations" ON doctor_recommendation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );
