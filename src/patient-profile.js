import { api } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // ─── Auth Guard ───
  try {
    const session = await api.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    const role = await api.auth.getCurrentUserRole();
    if (role !== 'doctor') { window.location.href = '/patient.html'; return; }
  } catch (e) { window.location.href = '/'; return; }

  // ─── DOM Elements ───
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const errorMessage = document.getElementById('errorMessage');
  const patientHeader = document.getElementById('patientHeader');
  const historySection = document.getElementById('historySection');
  const consultationList = document.getElementById('consultationList');
  const emptyConsultations = document.getElementById('emptyConsultations');

  // ─── Get Patient ID from URL ───
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('id');

  if (!patientId) {
    showError('No patient ID provided. Please navigate from the dashboard.');
    return;
  }

  // ─── Load Doctor Info for avatar ───
  try {
    const docInfo = await api.data.getDoctorInfo();
    if (docInfo && docInfo.name) {
      const initials = docInfo.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      document.getElementById('docInitials').innerText = initials;
    }
  } catch (e) { /* non-critical */ }

  // ─── Load Patient Profile ───
  try {
    const patient = await api.data.getPatientProfile(patientId);
    if (!patient) {
      showError('Patient record not found in the database.');
      return;
    }

    // Render patient header
    renderPatientHeader(patient);

    // Load consultations
    const consultations = await api.data.getPatientConsultations(patientId);
    renderConsultations(consultations);

    // Hide loading, show content
    loadingState.classList.add('hidden');
    patientHeader.classList.remove('hidden');
    historySection.classList.remove('hidden');

  } catch (e) {
    console.error('Failed to load patient profile:', e);
    showError('Failed to load patient data. Please check permissions and try again.');
  }

  // ─── Render Functions ───

  function renderPatientHeader(patient) {
    const name = patient.name || 'Unknown Patient';
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    document.getElementById('patientFullName').innerText = name;
    document.getElementById('patientInitials').innerText = initials;
    document.getElementById('breadcrumbName').innerText = name;

    const metaParts = [];
    if (patient.age) metaParts.push(`Age: ${patient.age}`);
    if (patient.gender) metaParts.push(`Gender: ${patient.gender}`);
    document.getElementById('patientMeta').innerText = metaParts.join(' • ') || 'No details available';

    document.title = `${name} - CliNotes`;
  }

  function renderConsultations(consultations) {
    if (!consultations || consultations.length === 0) {
      consultationList.classList.add('hidden');
      emptyConsultations.classList.remove('hidden');
      document.getElementById('totalConsultations').innerText = '0';
      return;
    }

    document.getElementById('totalConsultations').innerText = consultations.length;

    // Last visit date
    const lastDate = new Date(consultations[0].date_time);
    document.getElementById('lastVisitDate').innerText = lastDate.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    consultationList.innerHTML = '';

    consultations.forEach((cons, index) => {
      const card = buildConsultationCard(cons, index === 0);
      consultationList.appendChild(card);
    });

    // Setup filter pills
    setupFilters(consultations);
  }

  function buildConsultationCard(cons, expandFirst = false) {
    const date = new Date(cons.date_time);
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

    // Extract data from the joined tables
    const summary = cons.ai_summary?.[0] || null;
    const structured = summary?.structured_data || null;
    const recommendation = cons.doctor_recommendation?.[0] || null;
    const doctorName = cons.doctor?.name || 'Unknown Doctor';
    const doctorSpecialty = cons.doctor?.specialty || '';

    // Build a display title from structured data or summary
    const title = structured?.title
      || (structured?.diagnoses && structured.diagnoses.length > 0
        ? `Consultation: ${structured.diagnoses.join(', ')}`
        : (summary?.summary_text
          ? summary.summary_text.substring(0, 60) + '...'
          : 'Consultation'));

    const previewText = summary?.summary_text
      || 'AI summary not yet generated for this consultation.';

    // Status badge
    const statusMap = {
      'pending': { label: 'Pending', class: 'status-pending' },
      'processed': { label: 'AI Ready', class: 'status-processed' },
      'reviewed': { label: 'Reviewed', class: 'status-reviewed' }
    };
    const status = statusMap[cons.status] || statusMap['pending'];

    const card = document.createElement('div');
    card.className = `consultation-card ${expandFirst ? 'expanded' : ''}`;
    card.dataset.status = cons.status;

    card.innerHTML = `
      <!-- Header (Always visible) -->
      <div class="consultation-header">
        <div class="cons-header-left">
          <div class="date-badge">
            <span class="month">${monthNames[date.getMonth()]}</span>
            <span class="day">${String(date.getDate()).padStart(2, '0')}</span>
            <span class="year">${date.getFullYear()}</span>
          </div>
          <div class="cons-preview">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(previewText.substring(0, 120))}${previewText.length > 120 ? '...' : ''}</p>
          </div>
        </div>
        <div class="cons-header-right">
          <span class="badge ${status.class}">${status.label}</span>
          <span class="doctor-tag"><i class="uil uil-user-md"></i> ${escapeHtml(doctorName)}</span>
          <button class="expand-btn"><i class="uil uil-angle-down"></i></button>
        </div>
      </div>

      <!-- Body (SOAP structure) -->
      <div class="consultation-body" style="${expandFirst ? 'display: block;' : ''}">
        ${buildConsultationBody(cons, structured, summary, recommendation, doctorName, doctorSpecialty)}
      </div>
    `;

    // Toggle expand/collapse
    const header = card.querySelector('.consultation-header');
    header.addEventListener('click', () => toggleCard(card));

    return card;
  }

  function buildConsultationBody(cons, structured, summary, recommendation, doctorName, doctorSpecialty) {
    // If no structured data, show a minimal view
    if (!structured && !summary) {
      return `
        <div class="no-summary-state">
          <i class="uil uil-clock-three"></i>
          <p>AI analysis has not been generated for this consultation yet.</p>
          <span class="meta-info">Recorded on ${new Date(cons.date_time).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      `;
    }

    // If we have summary but no structured SOAP, show a basic summary view
    if (!structured) {
      return `
        <div class="export-bar" style="display: flex; gap: 8px;">
          <button class="export-btn view-transcript-btn" data-id="${cons.id}" data-doc="${escapeHtml(doctorName)}"><i class="uil uil-file-alt"></i> View Transcript</button>
          <button class="export-btn" onclick="window.print()"><i class="uil uil-print"></i> Export Record</button>
        </div>
        <div class="summary-only-view">
          <div class="soap-section">
            <div class="soap-label">Σ</div>
            <div class="soap-content">
              <h4>AI Summary</h4>
              <div class="info-block">
                <span class="info-label">Summary</span>
                <p>${escapeHtml(summary.summary_text)}</p>
              </div>
            </div>
          </div>
          ${recommendation ? `
          <div class="soap-section" style="margin-top: 16px;">
            <div class="soap-label">R</div>
            <div class="soap-content">
              <h4>Recommendations</h4>
              <div class="info-block">
                <span class="info-label">Doctor Notes</span>
                <p>${escapeHtml(recommendation.recommendations_text)}</p>
              </div>
            </div>
          </div>` : ''}
        </div>
      `;
    }

    // Full SOAP view from structured data
    const s = structured;

    return `
      <div class="export-bar" style="display: flex; justify-content: space-between; width: 100%;">
        <span class="consultation-meta">
          <i class="uil uil-user-md"></i> Dr. ${escapeHtml(doctorName)}${doctorSpecialty ? ` • ${escapeHtml(doctorSpecialty)}` : ''}
        </span>
        <div style="display: flex; gap: 8px;">
          <button class="export-btn view-transcript-btn" data-id="${cons.id}" data-doc="${escapeHtml(doctorName)}"><i class="uil uil-file-alt"></i> View Transcript</button>
          <button class="export-btn" onclick="window.print()"><i class="uil uil-print"></i> Export Record</button>
        </div>
      </div>

      <div class="soap-grid">
        <!-- S: Subjective -->
        ${s.subjective ? `
        <div class="soap-section">
          <div class="soap-label">S</div>
          <div class="soap-content">
            <h4>Subjective</h4>
            ${s.subjective.chief_complaint ? `
            <div class="info-block">
              <span class="info-label">Chief Complaint</span>
              <p>${escapeHtml(s.subjective.chief_complaint)}</p>
            </div>` : ''}
            ${s.subjective.history ? `
            <div class="info-block">
              <span class="info-label">Medical History</span>
              <p>${escapeHtml(s.subjective.history)}</p>
            </div>` : ''}
            ${s.subjective.allergies ? `
            <div class="info-block">
              <span class="info-label">Allergies</span>
              <p>${escapeHtml(s.subjective.allergies)}</p>
            </div>` : ''}
            ${s.subjective.notes ? `
            <div class="info-block">
              <span class="info-label">Notes</span>
              <p>${escapeHtml(s.subjective.notes)}</p>
            </div>` : ''}
          </div>
        </div>` : ''}

        <!-- O: Objective -->
        ${s.objective ? `
        <div class="soap-section">
          <div class="soap-label">O</div>
          <div class="soap-content">
            <h4>Objective</h4>
            ${s.objective.vitals ? `
            <div class="vitals-grid">
              ${Object.entries(s.objective.vitals).map(([key, val]) => `
              <div class="vital-item">
                <span class="vital-label">${escapeHtml(formatLabel(key))}</span>
                <span class="vital-value">${escapeHtml(String(val))}</span>
              </div>`).join('')}
            </div>` : ''}
            ${s.objective.examination ? `
            <div class="info-block">
              <span class="info-label">Physical Examination</span>
              <p>${escapeHtml(s.objective.examination)}</p>
            </div>` : ''}
          </div>
        </div>` : ''}

        <!-- A: Assessment -->
        ${s.assessment ? `
        <div class="soap-section">
          <div class="soap-label">A</div>
          <div class="soap-content">
            <h4>Assessment</h4>
            ${s.assessment.diagnoses ? `
            <div class="info-block">
              <span class="info-label">Diagnoses</span>
              <div class="tags-list">
                ${(Array.isArray(s.assessment.diagnoses) ? s.assessment.diagnoses : [s.assessment.diagnoses]).map((d, i) => `
                <span class="tag ${i === 0 ? 'tag-primary' : 'tag-secondary'}">${escapeHtml(d)}</span>`).join('')}
              </div>
            </div>` : ''}
            ${s.assessment.reasoning ? `
            <div class="info-block">
              <span class="info-label">Clinical Reasoning</span>
              <p class="assessment-notes">${escapeHtml(s.assessment.reasoning)}</p>
            </div>` : ''}
          </div>
        </div>` : ''}

        <!-- P: Plan -->
        ${s.plan ? `
        <div class="soap-section">
          <div class="soap-label">P</div>
          <div class="soap-content">
            <h4>Plan</h4>
            <ul class="plan-list">
              ${(Array.isArray(s.plan) ? s.plan : Object.entries(s.plan).map(([k, v]) => ({ label: k, value: v }))).map(item => {
                const label = item.label || item.type || 'Action';
                const value = item.value || item.description || item;
                return `<li><span class="plan-label">${escapeHtml(formatLabel(String(label)))}</span> <span class="plan-value">${escapeHtml(String(value))}</span></li>`;
              }).join('')}
            </ul>
          </div>
        </div>` : ''}
      </div>

      ${recommendation ? `
      <div class="recommendations-section">
        <div class="soap-section">
          <div class="soap-label rec-label">R</div>
          <div class="soap-content">
            <h4>Doctor Recommendations</h4>
            <div class="info-block">
              <span class="info-label">Recommendations</span>
              <p>${escapeHtml(recommendation.recommendations_text)}</p>
            </div>
          </div>
        </div>
      </div>` : ''}
    `;
  }

  // ─── Accordion Toggle ───
  function toggleCard(card) {
    const body = card.querySelector('.consultation-body');
    const isExpanded = card.classList.contains('expanded');

    // Close all other expanded cards
    document.querySelectorAll('.consultation-card.expanded').forEach(expandedCard => {
      if (expandedCard !== card) {
        expandedCard.classList.remove('expanded');
        expandedCard.querySelector('.consultation-body').style.display = 'none';
      }
    });

    if (isExpanded) {
      card.classList.remove('expanded');
      body.style.display = 'none';
    } else {
      card.classList.add('expanded');
      body.style.display = 'block';
      body.style.opacity = '0';
      setTimeout(() => {
        body.style.transition = 'opacity 250ms ease';
        body.style.opacity = '1';
      }, 10);
    }
  }

  // ─── Filter Pills ───
  function setupFilters(consultations) {
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const filter = pill.dataset.filter;
        const cards = consultationList.querySelectorAll('.consultation-card');

        cards.forEach(card => {
          if (filter === 'all' || card.dataset.status === filter) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // ─── Helpers ───
  function showError(message) {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessage.innerText = message;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function renderTranscriptHtml(markdown, doctorName, patientName) {
    const dFirstName = doctorName.replace('Dr. ', '').split(' ')[0] || 'Doctor';
    const pFirstName = patientName.split(' ')[0] || 'Patient';

    let escaped = escapeHtml(markdown);
    escaped = escaped
      .replace(/\*\*Speaker 1\*\*/g, `<strong class="speaker-label">Dr. ${escapeHtml(dFirstName)}</strong>`)
      .replace(/\*\*Speaker 2\*\*/g, `<strong class="speaker-label">${escapeHtml(pFirstName)}</strong>`)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^# (.*)$/gm, '<h4 class="transcript-heading">$1</h4>')
      .replace(/^---$/gm, '<hr class="transcript-rule">')
      .replace(/^&gt; (.*)$/gm, '<p class="transcript-quote">$1</p>')
      .replace(/\n/g, '<br>');

    return escaped;
  }

  // ─── Logout ───
  const docAvatar = document.getElementById('docAvatarBtn');
  if (docAvatar) {
    docAvatar.addEventListener('click', async () => {
      if (confirm('Are you sure you want to log out?')) {
        await api.auth.signOut();
        window.location.href = '/';
      }
    });
  }

  // --- TRANSCRIPT MODAL LOGIC ---
  const transcriptModal = document.getElementById('transcriptModal');
  const closeTranscriptModalBtn = document.getElementById('closeTranscriptModalBtn');
  const doneTranscriptModalBtn = document.getElementById('doneTranscriptModalBtn');
  const transcriptContent = document.getElementById('transcriptContent');

  if (transcriptModal) {
    const hideModal = () => transcriptModal.classList.add('hidden');
    closeTranscriptModalBtn.addEventListener('click', hideModal);
    doneTranscriptModalBtn.addEventListener('click', hideModal);
    transcriptModal.addEventListener('click', (e) => {
      if (e.target === transcriptModal) hideModal();
    });

    // Delegate click events for transcript buttons
    const consultationList = document.getElementById('consultationList');
    if (consultationList) {
      consultationList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.view-transcript-btn');
        if (!btn) return;
        e.stopPropagation();
        
        const consId = btn.getAttribute('data-id');
        const docName = btn.getAttribute('data-doc') || 'Doctor';
        const ptName = document.getElementById('patientFullName')?.innerText || 'Patient';
        
        transcriptContent.innerHTML = '<em>Loading transcript...</em>';
        transcriptModal.classList.remove('hidden');
        
        try {
          const tData = await api.data.getConsultationTranscript(consId);
          if (tData && tData.transcript_markdown) {
            transcriptContent.innerHTML = renderTranscriptHtml(tData.transcript_markdown, docName, ptName);
          } else if (tData && tData.transcript_text) {
            transcriptContent.innerHTML = `<p class="transcript-quote">${escapeHtml(tData.transcript_text)}</p>`;
          } else {
            transcriptContent.innerHTML = '<em>No final transcript available for this consultation yet.</em>';
          }
        } catch (err) {
          console.error("Failed to load transcript:", err);
          transcriptContent.innerHTML = '<em>Error loading transcript.</em>';
        }
      });
    }
  }

});
