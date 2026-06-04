const state = {
  mode: 'consultation',
  mediaRecorder: null,
  stream: null,
  chunks: [],
  seconds: 0,
  timer: null,
  mockDoctors: ['Dr. Omar Mah', 'Dr. Layla Hassan'],
  lastRecommendedActions: [],
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
  uploadConsultationLabel: document.getElementById('uploadConsultationLabel'),
  uploadConsultationInput: document.getElementById('uploadConsultationInput'),
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
els.uploadConsultationInput.addEventListener('change', handleConsultationUpload);
els.outputContent.addEventListener('click', event => {
  const button = event.target.closest('.print-test-action-btn');
  if (!button) return;
  const action = state.lastRecommendedActions.find(item => item.key === button.dataset.actionKey);
  if (action) printTestRecommendedAction(action);
});

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
  els.uploadConsultationLabel.classList.toggle('hidden', isLabs);
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
    .map(name => `
      <span>
        ${escapeHtml(name)}
        <button type="button" class="remove-mock-doctor-btn" data-name="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">
          <i class="uil uil-times"></i>
        </button>
      </span>
    `)
    .join('');

  els.mockDoctorList.querySelectorAll('.remove-mock-doctor-btn').forEach(button => {
    button.addEventListener('click', () => {
      state.mockDoctors = state.mockDoctors.filter(name => name !== button.dataset.name);
      renderMockDoctors();
    });
  });
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

async function handleConsultationUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  if (state.mode !== 'consultation') {
    alert('Audio upload is currently available for patient consultation testing only.');
    return;
  }

  els.recordingLabel.textContent = 'Uploaded audio selected';
  els.recordingTimer.textContent = '--:--';
  els.startRecordBtn.disabled = true;
  els.stopRecordBtn.disabled = true;
  els.uploadConsultationLabel.classList.add('disabled');

  await runPipeline(file);
  els.recordingTimer.textContent = '00:00';
  els.uploadConsultationLabel.classList.remove('disabled');
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
  const recommendedActions = extractRecommendedActions(result.analysis_json);
  state.lastRecommendedActions = recommendedActions;
  return `
    <section class="output-section">
      <h3>Doctor SOAP Draft</h3>
      ${renderDoctorSoapDraft(doctor)}
    </section>
    <section class="output-section">
      <h3>Recommended Actions</h3>
      ${renderRecommendedActions(recommendedActions)}
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

function extractRecommendedActions(analysisJson = {}) {
  const structured = analysisJson.structured_data || analysisJson;
  const actions = structured.recommended_actions || {};
  const result = [];

  if (actions.follow_up?.needed) {
    result.push({
      key: 'follow_up',
      type: 'follow_up',
      icon: 'uil-calendar-alt',
      tone: 'follow-up',
      title: 'Book follow-up consultation',
      detail: actions.follow_up.timing || actions.follow_up.reason || 'Follow-up recommended',
      data: actions.follow_up,
      body: [
        ['Timing', actions.follow_up.timing],
        ['Reason', actions.follow_up.reason]
      ]
    });
  }

  if (actions.prescription?.needed) {
    const medications = Array.isArray(actions.prescription.medications) ? actions.prescription.medications : [];
    result.push({
      key: 'prescription',
      type: 'prescription',
      icon: 'uil-capsule',
      tone: 'medication',
      title: 'Prescription draft',
      detail: medications.map(med => med.name).filter(Boolean).join(', ') || 'Medication draft generated',
      data: actions.prescription,
      body: medications.map(med => [
        med.name || 'Medication',
        [med.dose, med.frequency, med.duration, med.instructions].filter(Boolean).join(' - ')
      ])
    });
  }

  if (actions.lab_order?.needed) {
    const orders = Array.isArray(actions.lab_order.orders) ? actions.lab_order.orders : [];
    result.push({
      key: 'lab_order',
      type: 'lab_order',
      icon: 'uil-flask',
      tone: 'lab',
      title: 'Lab or imaging order',
      detail: orders.map(order => order.name).filter(Boolean).join(', ') || 'Order draft generated',
      data: actions.lab_order,
      body: orders.map(order => [
        order.name || 'Order',
        [order.type, order.priority, order.reason].filter(Boolean).join(' - ')
      ])
    });
  }

  if (actions.referral?.needed) {
    result.push({
      key: 'referral',
      type: 'referral',
      icon: 'uil-share-alt',
      tone: 'referral',
      title: 'Referral draft',
      detail: actions.referral.specialty || actions.referral.reason || 'Referral draft generated',
      data: actions.referral,
      body: [
        ['Specialty', actions.referral.specialty],
        ['Reason', actions.referral.reason],
        ['Debrief', actions.referral.debrief]
      ]
    });
  }

  return result;
}

function renderRecommendedActions(actions) {
  if (!actions.length) {
    return `
      <div class="recommended-actions-preview empty-recommended-actions">
        <i class="uil uil-check-circle"></i>
        <div>
          <strong>No recommended actions generated</strong>
          <p>Gemini did not return follow-up, prescription, lab order, or referral actions for this test consultation.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="recommended-actions-preview">
      ${actions.map(action => `
        <article class="test-recommended-action action-${action.tone}">
          <div class="recommended-action-icon"><i class="uil ${action.icon}"></i></div>
          <div>
            <strong>${escapeHtml(action.title)}</strong>
            <p>${escapeHtml(action.detail)}</p>
            ${renderRecommendedActionDetails(action.body)}
            <button type="button" class="print-test-action-btn" data-action-key="${escapeHtml(action.key)}">
              <i class="uil uil-print"></i> View printable version
            </button>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function printTestRecommendedAction(action) {
  const theme = getPrintTheme(action.type);
  const printedAt = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const body = renderPrintableActionDetails(action);
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(action.title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 36px; color: #111827; background: #FFFFFF; }
          .print-page { min-height: calc(100vh - 72px); border: 1px solid #E5E7EB; border-radius: 18px; overflow: hidden; }
          .print-header { display: flex; justify-content: space-between; gap: 24px; padding: 28px 32px; background: ${theme.soft}; border-bottom: 4px solid ${theme.color}; }
          .brand { font-size: 13px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: ${theme.color}; }
          h1 { margin: 8px 0 0; color: #111827; font-size: 30px; line-height: 1.1; }
          .print-date { text-align: right; color: #374151; font-size: 13px; font-weight: 700; }
          .print-body { padding: 28px 32px 32px; }
          .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 26px; }
          .meta-item { border: 1px solid #E5E7EB; border-radius: 12px; padding: 13px 14px; background: #F9FAFB; }
          .label { display: block; margin-bottom: 5px; color: #6B7280; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.04em; }
          .value { display: block; color: #111827; font-size: 14px; font-weight: 800; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; table-layout: fixed; }
          th { text-align: left; color: #374151; background: ${theme.soft}; border: 1px solid #D1D5DB; padding: 11px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
          td { border: 1px solid #D1D5DB; padding: 12px 10px; min-height: 42px; color: #111827; font-size: 13px; line-height: 1.45; vertical-align: top; word-break: break-word; }
          .section { border: 1px solid #E5E7EB; border-radius: 14px; margin-bottom: 16px; overflow: hidden; }
          .section h2 { margin: 0; padding: 12px 14px; background: ${theme.soft}; color: ${theme.color}; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
          .section p { margin: 0; padding: 15px 16px; color: #111827; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
          .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 40px; }
          .signature-line { border-top: 1px solid #9CA3AF; padding-top: 10px; color: #4B5563; font-size: 12px; font-weight: 700; }
          .footer-note { margin-top: 28px; padding-top: 14px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 11px; line-height: 1.45; }
          @media print {
            body { padding: 0; }
            .print-page { border: none; border-radius: 0; min-height: auto; }
          }
        </style>
      </head>
      <body>
        <main class="print-page">
          <header class="print-header">
            <div>
              <div class="brand">CliNotes Test Page</div>
              <h1>${escapeHtml(action.title)}</h1>
            </div>
            <div class="print-date">
              <span class="label">Printed</span>
              ${escapeHtml(printedAt)}
            </div>
          </header>
          <section class="print-body">
            <div class="meta-grid">
              <div class="meta-item"><span class="label">Doctor</span><strong class="value">TEST Doc</strong></div>
              <div class="meta-item"><span class="label">Patient</span><strong class="value">TEST Patient</strong></div>
              <div class="meta-item"><span class="label">Consultation Date</span><strong class="value">${escapeHtml(printedAt)}</strong></div>
            </div>
            ${body}
            <div class="signature-row">
              <div class="signature-line">Doctor signature</div>
              <div class="signature-line">Clinic stamp / date</div>
            </div>
            <p class="footer-note">Testing page preview only. Not part of the real app and not written to the database.</p>
          </section>
        </main>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
}

function renderPrintableActionDetails(action) {
  const data = action.data || {};

  if (action.type === 'prescription') {
    const medications = Array.isArray(data.medications) ? data.medications : [];
    return `
      <table>
        <thead><tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
        <tbody>
          ${medications.map(med => `
            <tr>
              <td>${escapeHtml(med.name || '')}</td>
              <td>${escapeHtml(med.dose || '')}</td>
              <td>${escapeHtml(med.frequency || '')}</td>
              <td>${escapeHtml(med.duration || '')}</td>
              <td>${escapeHtml(med.instructions || '')}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">No medications listed.</td></tr>'}
        </tbody>
      </table>
    `;
  }

  if (action.type === 'lab_order') {
    const orders = Array.isArray(data.orders) ? data.orders : [];
    return `
      <table>
        <thead><tr><th>Type</th><th>Order</th><th>Reason</th><th>Priority</th></tr></thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td>${escapeHtml(order.type || '')}</td>
              <td>${escapeHtml(order.name || '')}</td>
              <td>${escapeHtml(order.reason || '')}</td>
              <td>${escapeHtml(order.priority || 'Routine')}</td>
            </tr>
          `).join('') || '<tr><td colspan="4">No orders listed.</td></tr>'}
        </tbody>
      </table>
    `;
  }

  if (action.type === 'referral') {
    return `
      <section class="section"><h2>Referral Specialty</h2><p>${escapeHtml(data.specialty || '')}</p></section>
      <section class="section"><h2>Reason for Referral</h2><p>${escapeHtml(data.reason || '')}</p></section>
      <section class="section"><h2>Patient Debrief for Next Doctor</h2><p>${escapeHtml(data.debrief || '')}</p></section>
    `;
  }

  return `
    <section class="section"><h2>Follow-up Date / Timing</h2><p>${escapeHtml(data.timing || action.detail || '')}</p></section>
    <section class="section"><h2>Reason</h2><p>${escapeHtml(data.reason || 'Follow-up consultation')}</p></section>
  `;
}

function getPrintTheme(type) {
  return {
    follow_up: { color: '#10B981', soft: '#ECFDF5' },
    prescription: { color: '#EA580C', soft: '#FFF7ED' },
    lab_order: { color: '#2563EB', soft: '#EFF6FF' },
    referral: { color: '#BE185D', soft: '#FDF2F8' }
  }[type] || { color: '#2F6FED', soft: '#EFF6FF' };
}

function renderRecommendedActionDetails(items = []) {
  const rows = (items || []).filter(item => Array.isArray(item) && (item[0] || item[1]));
  if (!rows.length) return '';
  return `
    <dl class="recommended-action-details">
      ${rows.map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label || 'Detail')}</dt>
          <dd>${escapeHtml(value || 'Not returned.')}</dd>
        </div>
      `).join('')}
    </dl>
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
      <h3>Transcript</h3>
      <pre class="transcript-box" dir="auto">${escapeHtml(result.transcript_text || 'No transcript returned.')}</pre>
    </section>
  `;
}

function renderDoctorSoapDraft(doctor) {
  const treatment = (doctor.plan || [])
    .filter(item => !String(item.label || '').toLowerCase().includes('follow'))
    .map(item => `${item.label}: ${item.value}`)
    .join('\n');
  const followUp = (doctor.plan || [])
    .find(item => String(item.label || '').toLowerCase().includes('follow'))?.value || '';

  return `
    <div class="doctor-soap-draft">
      <div class="soap-title">${escapeHtml(doctor.title || 'Clinical Consultation Draft')}</div>
      <div class="soap-columns">
        <div class="soap-column">
          <h4>Subjective</h4>
          ${soapField('Chief Complaint', doctor.subjective?.chief_complaint)}
          ${soapField('Medical History', doctor.subjective?.history)}
          ${soapField('Allergies', doctor.subjective?.allergies)}
          <h4>Objective</h4>
          ${soapField('Vitals', formatVitals(doctor.objective?.vitals))}
          ${soapField('Physical Exam', doctor.objective?.examination)}
        </div>
        <div class="soap-column">
          <h4>Assessment</h4>
          ${soapField('Diagnoses', (doctor.assessment?.diagnoses || []).join(', '))}
          <h4>Plan</h4>
          ${soapField('Treatment', treatment)}
          ${soapField('Follow Up', followUp)}
        </div>
      </div>
    </div>
  `;
}

function soapField(label, value) {
  return `
    <div class="soap-field">
      <label>${escapeHtml(label)}</label>
      <div>${escapeHtml(value || '')}</div>
    </div>
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
