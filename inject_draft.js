import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function injectDraft() {
  try {
    // 1. Get first doctor
    const { data: doctors } = await supabaseAdmin.from('doctor').select('id').limit(1);
    if (!doctors || doctors.length === 0) {
      console.log('No doctors found');
      return;
    }
    const doctorId = doctors[0].id;
    const patientId = '99999999-9999-9999-9999-999999999999';

    // 2. Insert consultation
    const { data: cons, error: consErr } = await supabaseAdmin.from('consultation').insert([{
      doctor_id: doctorId,
      patient_id: patientId,
      status: 'processed'
    }]).select().single();

    if (consErr) throw consErr;

    // 3. Insert ai_summary
    const mockData = {
      title: "Routine Checkup - Hypertension Follow-up",
      subjective: {
        chief_complaint: "Patient complains of occasional mild headaches in the morning.",
        history: "History of hypertension for 5 years. Currently on Lisinopril 10mg daily.",
        allergies: ["Penicillin", "Peanuts"]
      },
      objective: {
        vitals: "BP: 135/85 mmHg, HR: 78 bpm, Temp: 37.0 C, Wt: 82 kg",
        physical_exam: "Heart sounds normal, no murmurs. Lungs clear to auscultation bilaterally. No peripheral edema."
      },
      assessment: {
        diagnoses: ["Essential hypertension, moderately controlled", "Tension headache"]
      },
      plan: {
        treatment: ["Continue Lisinopril 10mg daily", "Start lifestyle modifications: reduce sodium intake", "Prescribed Paracetamol 500mg PRN for headaches"],
        follow_up: "Return to clinic in 3 months with home blood pressure logs."
      }
    };

    const { error: summaryErr } = await supabaseAdmin.from('ai_summary').insert([{
      consultation_id: cons.id,
      doctor_id: doctorId,
      structured_data: mockData
    }]);

    if (summaryErr) throw summaryErr;

    console.log('Successfully injected draft notes for review!');
  } catch (err) {
    console.error('Error injecting draft:', err);
  }
}

injectDraft();
