import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── OpenAI Client (Commented out for testing) ───
// const apiKey = process.env.OPENAI_API_KEY;
// let openai;
// if (apiKey && apiKey !== 'your_openai_api_key_here') {
//   openai = new OpenAI({ apiKey });
// }

// ─── Gemini Client ───
const geminiApiKey = process.env.GEMINI_API_KEY;
let gemini;
if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
  gemini = new GoogleGenerativeAI(geminiApiKey);
}

// ─── Supabase Admin Client (bypasses RLS) ───
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseAdmin;
if (supabaseUrl && supabaseServiceKey && supabaseServiceKey !== 'your_supabase_service_role_key_here') {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
}

// ─── Soniox Config ───
const SONIOX_API_KEY = process.env.SONIOX_API_KEY;
const SONIOX_API_BASE = 'https://api.soniox.com';

// ==========================================
// Soniox Helper Functions
// ==========================================

async function sonioxFetch(endpoint, { method = 'GET', body, headers = {} } = {}) {
  if (!SONIOX_API_KEY || SONIOX_API_KEY === 'your_soniox_api_key_here') {
    throw new Error('SONIOX_API_KEY is not configured.');
  }

  const res = await fetch(`${SONIOX_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${SONIOX_API_KEY}`,
      ...headers,
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Soniox API error (${res.status}): ${errText}`);
  }

  return method !== 'DELETE' ? res.json() : null;
}

async function uploadToSoniox(audioBuffer, filename) {
  const form = new FormData();
  form.append('file', new Blob([audioBuffer]), filename);
  form.append('client_reference_id', 'clinotes-consultation');

  return sonioxFetch('/v1/files', { method: 'POST', body: form });
}

function buildTranscriptionConfig(fileId) {
  return {
    model: 'stt-async-v4',
    file_id: fileId,
    // Enable speaker diarization to separate doctor vs patient
    enable_speaker_diarization: true,
    // Enable language identification per token
    enable_language_identification: true,

    // ─── Language Hints ───
    // Tells Soniox which languages to expect in the audio.
    // Setting this significantly improves accuracy.
    // ISO 639-1 codes: 'en' = English, 'ar' = Arabic
    language_hints: ['en', 'ar'],

    // ─── Context ───
    // Soniox uses context to improve transcription accuracy
    // for domain-specific vocabulary, names, and abbreviations.
    //
    // You can customize these fields:
    //
    //   general:  Key-value pairs giving Soniox structured info about
    //             the recording (domain, topic, speaker names, etc.)
    //
    //   text:     Free-form paragraph describing what the audio is about.
    //             The more specific, the better the accuracy.
    //
    //   terms:    Array of specialized words/phrases that might appear.
    //             Soniox will boost recognition of these exact terms.
    //
    context: {
      general: [
        { key: 'domain', value: 'Healthcare / Clinical Medicine' },
        { key: 'topic', value: 'Doctor-patient clinical consultation' },
        { key: 'setting', value: 'Medical clinic or hospital outpatient department' },
        { key: 'languages', value: 'English and Arabic, possibly mixed within sentences' },
      ],
      text: `This is a clinical consultation recording between a healthcare provider (doctor) 
and a patient. The conversation may switch between English and Arabic. It typically includes: 
medical history discussion, symptom assessment and chief complaint, review of systems, 
physical examination findings, diagnosis discussion, treatment planning, medication 
prescriptions, and follow-up scheduling. Medical terminology may appear in English even 
when the rest of the conversation is in Arabic.`,
      terms: [
        // Vitals & measurements
        'hypertension', 'hypotension', 'tachycardia', 'bradycardia',
        'systolic', 'diastolic', 'mmHg', 'mg/dL', 'bpm',
        // Common conditions
        'diabetes', 'diabetes mellitus', 'cholesterol', 'hyperlipidemia',
        'asthma', 'COPD', 'pneumonia', 'anemia', 'thyroid',
        // Diagnostics
        'ECG', 'EKG', 'CBC', 'MRI', 'CT scan', 'X-ray', 'ultrasound',
        'hemoglobin', 'A1C', 'HbA1c', 'creatinine', 'TSH',
        // Clinical terms
        'prescription', 'prognosis', 'differential diagnosis',
        'auscultation', 'palpation', 'bilateral', 'edema',
        'chief complaint', 'history of present illness', 'review of systems',
        // Common medications
        'Metformin', 'Lisinopril', 'Amlodipine', 'Omeprazole',
        'Amoxicillin', 'Paracetamol', 'Ibuprofen', 'Aspirin',
      ],
    },
    client_reference_id: 'clinotes',
  };
}

async function createTranscription(config) {
  return sonioxFetch('/v1/transcriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

async function waitForTranscription(transcriptionId, maxWaitMs = 300000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const res = await sonioxFetch(`/v1/transcriptions/${transcriptionId}`);
    if (res.status === 'completed') return res;
    if (res.status === 'error') {
      throw new Error(`Soniox transcription failed: ${res.error_message || 'Unknown error'}`);
    }
    // Poll every 2 seconds
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Transcription timed out after 5 minutes.');
}

async function getTranscript(transcriptionId) {
  return sonioxFetch(`/v1/transcriptions/${transcriptionId}/transcript`);
}

async function cleanupSoniox(transcriptionId, fileId) {
  try {
    if (transcriptionId) await sonioxFetch(`/v1/transcriptions/${transcriptionId}`, { method: 'DELETE' });
  } catch (e) { console.warn('Failed to delete Soniox transcription:', e.message); }
  try {
    if (fileId) await sonioxFetch(`/v1/files/${fileId}`, { method: 'DELETE' });
  } catch (e) { console.warn('Failed to delete Soniox file:', e.message); }
}

// ==========================================
// Render Transcript as Markdown
// ==========================================

function renderTranscriptMarkdown(tokens, transcriptionMeta = {}) {
  const lines = [];
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Header
  lines.push('# Clinical Consultation Transcript');
  lines.push('');
  lines.push(`**Date:** ${date}`);
  if (transcriptionMeta.audio_duration_ms) {
    const durationSec = Math.round(transcriptionMeta.audio_duration_ms / 1000);
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    lines.push(`**Duration:** ${mins}m ${secs}s`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Render tokens with speaker diarization
  let currentSpeaker = null;
  let currentText = [];

  function flushSpeaker() {
    if (currentText.length > 0 && currentSpeaker !== null) {
      const label = `**Speaker ${currentSpeaker}**`;
      lines.push(`${label}:`);
      lines.push('');
      lines.push(`> ${currentText.join('').trim()}`);
      lines.push('');
    }
    currentText = [];
  }

  for (const token of tokens) {
    const speaker = token.speaker;

    if (speaker !== undefined && speaker !== currentSpeaker) {
      flushSpeaker();
      currentSpeaker = speaker;
    }

    currentText.push(token.text);
  }
  flushSpeaker(); // Flush last speaker

  // If no speaker diarization was available, just output plain text
  if (lines.length <= 6) {
    const plainText = tokens.map(t => t.text).join('');
    lines.push(plainText);
  }

  lines.push('');
  lines.push('---');
  lines.push('*Transcribed by Soniox AI • CliNotes*');

  return lines.join('\n');
}

// ==========================================
// API ROUTES
// ==========================================

// ─── New: Raw Audio Upload Endpoint (Bypass RLS) ───
app.post('/api/upload-audio/:consultationId', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '50mb' }), async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const { consultationId } = req.params;
  const audioBuffer = req.body;

  if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
    return res.status(400).json({ error: 'No audio data received.' });
  }

  const fileName = `${consultationId}/${Date.now()}.webm`;

  try {
    // 1. Upload to storage using service_role to bypass RLS
    let { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('consultation-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/webm',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      // If bucket doesn't exist, try to create it and retry once
      if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('bucket')) {
        await supabaseAdmin.storage.createBucket('consultation-audio', { public: false });
        const { data: retryData, error: retryError } = await supabaseAdmin.storage
          .from('consultation-audio')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/webm',
            cacheControl: '3600',
            upsert: false
          });
        
        if (retryError) throw retryError;
        uploadData = retryData;
      } else {
        throw uploadError;
      }
    }

    // 2. Insert metadata into audio table using service_role
    const { data: metadataData, error: metadataError } = await supabaseAdmin
      .from('audio')
      .insert([{
        consultation_id: consultationId,
        file_path: uploadData.path || fileName
      }])
      .select()
      .single();

    if (metadataError) throw metadataError;

    res.json(metadataData);
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Gemini Analysis Helper
// ==========================================
// async function analyzeTranscriptWithOpenAI(transcriptText) {
//   if (!openai) {
//     throw new Error("OpenAI API key is missing or invalid on the server.");
//   }
//   ... (commented out)
// }

async function analyzeTranscriptWithGemini(transcriptText) {
  if (!gemini) {
    throw new Error("Gemini API key is missing or invalid on the server.");
  }

  const systemPrompt = `
You are a highly skilled medical AI assistant. Your task is to analyze clinical consultation transcripts conducted in code-switched Arabic-English and extract key medical information in a structured SOAP (Subjective, Objective, Assessment, Plan) format.
Please analyze the provided text and output a JSON object with the following structure:
{
  "summary_text": "A brief 2-3 sentence summary of the overall consultation.",
  "structured_data": {
    "title": "A short, descriptive title for this consultation",
    "subjective": {
      "chief_complaint": "The patient's main reason for the visit",
      "history": "Relevant medical history mentioned",
      "allergies": "Any allergies discussed",
      "notes": "Other subjective observations"
    },
    "objective": {
      "vitals": {
        "blood_pressure": "e.g., 120/80",
        "heart_rate": "e.g., 75 bpm",
        "temperature": "e.g., 98.6 F"
      },
      "examination": "Physical examination findings"
    },
    "assessment": {
      "diagnoses": ["list", "of", "suspected", "or", "confirmed", "diagnoses"],
      "reasoning": "Clinical reasoning or thoughts from the doctor"
    },
    "plan": [
      { "label": "Medication", "value": "Prescribed medication details" },
      { "label": "Test", "value": "Lab or imaging orders" },
      { "label": "Follow-up", "value": "When to return" }
    ]
  }
}
If any specific fields are not mentioned in the transcript, omit them or leave them as null/empty strings.
Ensure the output is strictly valid JSON and nothing else.
`;

  const model = gemini.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    }
  });

  const response = await model.generateContent(transcriptText);
  return JSON.parse(response.response.text());
}

// ─── Existing: Analyze Transcript Endpoint ───
app.post('/api/analyze-transcript', async (req, res) => {
  const { transcriptText } = req.body;
  if (!transcriptText) {
    return res.status(400).json({ error: "Transcript text is required." });
  }

  try {
    const resultJson = await analyzeTranscriptWithGemini(transcriptText);
    res.json(resultJson);
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    res.status(500).json({ error: error.message || "Failed to analyze transcript." });
  }
});

// ─── New: Transcribe Consultation Audio with Soniox ───
app.post('/api/transcribe', async (req, res) => {
  // Validate prerequisites
  if (!SONIOX_API_KEY || SONIOX_API_KEY === 'your_soniox_api_key_here') {
    return res.status(500).json({ error: 'Soniox API key is not configured on the server.' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured. Check SUPABASE_SERVICE_ROLE_KEY.' });
  }

  const { consultationId } = req.body;
  if (!consultationId) {
    return res.status(400).json({ error: 'consultationId is required.' });
  }

  let sonioxFileId = null;
  let sonioxTranscriptionId = null;

  try {
    console.log(`[Transcribe] Starting transcription for consultation: ${consultationId}`);

    // 1. Get the audio file path from the database
    const { data: audioRecord, error: audioError } = await supabaseAdmin
      .from('audio')
      .select('file_path')
      .eq('consultation_id', consultationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (audioError || !audioRecord) {
      return res.status(404).json({ error: 'No audio file found for this consultation.' });
    }

    console.log(`[Transcribe] Found audio file: ${audioRecord.file_path}`);

    // 2. Download the audio from Supabase Storage
    const { data: audioData, error: downloadError } = await supabaseAdmin.storage
      .from('consultation-audio')
      .download(audioRecord.file_path);

    if (downloadError || !audioData) {
      return res.status(500).json({ error: `Failed to download audio: ${downloadError?.message || 'Unknown error'}` });
    }

    const audioBuffer = Buffer.from(await audioData.arrayBuffer());
    console.log(`[Transcribe] Downloaded audio: ${audioBuffer.length} bytes`);

    // 3. Create a pending transcript record
    const { data: transcriptRecord, error: insertError } = await supabaseAdmin
      .from('transcript')
      .insert([{
        consultation_id: consultationId,
        transcript_text: '',
        transcript_markdown: '',
        status: 'processing',
      }])
      .select()
      .single();

    if (insertError) {
      console.error('[Transcribe] Failed to create transcript record:', insertError);
      return res.status(500).json({ error: 'Failed to create transcript record.' });
    }

    // Return immediately with the transcript ID — transcription continues in background
    res.json({
      message: 'Transcription started.',
      transcriptId: transcriptRecord.id,
      status: 'processing',
    });

    // ─── Background Processing ───
    (async () => {
      try {
        // 4. Upload to Soniox
        const filename = audioRecord.file_path.split('/').pop() || 'consultation.webm';
        console.log(`[Transcribe] Uploading to Soniox as: ${filename}`);
        const uploadResult = await uploadToSoniox(audioBuffer, filename);
        sonioxFileId = uploadResult.id;
        console.log(`[Transcribe] Soniox file ID: ${sonioxFileId}`);

        // 5. Create transcription job
        const config = buildTranscriptionConfig(sonioxFileId);
        const transcription = await createTranscription(config);
        sonioxTranscriptionId = transcription.id;
        console.log(`[Transcribe] Soniox transcription ID: ${sonioxTranscriptionId}`);

        // Update transcript record with Soniox ID
        await supabaseAdmin
          .from('transcript')
          .update({ soniox_transcription_id: sonioxTranscriptionId })
          .eq('id', transcriptRecord.id);

        // 6. Wait for completion
        console.log('[Transcribe] Waiting for Soniox to complete...');
        const completedMeta = await waitForTranscription(sonioxTranscriptionId);
        console.log('[Transcribe] Transcription completed!');

        // 7. Get the transcript text and tokens
        const transcriptResult = await getTranscript(sonioxTranscriptionId);
        const plainText = transcriptResult.text;
        const markdownText = renderTranscriptMarkdown(transcriptResult.tokens, completedMeta);

        console.log(`[Transcribe] Transcript length: ${plainText.length} chars`);

        // 8. Save to database
        await supabaseAdmin
          .from('transcript')
          .update({
            transcript_text: plainText,
            transcript_markdown: markdownText,
            status: 'completed',
          })
          .eq('id', transcriptRecord.id);

        console.log(`[Transcribe] ✓ Saved transcript for consultation ${consultationId}`);

        // 9. Run Gemini Analysis automatically
        if (gemini && plainText.trim().length > 10) {
          console.log(`[Transcribe] Starting Gemini analysis for consultation ${consultationId}...`);
          try {
            const aiResult = await analyzeTranscriptWithGemini(plainText);

            // Insert into ai_summary table
            const { error: aiError } = await supabaseAdmin
              .from('ai_summary')
              .insert([{
                consultation_id: consultationId,
                summary_text: aiResult.summary_text || "Analysis completed.",
                structured_data: aiResult.structured_data || {}
              }]);

            if (aiError) {
              console.error('[Transcribe] Error saving AI summary to database:', aiError);
            } else {
              console.log(`[Transcribe] ✓ Saved AI summary for consultation ${consultationId}`);
            }
          } catch (aiErr) {
            console.error('[Transcribe] Gemini Analysis failed:', aiErr);

            // We don't abort the whole flow, the transcript was already saved successfully.
          }
        }

        // 10. Update consultation status to 'processed'
        await supabaseAdmin
          .from('consultation')
          .update({ status: 'processed' })
          .eq('id', consultationId);

        // 10. Cleanup Soniox resources
        await cleanupSoniox(sonioxTranscriptionId, sonioxFileId);

      } catch (bgError) {
        console.error('[Transcribe] Background processing error:', bgError);

        // Mark transcript as error
        await supabaseAdmin
          .from('transcript')
          .update({
            status: 'error',
            error_message: bgError.message,
          })
          .eq('id', transcriptRecord.id);

        // Cleanup Soniox on error
        await cleanupSoniox(sonioxTranscriptionId, sonioxFileId);
      }
    })();

  } catch (error) {
    console.error('[Transcribe] Error:', error);
    res.status(500).json({ error: `Transcription failed: ${error.message}` });
  }
});

// ─── New: Get Transcript Status ───
app.get('/api/transcribe/:consultationId', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const { consultationId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('transcript')
      .select('*')
      .eq('consultation_id', consultationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No transcript found for this consultation.' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`  Soniox: ${SONIOX_API_KEY && SONIOX_API_KEY !== 'your_soniox_api_key_here' ? '✓ configured' : '✗ missing'}`);
  // console.log(`  OpenAI: ${apiKey && apiKey !== 'your_openai_api_key_here' ? '✓ configured' : '✗ missing'}`);
  console.log(`  Gemini: ${geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here' ? '✓ configured' : '✗ missing'}`);
  console.log(`  Supabase Admin: ${supabaseAdmin ? '✓ configured' : '✗ missing'}`);
});
