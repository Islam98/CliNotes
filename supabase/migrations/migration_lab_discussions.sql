-- ==========================================
-- MIGRATION: Lab / internal doctor discussions
-- ==========================================

CREATE TABLE IF NOT EXISTS lab_discussion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL DEFAULT 'Internal Clinical Discussion',
  audio_path TEXT,
  transcript_text TEXT NOT NULL DEFAULT '',
  transcript_markdown TEXT DEFAULT '',
  soniox_transcription_id TEXT,
  summary_text TEXT,
  structured_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'reviewed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_discussion_participant (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discussion_id UUID REFERENCES lab_discussion(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctor(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (discussion_id, doctor_id)
);

ALTER TABLE lab_discussion ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_discussion_participant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Doctors can view own lab discussions" ON lab_discussion;
DROP POLICY IF EXISTS "Doctors can update own lab discussions" ON lab_discussion;
DROP POLICY IF EXISTS "Doctors can view own lab discussion participants" ON lab_discussion_participant;
DROP POLICY IF EXISTS "Doctors can approve own lab discussion participation" ON lab_discussion_participant;

CREATE POLICY "Doctors can view own lab discussions" ON lab_discussion
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lab_discussion_participant p
      WHERE p.discussion_id = lab_discussion.id
      AND p.doctor_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can update own lab discussions" ON lab_discussion
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lab_discussion_participant p
      WHERE p.discussion_id = lab_discussion.id
      AND p.doctor_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can view own lab discussion participants" ON lab_discussion_participant
  FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can approve own lab discussion participation" ON lab_discussion_participant
  FOR UPDATE USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

GRANT ALL ON TABLE public.lab_discussion TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lab_discussion_participant TO anon, authenticated, service_role;
