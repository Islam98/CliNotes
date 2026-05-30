-- Clean slate: Drop existing tables and triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS transcript CASCADE;
DROP TABLE IF EXISTS booking CASCADE;
DROP TABLE IF EXISTS highlight CASCADE;
DROP TABLE IF EXISTS doctor_recommendation CASCADE;
DROP TABLE IF EXISTS ai_summary CASCADE;
DROP TABLE IF EXISTS audio CASCADE;
DROP TABLE IF EXISTS consultation CASCADE;
DROP TABLE IF EXISTS patient_profile CASCADE;
DROP TABLE IF EXISTS doctor CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES TABLE
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'patient')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCTOR TABLE
CREATE TABLE doctor (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PATIENT PROFILE TABLE
CREATE TABLE patient_profile (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONSULTATION MODEL
CREATE TABLE consultation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID REFERENCES doctor(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patient_profile(id) ON DELETE CASCADE,
  date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'reviewed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIO STORAGE METADATA
CREATE TABLE audio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES consultation(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI SUMMARY MODEL
CREATE TABLE ai_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES consultation(id) ON DELETE CASCADE,
  summary_text TEXT,
  structured_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCTOR RECOMMENDATIONS
CREATE TABLE doctor_recommendation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES consultation(id) ON DELETE CASCADE,
  recommendations_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HIGHLIGHTS (SMART MOMENT CAPTURE)
CREATE TABLE highlight (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES consultation(id) ON DELETE CASCADE,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRANSCRIPT (Soniox Audio Transcription)
CREATE TABLE transcript (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID REFERENCES consultation(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL DEFAULT '',
  transcript_markdown TEXT DEFAULT '',
  soniox_transcription_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOOKING TABLE
CREATE TABLE booking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID REFERENCES doctor(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patient_profile(id) ON DELETE CASCADE,
  appointment_time TIMESTAMPTZ NOT NULL,
  reason_text TEXT,
  reason_audio_path TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
-- Re-enable RLS on all tables to lock them down securely.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Doctor: Doctors can view their own record
CREATE POLICY "Doctors can view own record" ON doctor
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Patients can view doctors for booking" ON doctor
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'patient'
    )
  );

-- Patient Profile: Patients can view own record, Doctors can view their patients
CREATE POLICY "Patients can view own record" ON patient_profile
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Doctors can view their patients" ON patient_profile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM consultation c
      WHERE c.patient_id = patient_profile.id
      AND c.doctor_id = auth.uid()
    )
  );

-- Consultation:
CREATE POLICY "Patients can view own consultations" ON consultation
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can manage own consultations" ON consultation
  FOR ALL USING (auth.uid() = doctor_id);

-- Audio:
CREATE POLICY "Patients can view own consultation audio" ON audio
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM consultation c WHERE c.id = audio.consultation_id AND c.patient_id = auth.uid())
  );

CREATE POLICY "Doctors can manage own consultation audio" ON audio
  FOR ALL USING (
    EXISTS (SELECT 1 FROM consultation c WHERE c.id = audio.consultation_id AND c.doctor_id = auth.uid())
  );

-- AI Summary:
CREATE POLICY "Patients can view own summaries" ON ai_summary
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM consultation c WHERE c.id = ai_summary.consultation_id AND c.patient_id = auth.uid())
  );

CREATE POLICY "Doctors can manage own summaries" ON ai_summary
  FOR ALL USING (
    EXISTS (SELECT 1 FROM consultation c WHERE c.id = ai_summary.consultation_id AND c.doctor_id = auth.uid())
  );

-- Doctor Recommendation:
CREATE POLICY "Patients can view own recommendations" ON doctor_recommendation
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM consultation c WHERE c.id = doctor_recommendation.consultation_id AND c.patient_id = auth.uid())
  );

CREATE POLICY "Doctors can manage own recommendations" ON doctor_recommendation
  FOR ALL USING (
    EXISTS (SELECT 1 FROM consultation c WHERE c.id = doctor_recommendation.consultation_id AND c.doctor_id = auth.uid())
  );

-- Highlight:
CREATE POLICY "Patients can view highlights" ON highlight
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM consultation c WHERE c.id = highlight.consultation_id AND c.patient_id = auth.uid())
  );

CREATE POLICY "Doctors can manage highlights" ON highlight
  FOR ALL USING (
    EXISTS (SELECT 1 FROM consultation c WHERE c.id = highlight.consultation_id AND c.doctor_id = auth.uid())
  );

-- Booking:
CREATE POLICY "Patients can view own bookings" ON booking
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create own bookings" ON booking
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can manage own bookings" ON booking
  FOR ALL USING (auth.uid() = doctor_id);

-- Doctors can search all patients (for dashboard search)
CREATE POLICY "Doctors can search all patients" ON patient_profile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );

-- Doctors can view all consultations (for patient profile view)
CREATE POLICY "Doctors can view patient consultations" ON consultation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );

-- Doctors can view all AI summaries
CREATE POLICY "Doctors can view all summaries" ON ai_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );

-- Doctors can view all recommendations
CREATE POLICY "Doctors can view all recommendations" ON doctor_recommendation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );

-- Transcript:
CREATE POLICY "Patients can view own transcripts" ON transcript
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM consultation c
      WHERE c.id = transcript.consultation_id
      AND c.patient_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can manage own transcripts" ON transcript
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM consultation c
      WHERE c.id = transcript.consultation_id
      AND c.doctor_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can view all transcripts" ON transcript
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'doctor'
    )
  );

-- ==========================================
-- SECURE REGISTRATION TRIGGER (THE FIX!)
-- ==========================================
-- This completely bypasses the client-side permission denied error by inserting the profiles 
-- as a Postgres superuser (SECURITY DEFINER) immediately when an auth.user is created.
-- No more frontend RLS inserts needed for signup!

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_age INTEGER;
BEGIN
  -- Insert base profile
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, new.raw_user_meta_data->>'role');

  -- Insert specific profile
  IF new.raw_user_meta_data->>'role' = 'doctor' THEN
    INSERT INTO public.doctor (id, doctor_id, name, specialty)
    VALUES (
      new.id, 
      new.raw_user_meta_data->>'doctorId', 
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'specialty'
    );
  ELSIF new.raw_user_meta_data->>'role' = 'patient' THEN
    -- Parse age safely
    BEGIN
      v_age := (new.raw_user_meta_data->>'age')::integer;
    EXCEPTION WHEN OTHERS THEN
      v_age := NULL;
    END;

    INSERT INTO public.patient_profile (id, name, age, gender)
    VALUES (
      new.id, 
      new.raw_user_meta_data->>'name',
      v_age,
      new.raw_user_meta_data->>'gender'
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- GRANT PRIVILEGES
-- ==========================================
-- Ensure the API roles have access to the new tables
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.doctor TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.patient_profile TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.consultation TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.audio TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_summary TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.doctor_recommendation TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.highlight TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.transcript TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.booking TO anon, authenticated, service_role;

-- STORAGE POLICIES (For the private 'consultation-audio' bucket)
-- Note: These run against the storage.objects table to allow file uploads.

DROP POLICY IF EXISTS "Allow authenticated inserts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- 1. Allow authenticated doctors to insert audio files
CREATE POLICY "Allow authenticated inserts" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'consultation-audio');

-- 2. Allow authenticated users to select/read files
CREATE POLICY "Allow authenticated reads" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'consultation-audio');

-- 3. Allow authenticated users to update/delete (if needed)
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'consultation-audio');

CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'consultation-audio');
