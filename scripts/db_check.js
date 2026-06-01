import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: cons } = await supabaseAdmin.from('consultation').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('--- RECENT CONSULTATIONS ---');
  console.log(cons);

  const { data: audio } = await supabaseAdmin.from('audio').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('--- RECENT AUDIO ---');
  console.log(audio);

  const { data: trans } = await supabaseAdmin.from('transcript').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('--- RECENT TRANSCRIPTS ---');
  console.log(trans);

  const { data: ai } = await supabaseAdmin.from('ai_summary').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('--- RECENT AI SUMMARIES ---');
  console.log(ai);
}

check();
