import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

const SONIOX_API_KEY = process.env.SONIOX_API_KEY;
const SONIOX_API_BASE = 'https://api.soniox.com';
const SONIOX_TEST_MODEL = 'stt-async-v5';
const geminiApiKey = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const testAppPassword = process.env.TEST_APP_PASSWORD;
const gemini = geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here'
  ? new GoogleGenerativeAI(geminiApiKey)
  : null;

app.use(cors());
app.use(express.json());

function requireTestAppPassword(req, res, next) {
  if (!testAppPassword) {
    return res.status(500).json({ error: 'TEST_APP_PASSWORD is not configured on the server.' });
  }
  if (req.headers['x-test-app-password'] !== testAppPassword) {
    return res.status(401).json({ error: 'Invalid testing password.' });
  }
  next();
}

async function sonioxFetch(endpoint, { method = 'GET', body, headers = {} } = {}) {
  if (!SONIOX_API_KEY || SONIOX_API_KEY === 'your_soniox_api_key_here') {
    throw new Error('SONIOX_API_KEY is not configured.');
  }

  const res = await fetch(`${SONIOX_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${SONIOX_API_KEY}`,
      ...headers,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Soniox API error (${res.status}): ${await res.text()}`);
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

async function uploadToSoniox(audioBuffer, filename, mimeType = 'application/octet-stream') {
  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
  form.append('client_reference_id', 'clinotes-test');
  return sonioxFetch('/v1/files', { method: 'POST', body: form });
}

function buildTranscriptionConfig(fileId) {
  return {
    model: SONIOX_TEST_MODEL,
    file_id: fileId,
    enable_speaker_diarization: true,
    enable_language_identification: true,
    language_hints: ['en', 'ar'],
    context: {
      general: [
        { key: 'domain', value: 'Healthcare / Clinical Medicine' },
        { key: 'topic', value: 'Doctor-patient clinical consultation' },
        { key: 'setting', value: 'Medical clinic or hospital outpatient department' },
        { key: 'languages', value: 'English and Arabic, possibly mixed within sentences' },
      ],
      text: `This is a clinical consultation recording between a healthcare provider and a patient.
The conversation may switch between English and Arabic. It may include symptoms, medical history,
diagnosis discussion, medications, lab or imaging orders, referrals, and follow-up planning.`,
      terms: [
        'hypertension', 'hypotension', 'tachycardia', 'bradycardia', 'mmHg', 'mg/dL', 'bpm',
        'diabetes', 'diabetes mellitus', 'hyperlipidemia', 'asthma', 'COPD', 'pneumonia',
        'anemia', 'ECG', 'EKG', 'CBC', 'MRI', 'CT scan', 'X-ray', 'ultrasound',
        'HbA1c', 'A1C', 'creatinine', 'TSH', 'Metformin', 'Lisinopril', 'Amlodipine',
        'Omeprazole', 'Amoxicillin', 'Paracetamol', 'Ibuprofen', 'Aspirin',
      ],
    },
    client_reference_id: 'clinotes-test',
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
      text: `This is an internal clinical discussion between doctors. The speakers may discuss lab
results, imaging findings, differential diagnoses, care coordination, treatment options, and action items.`,
      terms: ['CBC', 'HbA1c', 'A1C', 'lipid profile', 'creatinine', 'MRI', 'CT scan', 'X-ray', 'ultrasound', 'D-dimer', 'troponin'],
    },
    client_reference_id: 'clinotes-test-lab',
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
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Transcription timed out after 5 minutes.');
}

async function cleanupSoniox(transcriptionId, fileId) {
  try {
    if (transcriptionId) await sonioxFetch(`/v1/transcriptions/${transcriptionId}`, { method: 'DELETE' });
  } catch (error) {
    console.warn('Failed to delete Soniox transcription:', error.message);
  }
  try {
    if (fileId) await sonioxFetch(`/v1/files/${fileId}`, { method: 'DELETE' });
  } catch (error) {
    console.warn('Failed to delete Soniox file:', error.message);
  }
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
    const transcriptResult = await sonioxFetch(`/v1/transcriptions/${sonioxTranscriptionId}/transcript`);
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

function getOutputLanguageInstructions(outputLanguage = 'en', mode = 'consultation') {
  if (outputLanguage !== 'ar') {
    return mode === 'consultation'
      ? 'For patient_summary, always write in English. Use plain language and do not add facts.'
      : 'Write all summary, report, decision, and action-plan display values in English unless directly quoting a speaker.';
  }

  if (mode === 'lab') {
    return 'Write all report display values in Arabic. Keep JSON keys in English. Only disease names and diagnosis names should remain in English inside square brackets, e.g. [diabetes], [pneumonia]. Translate non-diagnosis explanatory text into Arabic.';
  }

  return `Write every human-readable consultation value in natural Modern Standard Arabic, including summary_text, title, all SOAP field values, plan labels, plan values, recommended action reasons/timing/instructions, and patient_summary.
Keep JSON keys and status values exactly in English.
For SOAP notes specifically, do not leave ordinary explanatory text in English. Use Arabic phrasing that sounds natural to a clinician.
The only exceptions inside Arabic SOAP notes are disease/diagnosis names and medication names:
- Disease/diagnosis names must be written in Arabic followed by the English name in square brackets, e.g. "السكري [diabetes]", "الربو [asthma]", "ارتفاع ضغط الدم [hypertension]".
- Medication names must be written in Arabic or common Arabic transliteration followed by the English generic/brand name in square brackets, e.g. "باراسيتامول [Paracetamol]", "ميتفورمين [Metformin]".
Do not use English-only disease names or English-only medication names in Arabic mode.
Do not bracket lab names, imaging names, abbreviations, doctor names, general technical terms, timings, frequencies, or instructions unless they are a disease/diagnosis or medication name. Translate those into Arabic where possible.
For plan.label in Arabic mode, use concise Arabic labels such as "دواء", "تحاليل", "أشعة", "متابعة", or "إحالة".`;
}

async function analyzeTranscriptWithGemini(transcriptText, { outputLanguage = 'en', geminiModel = GEMINI_MODEL } = {}) {
  if (!gemini) throw new Error('Gemini API key is not configured on the server.');

  const systemPrompt = `
You are a medical documentation assistant. Analyze Arabic-English code-switched consultation transcripts.
Create notes that are clinically useful, moderately detailed, and easy to scan. Do not make the SOAP note overly brief. Do not add clutter, speculation, or facts not supported by the transcript.
Return strictly valid JSON:
{
  "summary_text": "2-4 concise sentences summarizing the main problem, clinically relevant context, assessment, and plan",
  "structured_data": {
    "title": "Short descriptive title",
    "subjective": {
      "chief_complaint": "1 clear sentence with the patient's main reason for the visit",
      "history": "2-5 concise sentences with symptom details, duration, relevant medical history, and context mentioned in the transcript",
      "allergies": "Allergies mentioned; empty string if not mentioned",
      "notes": "Other relevant subjective details, including important negatives only if explicitly discussed"
    },
    "objective": {
      "vitals": { "blood_pressure": "", "heart_rate": "", "temperature": "" },
      "examination": "Objective exam findings or observations mentioned; empty string if none"
    },
    "assessment": {
      "diagnoses": ["suspected or confirmed diagnoses only"],
      "reasoning": "2-4 concise sentences explaining how symptoms, history, exam, or results support the assessment"
    },
    "plan": [
      { "label": "Medication | Test | Imaging | Follow-up | Referral | Advice", "value": "Specific plan item with relevant dose/timing/reason when mentioned" }
    ],
    "recommended_actions": {
      "follow_up": { "needed": false, "timing": "", "reason": "", "status": "pending" },
      "prescription": {
        "needed": true,
        "medications": [
          {
            "name": "Medication name exactly as stated",
            "dose": "Dose if mentioned; otherwise empty string",
            "frequency": "Frequency if mentioned; otherwise empty string",
            "duration": "Duration if mentioned; otherwise empty string",
            "instructions": "Other instructions if mentioned; otherwise empty string"
          }
        ],
        "status": "pending"
      },
      "lab_order": {
        "needed": true,
        "orders": [
          {
            "type": "Lab | Imaging | Scan | Test",
            "name": "Exact test, scan, or imaging name",
            "reason": "Clinical reason if mentioned; otherwise empty string",
            "priority": "Urgent only when explicitly indicated; otherwise Routine"
          }
        ],
        "status": "pending"
      },
      "referral": { "needed": false, "specialty": "", "reason": "", "debrief": "", "status": "pending" }
    },
    "patient_summary": {
      "what_you_came_for": "1 simple sentence",
      "what_was_discussed": "1-2 simple sentences",
      "what_the_doctor_found": "1-2 simple sentences",
      "what_happens_next": "1-2 simple sentences"
    },
    "cleaned_transcript": "The same transcript text, lightly cleaned."
  }
}
SOAP detail rules:
- Prefer complete, clinically useful sentences over fragments.
- Keep each field focused. Avoid long paragraphs, repeated information, generic filler, and unsupported normal findings.
- If a detail is not mentioned, leave the field empty instead of guessing.

Recommended action rules:
- Decide recommended_actions from transcript evidence using the same criteria every time.
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
For cleaned_transcript, preserve meaning and order; correct obvious English medical terminology mistakes.
Medication-name cleanup is especially important:
- Check every medication mention against your medical knowledge and write a real, correctly spelled generic or brand medication name rather than preserving a non-existent phonetic spelling.
- When Soniox produced an Arabic transliteration or a slightly corrupted Latin spelling, convert it to the nearest real medication name supported by the pronunciation, dose, indication, and surrounding clinical context.
- If a mention is ambiguous but one real medication is clearly the closest contextual and phonetic match, use that canonical medication name.
- Never replace an unclear mention with an unrelated medication merely because it is common. If no candidate is reasonably supported, preserve the unclear wording and mark it "[unclear medication]" instead of inventing a drug.
- Keep canonical medication names in Latin letters. In Arabic output, write the Arabic name or transliteration followed by the canonical name in square brackets.
${getOutputLanguageInstructions(outputLanguage, 'consultation')}
All line breaks inside string values must be escaped as \\n.
`;

  const model = gemini.getGenerativeModel({
    model: geminiModel,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.05, responseMimeType: 'application/json' },
  });
  const result = await parseGeminiJsonResponse(
    await model.generateContent(transcriptText),
    'consultation analysis',
    geminiModel
  );
  return normalizeRecommendedActionRows(result);
}

async function analyzeLabDiscussionWithGemini(transcriptText, { outputLanguage = 'en', geminiModel = GEMINI_MODEL } = {}) {
  if (!gemini) throw new Error('Gemini API key is not configured on the server.');

  const systemPrompt = `
You are a clinical documentation assistant. Analyze an internal doctor-to-doctor discussion transcript.
Return strictly valid JSON:
{
  "summary_text": "Concise summary",
  "structured_data": {
    "title": "Clear headline",
    "prominent_points": [],
    "decisions": [],
    "open_questions": [],
    "action_plan": [{ "label": "Action", "owner": "", "value": "" }],
    "cleaned_transcript": "The same transcript text, lightly cleaned."
  }
}
Do not invent facts. If an item is not mentioned, use an empty array.
For cleaned_transcript medication mentions, verify that each drug name is a real, correctly spelled medication. Correct Arabic transliterations and corrupted Latin spellings to the nearest canonical generic or brand name supported by pronunciation and clinical context. If one candidate is clearly the closest match, use it. If no candidate is reasonably supported, preserve the wording and mark it "[unclear medication]" rather than inventing a drug. Keep canonical medication names in Latin letters; in Arabic text, place the canonical name in square brackets after the Arabic name or transliteration.
${getOutputLanguageInstructions(outputLanguage, 'lab')}
All line breaks inside string values must be escaped as \\n.
`;

  const model = gemini.getGenerativeModel({
    model: geminiModel,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });
  return parseGeminiJsonResponse(await model.generateContent(transcriptText), 'lab discussion analysis', geminiModel);
}

async function parseGeminiJsonResponse(response, contextLabel = 'Gemini response', geminiModel = GEMINI_MODEL) {
  const rawText = response.response.text();
  try {
    return JSON.parse(extractJsonCandidate(rawText));
  } catch (initialError) {
    console.warn(`[Gemini] Invalid JSON for ${contextLabel}: ${initialError.message}`);
    const repairModel = gemini.getGenerativeModel({
      model: geminiModel,
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    });
    const repairPrompt = `Fix only the JSON syntax. Preserve all keys, values, medical content, Arabic text, English terms, arrays, and object structure. Return only valid JSON.\n\n${rawText}`;
    const repaired = await repairModel.generateContent(repairPrompt);
    return JSON.parse(extractJsonCandidate(repaired.response.text()));
  }
}

function extractJsonCandidate(text = '') {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  return firstBrace >= 0 && lastBrace > firstBrace ? candidate.slice(firstBrace, lastBrace + 1) : candidate;
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

function normalizePlanItemsForDisplay(plan) {
  if (!plan) return [];
  if (Array.isArray(plan)) {
    return plan.map(item => ({
      label: item.label || item.type || 'Plan',
      value: item.value || item.description || item,
    })).filter(item => item.value);
  }
  return Object.entries(plan).flatMap(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return values.filter(Boolean).map(item => ({
      label: key.replace(/_/g, ' '),
      value: item,
    }));
  });
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
  return aiResult?.structured_data?.cleaned_transcript || aiResult?.cleaned_transcript || fallbackText || '';
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

function renderTranscriptMarkdown(tokens, transcriptionMeta = {}) {
  const lines = ['# Clinical Consultation Transcript', '', `**Date:** ${new Date().toLocaleDateString('en-US')}`];
  if (transcriptionMeta.audio_duration_ms) {
    const durationSec = Math.round(transcriptionMeta.audio_duration_ms / 1000);
    lines.push(`**Duration:** ${Math.floor(durationSec / 60)}m ${durationSec % 60}s`);
  }
  lines.push('', '---', '');
  let currentSpeaker = null;
  let currentText = [];
  const flushSpeaker = () => {
    if (currentText.length && currentSpeaker !== null) {
      lines.push(`**Speaker ${currentSpeaker}**:`, '', `> ${currentText.join('').trim()}`, '');
    }
    currentText = [];
  };
  for (const token of tokens) {
    if (token.speaker !== undefined && token.speaker !== currentSpeaker) {
      flushSpeaker();
      currentSpeaker = token.speaker;
    }
    currentText.push(token.text);
  }
  flushSpeaker();
  if (lines.length <= 6) lines.push(tokens.map(token => token.text).join(''));
  lines.push('', '---', '*Transcribed by Soniox AI - CliNotes*');
  return lines.join('\n');
}

app.post('/api/test-auth', requireTestAppPassword, (req, res) => {
  res.json({ ok: true });
});

app.post('/api/test/consultation', requireTestAppPassword, express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  if (!req.body || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'No audio data received.' });
  try {
    const outputLanguage = req.query.language === 'ar' ? 'ar' : 'en';
    const upload = getAudioUploadMetadata(req, `test-consultation-${Date.now()}.webm`);
    const result = await runTestAudioPipeline(req.body, {
      filename: upload.filename,
      mimeType: upload.mimeType,
      transcriptionConfig: fileId => buildTranscriptionConfig(fileId),
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
    console.error('[TestOnly] Consultation test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/test/lab-discussion', requireTestAppPassword, express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  if (!req.body || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'No audio data received.' });
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
      transcriptionConfig: fileId => buildLabDiscussionTranscriptionConfig(fileId, participants),
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
    console.error('[TestOnly] Lab discussion test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use('/assets', express.static(path.join(distPath, 'assets')));

app.get(['/', '/testapp.html'], (_req, res) => {
  res.sendFile(path.join(distPath, 'testapp.html'));
});

app.use((_req, res) => {
  res.status(404).send('Not found');
});

app.listen(port, () => {
  console.log(`CliNotes test-only server running on port ${port}`);
  console.log(`  Soniox: ${SONIOX_API_KEY ? 'configured' : 'missing'}`);
  console.log(`  Gemini: ${gemini ? 'configured' : 'missing'}`);
  console.log(`  Test password: ${testAppPassword ? 'configured' : 'missing'}`);
});
