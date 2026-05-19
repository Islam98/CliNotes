-- ==========================================
-- MIGRATION: Add Transcript Table for Soniox Transcriptions
-- ==========================================

CREATE TABLE IF NOT EXISTS transcript (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES consultation(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL DEFAULT '',
  transcript_markdown TEXT DEFAULT '',
  soniox_transcription_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE transcript ENABLE ROW LEVEL SECURITY;

-- Patients can view transcripts for their own consultations
CREATE POLICY "Patients can view own transcripts" ON transcript
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM consultation c
      WHERE c.id = transcript.consultation_id
      AND c.patient_id = auth.uid()
    )
  );

-- Doctors can manage transcripts for their consultations
CREATE POLICY "Doctors can manage own transcripts" ON transcript
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM consultation c
      WHERE c.id = transcript.consultation_id
      AND c.doctor_id = auth.uid()
    )
  );

-- Doctors can view all transcripts (for patient profile view)
CREATE POLICY "Doctors can view all transcripts" ON transcript
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );

-- Grant access to API roles
GRANT ALL ON TABLE public.transcript TO anon, authenticated, service_role;
