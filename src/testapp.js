const state = {
  mode: 'consultation',
  mediaRecorder: null,
  stream: null,
  chunks: [],
  seconds: 0,
  timer: null,
  mockDoctors: ['Dr. Omar Mah', 'Dr. Layla Hassan'],
};

const els = {
  consultationModeBtn: document.getElementById('consultationModeBtn'),
  labsModeBtn: document.getElementById('labsModeBtn'),
  modeTitle: document.getElementById('modeTitle'),
  modeSubtitle: document.getElementById('modeSubtitle'),
  modePill: document.getElementById('modePill'),
  labsFields: document.getElementById('labsFields'),
  mockDoctorsInput: document.getElementById('mockDoctorsInput'),
  addMockDoctorBtn: document.getElementById('addMockDoctorBtn'),
  mockDoctorList: document.getElementById('mockDoctorList'),
  recordingDot: document.getElementById('recordingDot'),
  recordingLabel: document.getElementById('recordingLabel'),
  recordingTimer: document.getElementById('recordingTimer'),
  startRecordBtn: document.getElementById('startRecordBtn'),
  stopRecordBtn: document.getElementById('stopRecordBtn'),
  diagnosticsList: document.getElementById('diagnosticsList'),
  outputContent: document.getElementById('outputContent'),
  outputSubtitle: document.getElementById('outputSubtitle'),
};

const diagnosticSteps = [
  'Recording local microphone audio',
  'Uploading test audio to server',
  'Sending audio to Soniox',
  'Waiting for transcription',
  'Sending transcript to Gemini',
  'Rendering test outputs',
];

renderMode();
renderMockDoctors();
renderDiagnostics();

els.consultationModeBtn.addEventListener('click', () => setMode('consultation'));
els.labsModeBtn.addEventListener('click', () => setMode('labs'));
els.addMockDoctorBtn.addEventListener('click', addMockDoctor);
els.mockDoctorsInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addMockDoctor();
  }
});
els.startRecordBtn.addEventListener('click', startRecording);
els.stopRecordBtn.addEventListener('click', stopRecording);

function setMode(mode) {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') return;
  state.mode = mode;
  renderMode();
  renderDiagnostics();
  els.outputContent.className = 'empty-output';
  els.outputContent.textContent = 'Choose a mode, record a short sample, then stop the recording.';
}

function renderMode() {
  const isLabs = state.mode === 'labs';
  els.consultationModeBtn.classList.toggle('inactive', isLabs);
  els.labsModeBtn.classList.toggle('inactive', !isLabs);
  els.labsFields.classList.toggle('hidden', !isLabs);
  els.modeTitle.textContent = isLabs ? 'Doctor Discussion Test' : 'Doctor Consultation Test';
  els.modeSubtitle.textContent = isLabs
    ? 'Add mock doctor names, record an internal discussion, and inspect the report that would be sent to participating doctors.'
    : 'Record a mock doctor-patient consultation. No QR verification or patient lookup is required.';
  els.modePill.textContent = isLabs ? 'Labs Mode' : 'Consultation';
}

function addMockDoctor() {
  const name = els.mockDoctorsInput.value.trim();
  if (!name) return;
  if (!state.mockDoctors.includes(name)) state.mockDoctors.push(name);
  els.mockDoctorsInput.value = '';
  renderMockDoctors();
}

function renderMockDoctors() {
  els.mockDoctorList.innerHTML = state.mockDoctors
    .map(name => `<span>${escapeHtml(name)}</span>`)
    .join('');
}

async function startRecording() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaRecorder = new MediaRecorder(state.stream);
    state.chunks = [];

    state.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) state.chunks.push(event.data);
    };

    state.mediaRecorder.onstop = () => {
      const audioBlob = new Blob(state.chunks, { type: 'audio/webm' });
      state.stream.getTracks().forEach(track => track.stop());
      runPipeline(audioBlob);
    };

    state.mediaRecorder.start(1000);
    state.seconds = 0;
    els.recordingTimer.textContent = '00:00';
    state.timer = setInterval(tickTimer, 1000);

    els.recordingDot.classList.add('active');
    els.recordingLabel.textContent = state.mode === 'labs' ? 'Recording doctor discussion' : 'Recording consultation';
    els.startRecordBtn.disabled = true;
    els.stopRecordBtn.disabled = false;
    renderDiagnostics(0);
  } catch (error) {
    alert('Microphone access is required for this test.');
    console.error(error);
  }
}

function stopRecording() {
  if (!state.mediaRecorder || state.mediaRecorder.state === 'inactive') return;
  els.recordingLabel.textContent = 'Preparing audio';
  els.stopRecordBtn.disabled = true;
  state.mediaRecorder.stop();
  clearInterval(state.timer);
}

async function runPipeline(audioBlob) {
  try {
    renderDiagnostics(1);
    els.outputContent.className = 'empty-output';
    els.outputContent.textContent = 'Processing through Soniox and Gemini. This can take a minute.';
    els.outputSubtitle.textContent = 'Pipeline is running...';

    setTimeout(() => renderDiagnostics(2), 400);
    setTimeout(() => renderDiagnostics(3), 1200);
    setTimeout(() => renderDiagnostics(4), 2400);

    const result = await submitAudio(audioBlob);

    renderDiagnostics(5, true);
    els.outputSubtitle.textContent = 'Test pipeline completed.';
    renderOutput(result);
  } catch (error) {
    els.outputSubtitle.textContent = 'Pipeline failed.';
    els.outputContent.className = '';
    els.outputContent.innerHTML = `
      <section class="output-section">
        <h3>Pipeline Error</h3>
        <div class="display-tile"><p>${escapeHtml(error.message || 'Unknown error')}</p></div>
      </section>
    `;
  } finally {
    els.recordingDot.classList.remove('active');
    els.recordingLabel.textContent = 'Ready to record';
    els.startRecordBtn.disabled = false;
    els.stopRecordBtn.disabled = true;
  }
}

async function submitAudio(audioBlob) {
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
  const endpoint = state.mode === 'labs'
    ? `${serverUrl}/api/test/lab-discussion?participants=${encodeURIComponent(state.mockDoctors.join(','))}`
    : `${serverUrl}/api/test/consultation`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  if (!response.ok) throw new Error(data.error || 'The test pipeline failed.');
  return data;
}

function renderOutput(result) {
  els.outputContent.className = '';
  els.outputContent.innerHTML = state.mode === 'labs'
    ? renderLabOutput(result)
    : renderConsultationOutput(result);
}

function renderConsultationOutput(result) {
  const doctor = result.doctor_display || {};
  const patient = result.patient_display || {};
  return `
    <section class="output-section">
      <h3>Doctor SOAP Draft</h3>
      <div class="soap-grid">
        ${tile('Subjective', [
          doctor.subjective?.chief_complaint,
          doctor.subjective?.history,
          doctor.subjective?.allergies ? `Allergies: ${doctor.subjective.allergies}` : ''
        ].filter(Boolean).join(' '))}
        ${tile('Objective', [
          formatVitals(doctor.objective?.vitals),
          doctor.objective?.examination
        ].filter(Boolean).join(' '))}
        ${tile('Assessment', [
          (doctor.assessment?.diagnoses || []).join(', '),
          doctor.assessment?.reasoning
        ].filter(Boolean).join(' '))}
        ${tile('Plan', (doctor.plan || []).map(item => `${item.label}: ${item.value}`).join(' '))}
      </div>
    </section>
    <section class="output-section">
      <h3>Patient-Side Simple Language</h3>
      <div class="patient-language-grid">
        ${tile('What you came for', patient.what_you_came_for)}
        ${tile('What was discussed', patient.what_was_discussed)}
        ${tile('What the doctor found', patient.what_the_doctor_found)}
        ${tile('What happens next', patient.what_happens_next)}
      </div>
    </section>
    ${renderJsonAndTranscript(result)}
  `;
}

function renderLabOutput(result) {
  const display = result.doctor_display || {};
  return `
    <section class="output-section">
      <h3>Participating Doctor Report</h3>
      <div class="lab-grid">
        ${tile('Headline', display.title)}
        ${tile('Participants', (display.participants || []).join(', '))}
        ${tile('Summary', display.summary)}
        ${tile('Prominent Points', listText(display.prominent_points))}
        ${tile('Decisions', listText(display.decisions))}
        ${tile('Action Plan', listText(display.action_plan))}
      </div>
    </section>
    ${renderJsonAndTranscript(result)}
  `;
}

function renderJsonAndTranscript(result) {
  return `
    <section class="output-section">
      <h3>Gemini JSON</h3>
      <pre class="output-json">${escapeHtml(JSON.stringify(result.analysis_json || {}, null, 2))}</pre>
    </section>
    <section class="output-section">
      <h3>Soniox Transcript</h3>
      <pre class="transcript-box">${escapeHtml(result.transcript_text || 'No transcript returned.')}</pre>
    </section>
  `;
}

function renderDiagnostics(activeIndex = -1, completeAll = false) {
  els.diagnosticsList.innerHTML = diagnosticSteps.map((step, index) => {
    const done = completeAll || index < activeIndex;
    const active = !completeAll && index === activeIndex;
    const icon = done ? 'uil-check-circle' : active ? 'uil-sync uil-spin' : 'uil-circle';
    return `<div class="diagnostic-row ${done ? 'done' : ''} ${active ? 'active' : ''}"><i class="uil ${icon}"></i>${escapeHtml(step)}</div>`;
  }).join('');
}

function tickTimer() {
  state.seconds += 1;
  const minutes = String(Math.floor(state.seconds / 60)).padStart(2, '0');
  const seconds = String(state.seconds % 60).padStart(2, '0');
  els.recordingTimer.textContent = `${minutes}:${seconds}`;
}

function tile(label, value) {
  return `<div class="display-tile"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(value || 'Not returned.')}</p></div>`;
}

function listText(value) {
  if (!Array.isArray(value)) return value || '';
  return value.map(item => {
    if (typeof item === 'string') return item;
    return [item.label, item.owner, item.value].filter(Boolean).join(' - ');
  }).join(' ');
}

function formatVitals(vitals) {
  if (!vitals) return '';
  if (typeof vitals === 'string') return vitals;
  return Object.entries(vitals).map(([key, value]) => `${key}: ${value}`).join(', ');
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value === null || value === undefined ? '' : String(value);
  return div.innerHTML;
}
