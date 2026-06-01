-- 1. Fix the CHECK constraint so 'processing' is allowed
ALTER TABLE consultation DROP CONSTRAINT IF EXISTS consultation_status_check;
ALTER TABLE consultation ADD CONSTRAINT consultation_status_check CHECK (status IN ('pending', 'processing', 'processed', 'reviewed'));

-- 2. Inject a mock processed consultation for testing
DO $$
DECLARE
  v_doctor_id UUID;
  v_patient_id UUID := '99999999-9999-9999-9999-999999999999';
  v_cons_id UUID;
BEGIN
  -- Get the first available doctor
  SELECT id INTO v_doctor_id FROM doctor LIMIT 1;
  
  IF v_doctor_id IS NOT NULL THEN
    -- Insert consultation
    INSERT INTO consultation (doctor_id, patient_id, status)
    VALUES (v_doctor_id, v_patient_id, 'processed')
    RETURNING id INTO v_cons_id;

    -- Insert mock AI summary
    INSERT INTO ai_summary (consultation_id, doctor_id, structured_data)
    VALUES (
      v_cons_id, 
      v_doctor_id, 
      '{
        "title": "Routine Checkup - Hypertension Follow-up",
        "subjective": {
          "chief_complaint": "Patient complains of occasional mild headaches in the morning.",
          "history": "History of hypertension for 5 years. Currently on Lisinopril 10mg daily.",
          "allergies": ["Penicillin", "Peanuts"]
        },
        "objective": {
          "vitals": "BP: 135/85 mmHg, HR: 78 bpm, Temp: 37.0 C, Wt: 82 kg",
          "physical_exam": "Heart sounds normal, no murmurs. Lungs clear to auscultation bilaterally. No peripheral edema."
        },
        "assessment": {
          "diagnoses": ["Essential hypertension, moderately controlled", "Tension headache"]
        },
        "plan": {
          "treatment": ["Continue Lisinopril 10mg daily", "Start lifestyle modifications: reduce sodium intake", "Prescribed Paracetamol 500mg PRN for headaches"],
          "follow_up": "Return to clinic in 3 months with home blood pressure logs."
        }
      }'::jsonb
    );
  END IF;
END $$;
