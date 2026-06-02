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
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const walletWalletApiKey = process.env.WALLETWALLET_API_KEY;
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

function buildLabDiscussionTranscriptionConfig(fileId, participants = []) {
  const participantNames = participants.map(p => p.name).filter(Boolean).join(', ') || 'multiple doctors';
  return {
    ...buildTranscriptionConfig(fileId),
    context: {
      general: [
        { key: 'domain', value: 'Healthcare / Internal clinical discussion' },
        { key: 'topic', value: 'Discussion between doctors about lab findings, scans, diagnoses, care decisions, and action planning' },
        { key: 'participants', value: participantNames },
        { key: 'languages', value: 'English and Arabic, possibly mixed within sentences' },
      ],
      text: `This is an internal clinical discussion between doctors, not a doctor-patient visit. 
The speakers may discuss lab results, imaging findings, differential diagnoses, care coordination, 
handoff details, treatment options, risk concerns, and action items. The discussion may switch 
between Arabic and English, with English medical terminology inside Arabic sentences.`,
      terms: [
        'CBC', 'HbA1c', 'A1C', 'lipid profile', 'creatinine', 'urea', 'electrolytes',
        'LFT', 'AST', 'ALT', 'bilirubin', 'TSH', 'troponin', 'D-dimer',
        'MRI', 'CT scan', 'X-ray', 'ultrasound', 'radiology', 'pathology',
        'differential diagnosis', 'follow-up', 'referral', 'repeat labs',
        'critical value', 'abnormal finding', 'action plan', 'case discussion',
      ],
    },
    client_reference_id: 'clinotes-lab-discussion',
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

async function runTestAudioPipeline(audioBuffer, { filename, transcriptionConfig, analyze }) {
  let sonioxFileId = null;
  let sonioxTranscriptionId = null;

  try {
    const uploadResult = await uploadToSoniox(audioBuffer, filename);
    sonioxFileId = uploadResult.id;

    const transcription = await createTranscription(transcriptionConfig(sonioxFileId));
    sonioxTranscriptionId = transcription.id;

    const completedMeta = await waitForTranscription(sonioxTranscriptionId);
    const transcriptResult = await getTranscript(sonioxTranscriptionId);
    const plainText = transcriptResult.text || '';
    const markdownText = renderTranscriptMarkdown(transcriptResult.tokens || [], completedMeta);

    const aiResult = plainText.trim().length > 10
      ? await analyze(plainText)
      : { summary_text: 'No usable speech was detected.', structured_data: {} };
    const cleanedText = getCleanedTranscript(aiResult, plainText);

    await cleanupSoniox(sonioxTranscriptionId, sonioxFileId);

    return {
      raw_transcript_text: plainText,
      transcript_text: cleanedText,
      transcript_markdown: markdownText,
      soniox_meta: {
        duration_ms: completedMeta.audio_duration_ms || null,
        transcription_id: sonioxTranscriptionId,
      },
      analysis_json: aiResult,
    };
  } catch (error) {
    await cleanupSoniox(sonioxTranscriptionId, sonioxFileId);
    throw error;
  }
}

function normalizePlanItemsForDisplay(plan) {
  if (!plan) return [];
  if (Array.isArray(plan)) {
    return plan.map(item => ({
      label: item.label || item.type || 'Plan',
      value: item.value || item.description || item
    })).filter(item => item.value);
  }

  return Object.entries(plan).flatMap(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return values.filter(Boolean).map(item => ({
      label: key.replace(/_/g, ' '),
      value: item
    }));
  });
}

function buildDoctorSoapDisplay(aiResult) {
  const structured = aiResult?.structured_data || {};
  const subjective = structured.subjective || {};
  const objective = structured.objective || {};
  const assessment = structured.assessment || {};

  return {
    title: structured.title || 'Clinical Consultation Draft',
    summary: aiResult?.summary_text || '',
    subjective: {
      chief_complaint: subjective.chief_complaint || '',
      history: subjective.history || '',
      allergies: Array.isArray(subjective.allergies) ? subjective.allergies.join(', ') : subjective.allergies || '',
      notes: subjective.notes || '',
    },
    objective: {
      vitals: typeof objective.vitals === 'object' ? objective.vitals : { notes: objective.vitals || '' },
      examination: objective.examination || objective.physical_exam || '',
    },
    assessment: {
      diagnoses: Array.isArray(assessment.diagnoses) ? assessment.diagnoses : [assessment.diagnoses].filter(Boolean),
      reasoning: assessment.reasoning || '',
    },
    plan: normalizePlanItemsForDisplay(structured.plan),
  };
}

function getCleanedTranscript(aiResult, fallbackText = '') {
  return normalizeMixedTranscriptForDisplay(aiResult?.structured_data?.cleaned_transcript || aiResult?.cleaned_transcript || fallbackText || '');
}

function normalizeMixedTranscriptForDisplay(text) {
  const value = String(text || '');
  const terms = [
    'HbA1c', 'A1C', 'CBC', 'CT', 'MRI', 'X-ray', 'ECG', 'EKG', 'TSH', 'LFT', 'AST', 'ALT',
    'D-dimer', 'troponin', 'creatinine', 'cholesterol', 'ultrasound', 'diabetes',
    'hypertension', 'metformin', 'lisinopril', 'amlodipine', 'paracetamol', 'ibuprofen'
  ];

  return value.split('\n').map(line => {
    if (!/[\u0600-\u06FF]/.test(line)) return line;
    return terms.reduce((current, term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?<!\\[)\\b(${escaped})\\b(?!\\])`, 'gi');
      return current.replace(pattern, '[$1]');
    }, line);
  }).join('\n');
}

function buildCleanTranscriptMarkdown(cleanedText, transcriptionMeta = {}) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const lines = ['# Clinical Consultation Transcript', '', `**Date:** ${date}`];

  if (transcriptionMeta.audio_duration_ms) {
    const durationSec = Math.round(transcriptionMeta.audio_duration_ms / 1000);
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    lines.push(`**Duration:** ${mins}m ${secs}s`);
  }

  lines.push('', '---', '', cleanedText || 'No transcript text available.', '', '---', '*Cleaned by Gemini from Soniox transcript • CliNotes*');
  return lines.join('\n');
}

function buildPatientDisplay(aiResult) {
  const structured = aiResult?.structured_data || {};
  const patientSummary = structured.patient_summary || {};
  const subjective = structured.subjective || {};
  const objective = structured.objective || {};
  const assessment = structured.assessment || {};
  const diagnoses = Array.isArray(assessment.diagnoses) ? assessment.diagnoses : [assessment.diagnoses].filter(Boolean);
  const plan = normalizePlanItemsForDisplay(structured.plan);

  return {
    title: structured.title || 'Your Consultation',
    what_you_came_for: patientSummary.what_you_came_for || subjective.chief_complaint || '',
    what_was_discussed: patientSummary.what_was_discussed || subjective.history || aiResult?.summary_text || '',
    what_the_doctor_found: patientSummary.what_the_doctor_found || objective.examination || objective.physical_exam || diagnoses.join(', '),
    what_happens_next: patientSummary.what_happens_next || plan.map(item => item.value).join(' '),
  };
}

function buildLabDoctorDisplay(aiResult, participants = []) {
  const structured = aiResult?.structured_data || {};
  return {
    title: structured.title || 'Internal Doctor Discussion',
    participants,
    summary: aiResult?.summary_text || '',
    prominent_points: structured.prominent_points || [],
    decisions: structured.decisions || [],
    open_questions: structured.open_questions || [],
    action_plan: structured.action_plan || [],
  };
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
    ],
    "recommended_actions": {
      "follow_up": {
        "needed": true,
        "timing": "When the follow-up should happen, e.g. in 2 weeks",
        "reason": "Why follow-up is needed",
        "status": "pending"
      },
      "prescription": {
        "needed": true,
        "medications": [
          {
            "name": "Medication name",
            "dose": "Dose if mentioned",
            "frequency": "How often to take it",
            "duration": "How long to take it if mentioned",
            "instructions": "Extra instructions if mentioned"
          }
        ],
        "status": "pending"
      },
      "lab_order": {
        "needed": true,
        "orders": [
          {
            "type": "Lab | Imaging | Scan | Test",
            "name": "Test, scan, or imaging name",
            "reason": "Why it is needed",
            "priority": "Routine | Urgent if mentioned"
          }
        ],
        "status": "pending"
      },
      "referral": {
        "needed": true,
        "specialty": "Specialty to refer to",
        "reason": "Why referral is needed",
        "debrief": "Short debrief for the next doctor",
        "status": "pending"
      }
    },
    "patient_summary": {
      "what_you_came_for": "One short sentence in simple patient-friendly language.",
      "what_was_discussed": "One to two short sentences explaining what was talked about.",
      "what_the_doctor_found": "One to two short sentences explaining findings without unnecessary jargon.",
      "what_happens_next": "One to two short sentences explaining the next steps clearly."
    },
    "cleaned_transcript": "The same transcript text, lightly cleaned. Correct ambiguous medical terms and preserve English medical terminology in Latin letters inside Arabic text."
  }
}
For cleaned_transcript: keep the transcript meaning, order, speakers if obvious, and wording as close as possible to the Soniox transcript. Do not summarize. Do not add facts. Only correct obvious transcription mistakes, especially English medical terminology that was mistakenly written phonetically or in Arabic alphabet inside Arabic speech. Examples: "سي تي" -> "[CT]", "ام ار اي" -> "[MRI]", "اتش بي اي ون سي" -> "[HbA1c]", "كرياتينين" -> "[creatinine]" when it is clearly the medical term. Preserve Arabic sentences as Arabic. When an English medical term appears inside an Arabic sentence, write it in Latin letters inside square brackets to prevent mixed-direction display issues.
For recommended_actions: include only actions that are clearly supported by the transcript. If no action of a type was mentioned or implied, set needed to false and leave arrays empty. These four action types are the only allowed action types. Do not invent medications, tests, referrals, or follow-up timing.
For patient_summary, use plain language suitable for the patient, preserve the facts from the transcript, avoid jargon where possible, and do not add new diagnoses, test results, or instructions that were not discussed. If any specific fields are not mentioned in the transcript, omit them or leave them as null/empty strings.
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

async function analyzeLabDiscussionWithGemini(transcriptText) {
  if (!gemini) {
    throw new Error("Gemini API key is missing or invalid on the server.");
  }

  const systemPrompt = `
You are a clinical documentation assistant. Analyze an internal doctor-to-doctor discussion transcript.
The discussion may include Arabic-English code switching. Return strictly valid JSON:
{
  "summary_text": "A concise 2-4 sentence summary of the discussion.",
  "structured_data": {
    "title": "A clear headline for the discussion",
    "prominent_points": ["important clinical, lab, imaging, or workflow points"],
    "decisions": ["decisions or consensus reached"],
    "open_questions": ["uncertainties or items needing more review"],
    "action_plan": [
      { "label": "Action", "owner": "Doctor/team if mentioned", "value": "What should happen next" }
    ],
    "cleaned_transcript": "The same transcript text, lightly cleaned. Correct ambiguous medical terms and preserve English medical terminology in Latin letters inside Arabic text."
  }
}
For cleaned_transcript: keep the transcript meaning, order, speakers if obvious, and wording as close as possible to the Soniox transcript. Do not summarize. Do not add facts. Only correct obvious transcription mistakes, especially English lab/imaging/medical terminology that was mistakenly written phonetically or in Arabic alphabet inside Arabic speech. Examples: "سي بي سي" -> "[CBC]", "سي تي" -> "[CT]", "ام ار اي" -> "[MRI]", "اتش بي اي ون سي" -> "[HbA1c]", "دي دايمر" -> "[D-dimer]". Preserve Arabic sentences as Arabic. When an English medical term appears inside an Arabic sentence, write it in Latin letters inside square brackets to prevent mixed-direction display issues.
Do not invent facts. If an item is not mentioned, use an empty array.
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

async function generatePatientSummaryWithGemini(structuredData) {
  if (!gemini) {
    throw new Error("Gemini API key is missing or invalid on the server.");
  }

  const systemPrompt = `
You are a patient-friendly clinical explainer. Convert an approved doctor's structured note into simple language for the patient.
Return strictly valid JSON with this shape:
{
  "what_you_came_for": "One short sentence.",
  "what_was_discussed": "One to two short sentences.",
  "what_the_doctor_found": "One to two short sentences.",
  "what_happens_next": "One to two short sentences."
}
Use only facts present in the structured note. Do not add new diagnoses, results, or instructions. Avoid jargon and keep the tone calm and clear.
`;

  const model = gemini.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    }
  });

  const response = await model.generateContent(JSON.stringify(structuredData || {}));
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

app.post('/api/patient-summary', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: 'Invalid session.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profileError || profile?.role !== 'doctor') {
      return res.status(403).json({ error: 'Only doctors can generate patient summaries.' });
    }

    const summary = await generatePatientSummaryWithGemini(req.body?.structuredData || {});
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to generate patient summary.' });
  }
});

app.post('/api/test/consultation', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '50mb' }), async (req, res) => {
  if (!SONIOX_API_KEY || SONIOX_API_KEY === 'your_soniox_api_key_here') {
    return res.status(500).json({ error: 'Soniox API key is not configured on the server.' });
  }
  if (!gemini) {
    return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
  }
  if (!req.body || !Buffer.isBuffer(req.body)) {
    return res.status(400).json({ error: 'No audio data received.' });
  }

  try {
    const result = await runTestAudioPipeline(req.body, {
      filename: `test-consultation-${Date.now()}.webm`,
      transcriptionConfig: fileId => buildTranscriptionConfig(fileId),
      analyze: analyzeTranscriptWithGemini,
    });

    res.json({
      mode: 'doctor_patient_consultation_test',
      ...result,
      doctor_display: buildDoctorSoapDisplay(result.analysis_json),
      patient_display: buildPatientDisplay(result.analysis_json),
    });
  } catch (error) {
    console.error('[TestApp] Consultation test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/test/lab-discussion', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '50mb' }), async (req, res) => {
  if (!SONIOX_API_KEY || SONIOX_API_KEY === 'your_soniox_api_key_here') {
    return res.status(500).json({ error: 'Soniox API key is not configured on the server.' });
  }
  if (!gemini) {
    return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
  }
  if (!req.body || !Buffer.isBuffer(req.body)) {
    return res.status(400).json({ error: 'No audio data received.' });
  }

  const participants = String(req.query.participants || '')
    .split(',')
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => ({ name }));

  try {
    const result = await runTestAudioPipeline(req.body, {
      filename: `test-lab-discussion-${Date.now()}.webm`,
      transcriptionConfig: fileId => buildLabDiscussionTranscriptionConfig(fileId, participants),
      analyze: analyzeLabDiscussionWithGemini,
    });

    res.json({
      mode: 'doctor_discussion_test',
      ...result,
      doctor_display: buildLabDoctorDisplay(result.analysis_json, participants.map(p => p.name)),
    });
  } catch (error) {
    console.error('[TestApp] Lab discussion test failed:', error);
    res.status(500).json({ error: error.message });
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

        let cleanedText = plainText || '';
        let cleanedMarkdown = markdownText;

        // 8. Run Gemini Analysis automatically
        if (gemini && plainText.trim().length > 10) {
          console.log(`[Transcribe] Starting Gemini analysis for consultation ${consultationId}...`);
          try {
            const aiResult = await analyzeTranscriptWithGemini(plainText);
            cleanedText = getCleanedTranscript(aiResult, plainText);
            cleanedMarkdown = buildCleanTranscriptMarkdown(cleanedText, completedMeta);

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

        // 9. Save cleaned transcript to database for display
        await supabaseAdmin
          .from('transcript')
          .update({
            transcript_text: cleanedText,
            transcript_markdown: cleanedMarkdown,
            status: 'completed',
          })
          .eq('id', transcriptRecord.id);

        console.log(`[Transcribe] ✓ Saved cleaned transcript for consultation ${consultationId}`);

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

// ==========================================
// LAB DISCUSSION ROUTES
// ==========================================

app.post('/api/labs/verify-doctor', async (req, res) => {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase clients are not configured.' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await supabaseAuthClient.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid doctor credentials.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (profileError || profile?.role !== 'doctor') {
      return res.status(403).json({ error: 'These credentials do not belong to a doctor account.' });
    }

    const { data: doctor, error: doctorError } = await supabaseAdmin
      .from('doctor')
      .select('id, name, specialty')
      .eq('id', authData.user.id)
      .single();

    if (doctorError || !doctor) {
      return res.status(404).json({ error: 'Doctor profile was not found.' });
    }

    await supabaseAuthClient.auth.signOut();
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/labs/discussions', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const { title, participantIds } = req.body;
  const ids = [...new Set(participantIds || [])];
  if (ids.length < 1) {
    return res.status(400).json({ error: 'At least one doctor participant is required.' });
  }

  try {
    const { data: discussion, error: discussionError } = await supabaseAdmin
      .from('lab_discussion')
      .insert([{ title: title || 'Internal Clinical Discussion', status: 'pending' }])
      .select()
      .single();

    if (discussionError) throw discussionError;

    const { error: participantError } = await supabaseAdmin
      .from('lab_discussion_participant')
      .insert(ids.map(id => ({ discussion_id: discussion.id, doctor_id: id })));

    if (participantError) throw participantError;

    res.json(discussion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/labs/discussions/:discussionId/audio', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '50mb' }), async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const { discussionId } = req.params;
  const audioBuffer = req.body;
  if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
    return res.status(400).json({ error: 'No audio data received.' });
  }

  const fileName = `${discussionId}/${Date.now()}.webm`;

  try {
    let { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('lab-discussion-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/webm',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('bucket')) {
        await supabaseAdmin.storage.createBucket('lab-discussion-audio', { public: false });
        const retry = await supabaseAdmin.storage
          .from('lab-discussion-audio')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/webm',
            cacheControl: '3600',
            upsert: false
          });
        if (retry.error) throw retry.error;
        uploadData = retry.data;
      } else {
        throw uploadError;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('lab_discussion')
      .update({ audio_path: uploadData.path || fileName, status: 'processing' })
      .eq('id', discussionId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/labs/discussions/:discussionId/transcribe', async (req, res) => {
  if (!SONIOX_API_KEY || SONIOX_API_KEY === 'your_soniox_api_key_here') {
    return res.status(500).json({ error: 'Soniox API key is not configured on the server.' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const { discussionId } = req.params;
  let sonioxFileId = null;
  let sonioxTranscriptionId = null;

  try {
    const { data: discussion, error: discussionError } = await supabaseAdmin
      .from('lab_discussion')
      .select('id, title, audio_path')
      .eq('id', discussionId)
      .single();

    if (discussionError || !discussion?.audio_path) {
      return res.status(404).json({ error: 'No audio file found for this lab discussion.' });
    }

    const { data: participants } = await supabaseAdmin
      .from('lab_discussion_participant')
      .select('doctor:doctor_id(name, specialty)')
      .eq('discussion_id', discussionId);

    const participantDoctors = (participants || []).map(p => p.doctor).filter(Boolean);

    const { data: audioData, error: downloadError } = await supabaseAdmin.storage
      .from('lab-discussion-audio')
      .download(discussion.audio_path);

    if (downloadError || !audioData) {
      return res.status(500).json({ error: `Failed to download audio: ${downloadError?.message || 'Unknown error'}` });
    }

    const audioBuffer = Buffer.from(await audioData.arrayBuffer());

    res.json({ message: 'Lab discussion transcription started.', status: 'processing' });

    (async () => {
      try {
        const filename = discussion.audio_path.split('/').pop() || 'lab-discussion.webm';
        const uploadResult = await uploadToSoniox(audioBuffer, filename);
        sonioxFileId = uploadResult.id;

        const config = buildLabDiscussionTranscriptionConfig(sonioxFileId, participantDoctors);
        const transcription = await createTranscription(config);
        sonioxTranscriptionId = transcription.id;

        await supabaseAdmin
          .from('lab_discussion')
          .update({ soniox_transcription_id: sonioxTranscriptionId })
          .eq('id', discussionId);

        const completedMeta = await waitForTranscription(sonioxTranscriptionId);
        const transcriptResult = await getTranscript(sonioxTranscriptionId);
        const plainText = transcriptResult.text || '';
        const markdownText = renderTranscriptMarkdown(transcriptResult.tokens || [], completedMeta);
        let cleanedText = plainText;
        let cleanedMarkdown = markdownText;

        let aiResult = {
          summary_text: 'Discussion transcribed successfully.',
          structured_data: {}
        };

        if (gemini && plainText.trim().length > 10) {
          aiResult = await analyzeLabDiscussionWithGemini(plainText);
          cleanedText = getCleanedTranscript(aiResult, plainText);
          cleanedMarkdown = buildCleanTranscriptMarkdown(cleanedText, completedMeta);
        }

        await supabaseAdmin
          .from('lab_discussion')
          .update({
            transcript_text: cleanedText,
            transcript_markdown: cleanedMarkdown,
            summary_text: aiResult.summary_text || 'Analysis completed.',
            structured_data: aiResult.structured_data || {},
            title: aiResult.structured_data?.title || discussion.title || 'Internal Clinical Discussion',
            status: 'processed',
          })
          .eq('id', discussionId);

        await cleanupSoniox(sonioxTranscriptionId, sonioxFileId);
      } catch (bgError) {
        console.error('[Labs] Background processing error:', bgError);
        await supabaseAdmin
          .from('lab_discussion')
          .update({ status: 'error', error_message: bgError.message })
          .eq('id', discussionId);
        await cleanupSoniox(sonioxTranscriptionId, sonioxFileId);
      }
    })();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/labs/doctor-discussions', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: 'Invalid session.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profileError || profile?.role !== 'doctor') {
      return res.status(403).json({ error: 'Only doctor accounts can view lab discussions.' });
    }

    const { data, error } = await supabaseAdmin
      .from('lab_discussion_participant')
      .select(`
        approved_at,
        created_at,
        discussion:discussion_id(
          id,
          title,
          summary_text,
          structured_data,
          status,
          created_at,
          transcript_text,
          error_message
        )
      `)
      .eq('doctor_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const discussions = (data || [])
      .map(row => row.discussion ? { ...row.discussion, approved_at: row.approved_at } : null)
      .filter(Boolean);

    res.json(discussions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/labs/discussions/:discussionId/approve', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: 'Invalid session.' });
    }

    const { data, error } = await supabaseAdmin
      .from('lab_discussion_participant')
      .update({ approved_at: new Date().toISOString() })
      .eq('discussion_id', req.params.discussionId)
      .eq('doctor_id', userData.user.id)
      .select(`
        approved_at,
        discussion:discussion_id(
          id,
          title,
          summary_text,
          structured_data,
          status,
          created_at,
          transcript_text,
          error_message
        )
      `)
      .single();

    if (error) throw error;
    if (!data?.discussion) {
      return res.status(404).json({ error: 'Lab discussion was not found for this doctor.' });
    }

    res.json({ ...data.discussion, approved_at: data.approved_at });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/labs/discussions/:discussionId', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: 'Invalid session.' });
    }

    const { data: participant, error: participantError } = await supabaseAdmin
      .from('lab_discussion_participant')
      .select('id')
      .eq('discussion_id', req.params.discussionId)
      .eq('doctor_id', userData.user.id)
      .single();

    if (participantError || !participant) {
      return res.status(404).json({ error: 'Lab discussion was not found for this doctor.' });
    }

    const { error } = await supabaseAdmin
      .from('lab_discussion')
      .delete()
      .eq('id', req.params.discussionId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patients/:patientId/apple-wallet-pass', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }
  if (!walletWalletApiKey) {
    return res.status(501).json({ error: 'WALLETWALLET_API_KEY is not configured on the server.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: 'Invalid session.' });
    }

    const patientId = req.params.patientId;
    if (userData.user.id !== patientId) {
      return res.status(403).json({ error: 'You can only create your own patient card.' });
    }

    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patient_profile')
      .select('id, name, age, gender')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({ error: 'Patient profile was not found.' });
    }

    const walletResponse = await fetch('https://api.walletwallet.dev/api/pkpass', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${walletWalletApiKey}`,
      },
      body: JSON.stringify({
        barcodeValue: patient.id,
        barcodeFormat: 'QR',
        logoText: 'CliNotes',
        description: `CliNotes patient card for ${patient.name || 'Patient'}`,
        organizationName: 'CliNotes',
        primaryFields: [{ label: 'PATIENT', value: patient.name || 'Patient' }],
        secondaryFields: [
          { label: 'CARD', value: 'Patient Card' },
          { label: 'USE', value: 'Scan before visit' },
        ],
        backFields: [
          { label: 'Use', value: 'Show this card to your doctor before a recorded consultation.' },
        ],
        colorPreset: 'blue',
        expirationDays: 3650,
      }),
    });

    if (!walletResponse.ok) {
      let message = 'WalletWallet pass creation failed.';
      try {
        const errorBody = await walletResponse.json();
        message = errorBody.error || message;
      } catch {
        message = await walletResponse.text();
      }
      return res.status(walletResponse.status).json({ error: message });
    }

    const passBuffer = Buffer.from(await walletResponse.arrayBuffer());
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="clinotes-patient-card.pkpass"');
    const serial = walletResponse.headers.get('X-Serial-Number');
    if (serial) res.setHeader('X-Serial-Number', serial);
    res.send(passBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/doctors/:doctorId/booked-slots', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: 'Invalid session.' });
    }

    const date = req.query.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'A YYYY-MM-DD date is required.' });
    }

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const { data, error } = await supabaseAdmin
      .from('booking')
      .select('appointment_time')
      .eq('doctor_id', req.params.doctorId)
      .eq('status', 'scheduled')
      .gte('appointment_time', start.toISOString())
      .lte('appointment_time', end.toISOString());

    if (error) throw error;

    res.json((data || []).map(row => row.appointment_time));
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
