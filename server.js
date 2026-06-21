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
const testAppPassword = process.env.TEST_APP_PASSWORD;

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
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
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
const SONIOX_ASYNC_MODEL = 'stt-async-v4';
const SONIOX_TEST_MODEL = 'stt-async-v5';

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

function decodeHeaderFilename(value, fallbackFilename) {
  try {
    return value ? decodeURIComponent(value) : fallbackFilename;
  } catch {
    return value || fallbackFilename;
  }
}

function getAudioUploadMetadata(req, fallbackFilename) {
  const rawFilename = String(req.headers['x-audio-filename'] || '').trim();
  const decodedFilename = decodeHeaderFilename(rawFilename, fallbackFilename);
  let safeFilename = decodedFilename
    .split(/[\\/]/)
    .pop()
    .replace(/[^\w.\-() ]+/g, '-')
    || fallbackFilename;
  const mimeType = String(req.headers['x-audio-mime'] || req.headers['content-type'] || 'application/octet-stream').split(';')[0];
  if (!/\.[a-z0-9]{2,5}$/i.test(safeFilename)) {
    safeFilename = `${safeFilename}.${extensionFromMimeType(mimeType)}`;
  }
  return { filename: safeFilename, mimeType };
}

function extensionFromMimeType(mimeType = '') {
  return {
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/amr': 'amr',
    'audio/3gpp': '3gp',
  }[mimeType] || 'webm';
}

function mimeTypeFromFilename(filename = '') {
  const extension = String(filename).split('.').pop().toLowerCase();
  return {
    webm: 'audio/webm',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
    mov: 'video/quicktime',
    amr: 'audio/amr',
    '3gp': 'audio/3gpp',
  }[extension] || 'application/octet-stream';
}

async function uploadToSoniox(audioBuffer, filename, mimeType = 'application/octet-stream') {
  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
  form.append('client_reference_id', 'clinotes-consultation');

  return sonioxFetch('/v1/files', { method: 'POST', body: form });
}

function buildTranscriptionConfig(fileId, model = SONIOX_ASYNC_MODEL) {
  return {
    model,
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

function buildLabDiscussionTranscriptionConfig(fileId, participants = [], model = SONIOX_ASYNC_MODEL) {
  const participantNames = participants.map(p => p.name).filter(Boolean).join(', ') || 'multiple doctors';
  return {
    ...buildTranscriptionConfig(fileId, model),
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

async function runTestAudioPipeline(audioBuffer, { filename, mimeType, transcriptionConfig, analyze }) {
  let sonioxFileId = null;
  let sonioxTranscriptionId = null;

  try {
    const uploadResult = await uploadToSoniox(audioBuffer, filename, mimeType);
    sonioxFileId = uploadResult.id;

    const config = transcriptionConfig(sonioxFileId);
    const transcription = await createTranscription(config);
    sonioxTranscriptionId = transcription.id;

    const completedMeta = await waitForTranscription(sonioxTranscriptionId);
    const transcriptResult = await getTranscript(sonioxTranscriptionId);
    const plainText = transcriptResult.text || '';
    if (plainText.trim().length <= 10) {
      console.error('[Test transcription] No usable speech returned by Soniox.', {
        filename,
        mimeType,
        bytes: audioBuffer.length,
        durationMs: completedMeta.audio_duration_ms || null,
        tokenCount: transcriptResult.tokens?.length || 0,
      });
      throw new Error('No usable speech was detected in the recording. Check that the correct microphone is selected and audible, then try again.');
    }
    const markdownText = renderTranscriptMarkdown(transcriptResult.tokens || [], completedMeta);

    const aiResult = await analyze(plainText);
    const cleanedText = getCleanedTranscript(aiResult, plainText);

    await cleanupSoniox(sonioxTranscriptionId, sonioxFileId);

    return {
      raw_transcript_text: plainText,
      transcript_text: cleanedText,
      transcript_markdown: markdownText,
      soniox_meta: {
        model: config.model,
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
  const vitals = normalizeVitalsForDisplay(objective.vitals);

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
      ...(vitals ? { vitals } : {}),
      examination: objective.examination || objective.physical_exam || '',
    },
    assessment: {
      diagnoses: Array.isArray(assessment.diagnoses) ? assessment.diagnoses : [assessment.diagnoses].filter(Boolean),
      reasoning: assessment.reasoning || '',
    },
    plan: normalizePlanItemsForDisplay(structured.plan),
  };
}

function normalizeVitalsForDisplay(vitals) {
  if (!vitals || typeof vitals !== 'object' || Array.isArray(vitals)) return null;
  const normalized = {
    blood_pressure: vitals.blood_pressure || vitals.bp || vitals.BP || '',
    heart_rate: vitals.heart_rate || vitals.pulse || '',
    temperature: vitals.temperature || vitals.temp || '',
  };
  return Object.values(normalized).some(value => String(value || '').trim()) ? normalized : null;
}

function getCleanedTranscript(aiResult, fallbackText = '') {
  return normalizeMixedTranscriptForDisplay(aiResult?.structured_data?.cleaned_transcript || aiResult?.cleaned_transcript || fallbackText || '');
}

function normalizeRecommendedActionRows(aiResult) {
  const structured = aiResult?.structured_data || aiResult;
  const actions = structured?.recommended_actions;
  if (!actions || typeof actions !== 'object') return aiResult;

  const prescription = actions.prescription;
  if (prescription?.needed) {
    const aliases = [prescription.medications, prescription.items, prescription.drugs];
    prescription.medications = aliases.find(value => Array.isArray(value) && value.length)
      || aliases.find(Array.isArray)
      || [];
    if (!prescription.medications.length) {
      prescription.medications = actionPlanValues(structured.plan, /medication|medicine|drug|prescription|treatment|دواء|علاج|روشتة/i)
        .map(value => ({ name: value, dose: '', frequency: '', duration: '', instructions: '' }));
    }
  }

  const labOrder = actions.lab_order;
  if (labOrder?.needed) {
    const aliases = [labOrder.orders, labOrder.tests, labOrder.imaging_orders, labOrder.imaging];
    labOrder.orders = aliases.find(value => Array.isArray(value) && value.length)
      || aliases.find(Array.isArray)
      || [];
    if (!labOrder.orders.length) {
      labOrder.orders = actionPlanValues(structured.plan, /lab|test|imaging|scan|x-?ray|mri|ct|ultrasound|تحليل|تحاليل|أشعة|فحص/i)
        .map(value => ({ type: inferOrderType(value), name: value, reason: '', priority: 'Routine' }));
    }
  }

  return aiResult;
}

function actionPlanValues(plan, labelPattern) {
  if (!Array.isArray(plan)) return [];
  return plan.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const label = String(item.label || item.type || '');
    const value = String(item.value || item.description || '').trim();
    return value && labelPattern.test(`${label} ${value}`) ? [value] : [];
  });
}

function inferOrderType(value) {
  return /imaging|scan|x-?ray|mri|ct|ultrasound|أشعة/i.test(value) ? 'Imaging' : 'Lab';
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

  return {
    title: structured.title || 'Your Consultation',
    what_you_came_for: patientSummary.what_you_came_for || '',
    what_was_discussed: patientSummary.what_was_discussed || '',
    what_the_doctor_found: patientSummary.what_the_doctor_found || '',
    what_happens_next: patientSummary.what_happens_next || '',
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

function requireTestAppPassword(req, res, next) {
  if (!testAppPassword) {
    return res.status(500).json({ error: 'TEST_APP_PASSWORD is not configured on the server.' });
  }
  const provided = req.headers['x-test-app-password'];
  if (!provided || provided !== testAppPassword) {
    return res.status(401).json({ error: 'Invalid testing password.' });
  }
  next();
}

app.post('/api/test-auth', requireTestAppPassword, (req, res) => {
  res.json({ ok: true });
});

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

  const upload = getAudioUploadMetadata(req, `${Date.now()}`);
  const fileName = `${consultationId}/${upload.filename}`;

  try {
    // 1. Upload to storage using service_role to bypass RLS
    let { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('consultation-audio')
      .upload(fileName, audioBuffer, {
        contentType: upload.mimeType,
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
            contentType: upload.mimeType,
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

async function parseGeminiJsonResponse(response, contextLabel = 'Gemini response', geminiModel = GEMINI_MODEL) {
  const rawText = response.response.text();
  try {
    return JSON.parse(extractJsonCandidate(rawText));
  } catch (initialError) {
    console.warn(`[Gemini] Invalid JSON for ${contextLabel}: ${initialError.message}`);
    const repairedText = await repairGeminiJson(rawText, initialError.message, contextLabel, geminiModel);
    try {
      return JSON.parse(extractJsonCandidate(repairedText));
    } catch (repairError) {
      repairError.message = `${contextLabel} returned invalid JSON after repair: ${repairError.message}`;
      throw repairError;
    }
  }
}

function extractJsonCandidate(text = '') {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }
  return candidate;
}

async function repairGeminiJson(rawText, parseError, contextLabel, geminiModel = GEMINI_MODEL) {
  if (!gemini) throw new Error(`${contextLabel} returned invalid JSON: ${parseError}`);

  const repairPrompt = `
The following text was intended to be a single JSON object but it is invalid.
Fix only the JSON syntax. Preserve all keys, values, medical content, Arabic text, English terms, arrays, and object structure as much as possible.
Return only one strictly valid JSON object. Do not add markdown, comments, or explanation.

Parse error:
${parseError}

Invalid JSON text:
${rawText}
`;

  const repairModel = gemini.getGenerativeModel({
    model: geminiModel,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    }
  });

  const repairResponse = await repairModel.generateContent(repairPrompt);
  return repairResponse.response.text();
}

function getGeminiOutputLanguageInstructions(outputLanguage = 'en', mode = 'consultation') {
  if (outputLanguage !== 'ar') {
    return mode === 'consultation'
      ? 'For patient_summary, always write in English, even if the transcript is Arabic or code-switched. Use plain language suitable for the patient, preserve the facts from the transcript, avoid jargon where possible, and do not add new diagnoses, test results, or instructions that were not discussed. Translate the patient\'s meaning into simple English. If any specific fields are not mentioned in the transcript, omit them or leave them as null/empty strings.'
      : 'Write all summary, report, decision, and action-plan display values in English unless directly quoting a speaker.';
  }

  if (mode === 'lab') {
    return 'Write all report display values in Arabic, including summary_text, title, prominent_points, decisions, open_questions, and action_plan values. Keep JSON keys exactly as specified in English. Only disease names and diagnosis names should remain in English inside square brackets, e.g. [diabetes], [pneumonia]. Do not put lab names, imaging names, abbreviations, drug names, doctor names, or general English technical terms inside brackets unless they are disease or diagnosis names. Translate non-diagnosis explanatory text into Arabic.';
  }

  return `Write every human-readable consultation value in natural Modern Standard Arabic, including summary_text, title, all SOAP field values, plan labels, plan values, recommended action reasons/timing/instructions, and patient_summary. Keep JSON keys and status values exactly as specified in English.
For SOAP notes specifically, do not leave ordinary explanatory text in English. Use Arabic phrasing that sounds natural to a clinician.
The only exceptions inside Arabic SOAP notes are disease/diagnosis names and medication names:
- Disease/diagnosis names must be written in Arabic followed by the English name in square brackets, e.g. "السكري [diabetes]", "الربو [asthma]", "ارتفاع ضغط الدم [hypertension]".
- Medication names must be written in Arabic or common Arabic transliteration followed by the English generic/brand name in square brackets, e.g. "باراسيتامول [Paracetamol]", "ميتفورمين [Metformin]".
Do not use English-only disease names or English-only medication names in Arabic mode.
Do not bracket lab names, imaging names, abbreviations, doctor names, general technical terms, timings, frequencies, or instructions unless they are a disease/diagnosis or medication name. Translate those into Arabic where possible.
For plan.label in Arabic mode, use concise Arabic labels such as "دواء", "تحاليل", "أشعة", "متابعة", or "إحالة".`;
}

async function analyzeTranscriptWithGemini(transcriptText, { outputLanguage = 'en', geminiModel = GEMINI_MODEL } = {}) {
  if (!gemini) {
    throw new Error("Gemini API key is missing or invalid on the server.");
  }

  const systemPrompt = `
You are a highly skilled medical AI assistant. Your task is to analyze clinical consultation transcripts conducted in code-switched Arabic-English and extract key medical information in a structured SOAP (Subjective, Objective, Assessment, Plan) format.
Create notes that are clinically useful, moderately detailed, and easy to scan. Do not make the SOAP note overly brief. Do not add clutter, speculation, or facts not supported by the transcript.
Please analyze the provided text and output a JSON object with the following structure:
{
  "summary_text": "A concise 2-4 sentence summary covering the main problem, relevant context, assessment, and plan.",
  "structured_data": {
    "title": "A short, descriptive title for this consultation",
    "subjective": {
      "chief_complaint": "One clear sentence with the patient's main reason for the visit",
      "history": "2-5 concise sentences with symptom details, duration, relevant medical history, and context mentioned in the transcript",
      "allergies": "Any allergies discussed; empty string if not mentioned",
      "notes": "Other relevant subjective details, including important negatives only if explicitly discussed"
    },
    "objective": {
      "vitals": {
        "blood_pressure": "e.g., 120/80",
        "heart_rate": "e.g., 75 bpm",
        "temperature": "e.g., 98.6 F"
      },
      "examination": "Physical examination findings or objective observations mentioned; empty string if none"
    },
    "assessment": {
      "diagnoses": ["list", "of", "suspected", "or", "confirmed", "diagnoses"],
      "reasoning": "2-4 concise sentences explaining how symptoms, history, exam, or results support the assessment"
    },
    "plan": [
      { "label": "Medication", "value": "Specific medication plan with dose/timing/reason when mentioned" },
      { "label": "Test or Imaging", "value": "Specific lab, imaging, scan, or diagnostic order with reason when mentioned" },
      { "label": "Follow-up", "value": "When to return or what should be reviewed next" }
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
      "what_you_came_for": "One short sentence in simple patient-friendly English.",
      "what_was_discussed": "One to two short English sentences explaining what was talked about.",
      "what_the_doctor_found": "One to two short English sentences explaining findings without unnecessary jargon.",
      "what_happens_next": "One to two short English sentences explaining the next steps clearly."
    },
    "cleaned_transcript": "The same transcript text, lightly cleaned. Correct ambiguous medical terms and preserve English medical terminology in Latin letters inside Arabic text."
  }
}
SOAP detail rules:
- Prefer complete, clinically useful sentences over fragments.
- Keep each field focused. Avoid long paragraphs, repeated information, generic filler, and unsupported normal findings.
- If a detail is not mentioned, leave the field empty instead of guessing.

For cleaned_transcript: keep the transcript meaning, order, speakers if obvious, and wording as close as possible to the Soniox transcript. Do not summarize. Do not add facts. Only correct obvious transcription mistakes, especially English medical terminology that was mistakenly written phonetically or in Arabic alphabet inside Arabic speech. Examples: "سي تي" -> "[CT]", "ام ار اي" -> "[MRI]", "اتش بي اي ون سي" -> "[HbA1c]", "كرياتينين" -> "[creatinine]" when it is clearly the medical term. Preserve Arabic sentences as Arabic. When an English medical term appears inside an Arabic sentence, write it in Latin letters inside square brackets to prevent mixed-direction display issues.
Medication-name cleanup is especially important:
- Check every medication mention against your medical knowledge and write a real, correctly spelled generic or brand medication name rather than preserving a non-existent phonetic spelling.
- When the source contains an Arabic transliteration or a slightly corrupted Latin spelling, convert it to the nearest real medication name supported by pronunciation, dose, indication, and surrounding clinical context.
- If a mention is ambiguous but one real medication is clearly the closest contextual and phonetic match, use that canonical medication name.
- Never replace an unclear mention with an unrelated medication merely because it is common. If no candidate is reasonably supported, preserve the unclear wording and mark it "[unclear medication]" instead of inventing a drug.
- Keep canonical medication names in Latin letters. In Arabic output, write the Arabic name or transliteration followed by the canonical name in square brackets.
For recommended_actions:
- Decide recommended_actions from transcript evidence using the same criteria every time.
- These four action types are the only allowed action types.
- Set follow_up.needed true only when the doctor explicitly asks the patient to return, review results, reassess symptoms, or schedules/plans a future visit. Copy or infer the timing only from the transcript. If follow-up is clearly needed but timing is not stated, use "not specified".
- Set prescription.needed true only for medications newly prescribed, renewed, stopped, dose-changed, or clearly instructed during this consultation. Include all such medications. Do not include past/home medications unless the doctor changes or explicitly continues them.
- Set lab_order.needed true only when a lab test, imaging study, scan, or diagnostic test is ordered, requested, or planned.
- When prescription.needed is true, medications MUST contain one object for every qualifying medication. Never return needed true with an empty medications array. The medication name is required; use empty strings only for optional details that were not stated.
- When lab_order.needed is true, orders MUST contain one object for every qualifying lab test, scan, imaging study, or diagnostic test. Never return needed true with an empty orders array. The order name and type are required; use empty strings only for an unstated reason.
- Imaging orders belong in lab_order.orders with type "Imaging" or "Scan". Do not put them only in the general plan and omit them from recommended_actions.
- Information already extracted into the general plan must also be copied into the corresponding recommended action row when that action is needed.
- Set referral.needed true only when the doctor recommends seeing another specialist or transferring care to another specialty.
- If evidence is direct and clear, prefer setting the action to true. If evidence is ambiguous, prefer false.
- If an action is false, keep its strings empty and arrays empty.
- For true actions, fill every field that is supported by the transcript, preserve the exact medication/test names, and keep status exactly "pending".
- Do not invent medications, tests, referrals, or follow-up timing.
${getGeminiOutputLanguageInstructions(outputLanguage, 'consultation')}
Ensure the output is strictly valid JSON and nothing else. All line breaks inside string values, especially cleaned_transcript, must be escaped as \\n so the response remains valid JSON.
`;

  const model = gemini.getGenerativeModel({
    model: geminiModel,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.05,
      responseMimeType: "application/json",
    }
  });

  const response = await model.generateContent(transcriptText);
  const result = await parseGeminiJsonResponse(response, 'consultation analysis', geminiModel);
  return normalizeRecommendedActionRows(result);
}

async function analyzeLabDiscussionWithGemini(transcriptText, { outputLanguage = 'en', geminiModel = GEMINI_MODEL } = {}) {
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
For medication mentions in cleaned_transcript, verify that each drug name is a real, correctly spelled medication. Correct Arabic transliterations and corrupted Latin spellings to the nearest canonical generic or brand name supported by pronunciation, dose, indication, and clinical context. If one candidate is clearly the closest match, use it. If no candidate is reasonably supported, preserve the wording and mark it "[unclear medication]" rather than inventing a drug. Keep canonical medication names in Latin letters; in Arabic text, place the canonical name in square brackets after the Arabic name or transliteration.
Do not invent facts. If an item is not mentioned, use an empty array.
${getGeminiOutputLanguageInstructions(outputLanguage, 'lab')}
Ensure all line breaks inside string values, especially cleaned_transcript, are escaped as \\n so the response remains valid JSON.
`;

  const model = gemini.getGenerativeModel({
    model: geminiModel,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    }
  });

  const response = await model.generateContent(transcriptText);
  return parseGeminiJsonResponse(response, 'lab discussion analysis', geminiModel);
}

async function generatePatientSummaryWithGemini(structuredData, { outputLanguage = 'en' } = {}) {
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
${outputLanguage === 'ar'
  ? 'Write all patient-facing values in natural Modern Standard Arabic. Disease/diagnosis names may be written in Arabic followed by English in square brackets only when helpful, e.g. "السكري [diabetes]". Keep the tone calm, simple, and non-technical.'
  : 'Always write in English, even if the source note contains Arabic or code-switched Arabic-English.'}
Use only facts present in the structured note. Do not add new diagnoses, results, or instructions. Avoid jargon and keep the tone calm and clear.
`;

  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    }
  });

  const response = await model.generateContent(JSON.stringify(structuredData || {}));
  return parseGeminiJsonResponse(response, 'patient summary');
}

async function generatePatientContextDebriefWithGemini({ patient, summaries, outputLanguage = 'en' }) {
  if (!gemini) {
    throw new Error("Gemini API key is missing or invalid on the server.");
  }

  const systemPrompt = `
You are a concise clinical handoff assistant for a doctor before seeing a patient.
You will receive only previous consultation summary_text values from CliNotes.
Create a current-situation debrief based strictly on those summaries. Do not add facts, diagnoses, medications, or plans that are not present.
Return strictly valid JSON:
{
  "headline": "Short headline for the patient's current context",
  "debrief": "A clear 3-5 sentence paragraph describing the patient's recent clinical situation and continuity of care context",
  "key_points": ["3-5 short bullets with recurring problems, recent findings, treatments, tests, or follow-up needs"],
  "suggested_focus": ["2-4 short bullets for what the doctor may want to clarify today"]
}
Keep the tone clinical, neutral, and useful. If the summaries are sparse, say that prior documentation is limited.
${outputLanguage === 'ar'
  ? 'Write all values in natural Modern Standard Arabic, using concise clinical language. Keep JSON keys in English.'
  : 'Write all values in English.'}
`;

  const payload = {
    patient: {
      name: patient?.name || '',
      age: patient?.age || '',
      gender: patient?.gender || '',
    },
    previous_consultation_summaries: summaries,
  };

  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.05,
      responseMimeType: "application/json",
    }
  });

  const response = await model.generateContent(JSON.stringify(payload));
  return parseGeminiJsonResponse(response, 'patient context debrief');
}

// ─── Existing: Analyze Transcript Endpoint ───
app.post('/api/analyze-transcript', async (req, res) => {
  const { transcriptText } = req.body;
  if (!transcriptText) {
    return res.status(400).json({ error: "Transcript text is required." });
  }

  try {
    const outputLanguage = req.body?.language === 'ar' ? 'ar' : 'en';
    const resultJson = await analyzeTranscriptWithGemini(transcriptText, { outputLanguage });
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

    const outputLanguage = req.body?.language === 'ar' ? 'ar' : 'en';
    const summary = await generatePatientSummaryWithGemini(req.body?.structuredData || {}, { outputLanguage });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to generate patient summary.' });
  }
});

app.post('/api/patient-context', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client is not configured.' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }

  const { patientId } = req.body || {};
  const outputLanguage = req.body?.language === 'ar' ? 'ar' : 'en';
  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required.' });
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
      return res.status(403).json({ error: 'Only doctors can generate patient context.' });
    }

    const [{ data: patient, error: patientError }, { data: consultations, error: consultationsError }] = await Promise.all([
      supabaseAdmin
        .from('patient_profile')
        .select('id, name, age, gender')
        .eq('id', patientId)
        .single(),
      supabaseAdmin
        .from('consultation')
        .select('id, date_time, ai_summary(summary_text)')
        .eq('patient_id', patientId)
        .order('date_time', { ascending: false })
    ]);

    if (patientError || !patient) {
      return res.status(404).json({ error: 'Patient was not found.' });
    }
    if (consultationsError) {
      throw consultationsError;
    }

    const summaries = (consultations || [])
      .flatMap(consultation => consultation.ai_summary || [])
      .map(summary => String(summary.summary_text || '').trim())
      .filter(Boolean)
      .slice(0, 8);

    if (summaries.length === 0) {
      return res.json({
        first_visit: true,
        headline: outputLanguage === 'ar' ? 'أول زيارة في CliNotes' : 'First CliNotes visit',
        debrief: outputLanguage === 'ar'
          ? 'هذه أول زيارة مسجلة للمريض في CliNotes.'
          : 'This is the patient’s first recorded visit in CliNotes.',
        key_points: [],
        suggested_focus: [],
      });
    }

    const debrief = await generatePatientContextDebriefWithGemini({ patient, summaries, outputLanguage });
    res.json({
      first_visit: false,
      previous_summary_count: summaries.length,
      ...debrief,
    });
  } catch (error) {
    console.error('[PatientContext] Failed to generate patient context:', error);
    res.status(500).json({ error: error.message || 'Failed to generate patient context.' });
  }
});

app.post('/api/test/consultation', requireTestAppPassword, express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
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
    const outputLanguage = req.query.language === 'ar' ? 'ar' : 'en';
    const upload = getAudioUploadMetadata(req, `test-consultation-${Date.now()}.webm`);
    const result = await runTestAudioPipeline(req.body, {
      filename: upload.filename,
      mimeType: upload.mimeType,
      transcriptionConfig: fileId => buildTranscriptionConfig(fileId, SONIOX_TEST_MODEL),
      analyze: transcriptText => analyzeTranscriptWithGemini(transcriptText, { outputLanguage }),
    });

    res.json({
      mode: 'doctor_patient_consultation_test',
      output_language: outputLanguage,
      gemini_model: GEMINI_MODEL,
      ...result,
      doctor_display: buildDoctorSoapDisplay(result.analysis_json),
      patient_display: buildPatientDisplay(result.analysis_json),
    });
  } catch (error) {
    console.error('[TestApp] Consultation test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/test/lab-discussion', requireTestAppPassword, express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
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
    const outputLanguage = req.query.language === 'ar' ? 'ar' : 'en';
    const upload = getAudioUploadMetadata(req, `test-lab-discussion-${Date.now()}.webm`);
    const result = await runTestAudioPipeline(req.body, {
      filename: upload.filename,
      mimeType: upload.mimeType,
      transcriptionConfig: fileId => buildLabDiscussionTranscriptionConfig(fileId, participants, SONIOX_TEST_MODEL),
      analyze: transcriptText => analyzeLabDiscussionWithGemini(transcriptText, { outputLanguage }),
    });

    res.json({
      mode: 'doctor_discussion_test',
      output_language: outputLanguage,
      gemini_model: GEMINI_MODEL,
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
  const outputLanguage = req.body?.language === 'ar' ? 'ar' : 'en';
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

    const audioMimeType = audioData.type || mimeTypeFromFilename(audioRecord.file_path);
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
        const uploadResult = await uploadToSoniox(audioBuffer, filename, audioMimeType);
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
            const aiResult = await analyzeTranscriptWithGemini(plainText, { outputLanguage });
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

  const upload = getAudioUploadMetadata(req, `${Date.now()}`);
  const fileName = `${discussionId}/${upload.filename}`;

  try {
    let { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('lab-discussion-audio')
      .upload(fileName, audioBuffer, {
        contentType: upload.mimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('bucket')) {
        await supabaseAdmin.storage.createBucket('lab-discussion-audio', { public: false });
        const retry = await supabaseAdmin.storage
          .from('lab-discussion-audio')
          .upload(fileName, audioBuffer, {
            contentType: upload.mimeType,
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
  const outputLanguage = req.body?.language === 'ar' ? 'ar' : 'en';
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

    const audioMimeType = audioData.type || mimeTypeFromFilename(discussion.audio_path);
    const audioBuffer = Buffer.from(await audioData.arrayBuffer());

    res.json({ message: 'Lab discussion transcription started.', status: 'processing' });

    (async () => {
      try {
        const filename = discussion.audio_path.split('/').pop() || 'lab-discussion.webm';
        const uploadResult = await uploadToSoniox(audioBuffer, filename, audioMimeType);
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
          aiResult = await analyzeLabDiscussionWithGemini(plainText, { outputLanguage });
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
  console.log(`  Gemini model: ${GEMINI_MODEL}`);
  console.log(`  Supabase Admin: ${supabaseAdmin ? '✓ configured' : '✗ missing'}`);
});
