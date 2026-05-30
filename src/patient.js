import { api } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const state = {
    consultations: [],
    selectedConsultation: null,
    doctors: []
  };

  const greeting = document.querySelector('.greeting');
  const avatar = document.querySelector('.profile-avatar');
  const upcomingVisit = document.getElementById('upcomingVisit');
  const lastVisit = document.getElementById('lastVisit');
  const lastConsultationCard = document.getElementById('lastConsultationCard');
  const detailsContent = document.getElementById('details-content');
  const actionsRequiredList = document.getElementById('actionsRequiredList');
  const docList = document.querySelector('.doc-list');
  const bookBtn = document.getElementById('bookConsultationBtn');
  const bookingModal = document.getElementById('bookingModal');
  const closeBookingModalBtn = document.getElementById('closeBookingModalBtn');
  const cancelBookingModalBtn = document.getElementById('cancelBookingModalBtn');
  const bookingForm = document.getElementById('bookingForm');
  const doctorSelect = document.getElementById('doctorSelect');
  const appointmentTime = document.getElementById('appointmentTime');
  const visitReason = document.getElementById('visitReason');
  const viewTranscriptBtn = document.getElementById('viewTranscriptBtn');
  const transcriptModal = document.getElementById('transcriptModal');
  const closeTranscriptModalBtn = document.getElementById('closeTranscriptModalBtn');
  const transcriptContent = document.getElementById('transcriptContent');

  try {
    const session = await api.auth.getSession();
    if (!session) {
      window.location.href = '/';
      return;
    }

    const role = await api.auth.getCurrentUserRole();
    if (role !== 'patient') {
      window.location.href = '/doctor.html';
      return;
    }

    await loadDashboard();
  } catch (err) {
    console.error('Failed to load patient dashboard:', err);
    renderError();
  }

  async function loadDashboard() {
    const [profile, consultations, bookings, doctors] = await Promise.all([
      api.data.getCurrentPatientProfile(),
      api.data.getMyConsultations(),
      api.data.getPatientBookings(),
      api.data.getAvailableDoctors()
    ]);

    state.consultations = consultations || [];
    state.selectedConsultation = state.consultations[0] || null;
    state.doctors = doctors || [];

    renderHeader(profile);
    renderStats(state.consultations, bookings || []);
    renderLastConsultation(state.selectedConsultation);
    renderConsultationDetails(state.selectedConsultation);
    renderActionsRequired(state.consultations);
    renderDocuments(state.consultations);
    renderDoctorOptions(state.doctors);
  }

  function renderHeader(profile) {
    const name = profile?.name || 'Patient';
    greeting.innerText = `Hello, ${name.split(' ')[0]}`;
    avatar.innerText = getInitials(name);
  }

  function renderStats(consultations, bookings) {
    const upcoming = bookings
      .filter(booking => booking.status === 'scheduled' && new Date(booking.appointment_time) >= new Date())
      .sort((a, b) => new Date(a.appointment_time) - new Date(b.appointment_time))[0];

    upcomingVisit.innerText = upcoming
      ? new Date(upcoming.appointment_time).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : '-';

    lastVisit.innerText = consultations[0]
      ? new Date(consultations[0].date_time).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : '-';
  }

  function renderLastConsultation(cons) {
    if (!cons) {
      lastConsultationCard.innerHTML = '<p class="empty-text">No consultations have been recorded through CliNotes yet.</p>';
      return;
    }

    const summary = cons.ai_summary?.[0] || null;
    const structured = summary?.structured_data || {};
    const title = structured.title || 'Consultation';
    const date = new Date(cons.date_time).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
    const doctor = cons.doctor?.name ? `Dr. ${cons.doctor.name}` : 'Doctor';

    lastConsultationCard.innerHTML = `
      <div class="last-summary">
        <div class="last-summary-header">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p class="last-summary-meta">${escapeHtml(date)} • ${escapeHtml(doctor)}</p>
          </div>
          <span class="status-pill ${escapeHtml(cons.status)}">${escapeHtml(formatStatus(cons.status))}</span>
        </div>
        <p class="last-summary-text">${escapeHtml(truncateText(summary?.summary_text || 'Your doctor has not posted a summary for this visit yet.', 150))}</p>
      </div>
    `;
  }

  function renderConsultationDetails(cons) {
    if (!cons) {
      detailsContent.innerHTML = '<p class="details-empty">Your consultation details will appear here after your first recorded visit.</p>';
      viewTranscriptBtn.disabled = true;
      return;
    }

    viewTranscriptBtn.disabled = false;
    const summary = cons.ai_summary?.[0] || null;
    const structured = summary?.structured_data || {};
    const subjective = structured.subjective || {};
    const objective = structured.objective || {};
    const assessment = structured.assessment || {};
    const planItems = normalizePlanItems(structured.plan);
    const diagnoses = Array.isArray(assessment.diagnoses)
      ? assessment.diagnoses
      : [assessment.diagnoses].filter(Boolean);

    detailsContent.innerHTML = `
      <div class="detail-grid">
        ${detailTile('Came in for', subjective.chief_complaint || 'Not specified')}
        ${detailTile('Doctor found', objective.examination || formatVitals(objective.vitals) || 'Not recorded')}
      </div>
      ${diagnoses.length ? `
        <div class="compact-section">
          <span class="compact-label">Assessment</span>
          <div class="chip-row">
            ${diagnoses.slice(0, 4).map(item => `<span class="info-chip">${escapeHtml(item)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      <div class="compact-section">
        <span class="compact-label">Plan</span>
        ${planItems.length ? `
          <div class="plan-strip">
            ${planItems.slice(0, 3).map(item => `
              <div class="plan-pill">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(truncateText(item.value, 72))}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p class="details-empty">No next steps recorded yet.</p>'}
      </div>
    `;
  }

  function renderActionsRequired(consultations) {
    const actions = [];

    consultations.forEach(cons => {
      const structured = cons.ai_summary?.[0]?.structured_data || {};
      normalizePlanItems(structured.plan).forEach(item => {
        const meta = getActionMeta(item.label, item.value);
        actions.push({
          icon: meta.icon,
          title: meta.title,
          detail: item.value
        });
      });
    });

    if (!actions.length) {
      actionsRequiredList.innerHTML = '<p class="empty-text">No actions required right now.</p>';
      return;
    }

    actionsRequiredList.innerHTML = `
      <div class="patient-action-list">
        ${actions.slice(0, 5).map(action => `
          <div class="patient-action-item">
            <div class="patient-action-icon"><i class="uil ${action.icon}"></i></div>
            <div class="patient-action-content">
              <strong>${escapeHtml(action.title)}</strong>
              <span>${escapeHtml(truncateText(action.detail, 64))}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderDocuments(consultations) {
    const docs = [];
    consultations.forEach(cons => {
      const title = cons.ai_summary?.[0]?.structured_data?.title || 'Consultation';
      normalizePlanItems(cons.ai_summary?.[0]?.structured_data?.plan).forEach(item => {
        const meta = getActionMeta(item.label, item.value);
        if (['Prescription', 'Lab Order', 'Imaging Request'].includes(meta.docType)) {
          docs.push({
            type: meta.docType,
            title: `${meta.docType}: ${truncateText(item.value, 72)}`,
            meta: title
          });
        }
      });
    });

    if (!docs.length) {
      docList.innerHTML = '<div class="doc-item"><p class="empty-text">No prescriptions, scans, or reports have been added yet.</p></div>';
      return;
    }

    docList.innerHTML = docs.slice(0, 8).map(doc => `
      <div class="doc-item" data-type="${escapeHtml(doc.type)}">
        <div class="doc-info">
          <div class="doc-icon"><i class="uil ${doc.type === 'Prescription' ? 'uil-capsule' : doc.type === 'Lab Order' ? 'uil-flask' : 'uil-image-search'}"></i></div>
          <div>
            <div class="doc-title">${escapeHtml(doc.title)}</div>
            <div class="doc-meta">${escapeHtml(doc.meta)}</div>
          </div>
        </div>
        <div class="doc-actions">
          <button class="action-btn primary">View</button>
        </div>
      </div>
    `).join('');
  }

  function renderDoctorOptions(doctors) {
    if (!doctors.length) {
      doctorSelect.innerHTML = '<option value="">No doctors available</option>';
      return;
    }

    doctorSelect.innerHTML = doctors.map(doctor => (
      `<option value="${doctor.id}">${escapeHtml(doctor.name)}${doctor.specialty ? ` • ${escapeHtml(doctor.specialty)}` : ''}</option>`
    )).join('');
  }

  function openBookingModal() {
    bookingModal.classList.remove('hidden');
    const now = new Date(Date.now() + 60 * 60 * 1000);
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    appointmentTime.value = toDatetimeLocalValue(now);
  }

  function closeBookingModal() {
    bookingModal.classList.add('hidden');
    bookingForm.reset();
  }

  bookBtn.addEventListener('click', openBookingModal);
  closeBookingModalBtn.addEventListener('click', closeBookingModal);
  cancelBookingModalBtn.addEventListener('click', closeBookingModal);
  bookingModal.addEventListener('click', event => {
    if (event.target === bookingModal) closeBookingModal();
  });

  bookingForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submitBtn = bookingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="uil uil-spinner-alt uil-spin"></i> Booking...';

    try {
      await api.data.createPatientBooking(
        doctorSelect.value,
        new Date(appointmentTime.value).toISOString(),
        visitReason.value.trim()
      );
      closeBookingModal();
      await loadDashboard();
    } catch (err) {
      console.error('Booking failed:', err);
      alert(err.message || 'Could not book consultation.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Book Consultation';
    }
  });

  viewTranscriptBtn.addEventListener('click', async () => {
    if (!state.selectedConsultation) return;
    transcriptContent.innerHTML = '<em>Loading transcript...</em>';
    transcriptModal.classList.remove('hidden');

    try {
      const transcript = await api.data.getConsultationTranscript(state.selectedConsultation.id);
      transcriptContent.textContent = transcript?.transcript_text || transcript?.transcript_markdown || 'No final transcript is available yet.';
    } catch (err) {
      console.error('Failed to load transcript:', err);
      transcriptContent.textContent = 'Could not load transcript.';
    }
  });

  closeTranscriptModalBtn.addEventListener('click', () => transcriptModal.classList.add('hidden'));
  transcriptModal.addEventListener('click', event => {
    if (event.target === transcriptModal) transcriptModal.classList.add('hidden');
  });

  document.querySelectorAll('.doc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.doc-tab').forEach(item => item.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.innerText;
      document.querySelectorAll('.doc-item[data-type]').forEach(item => {
        item.style.display = filter === 'All' || item.dataset.type.includes(filter.replace('s', '')) ? '' : 'none';
      });
    });
  });

  function detailTile(label, text) {
    return `
      <div class="detail-tile">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(truncateText(text, 88))}</strong>
      </div>
    `;
  }

  function normalizePlanItems(plan) {
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
        label: formatLabel(key),
        value: item
      }));
    });
  }

  function getActionMeta(label, value) {
    const combined = `${label || ''} ${value || ''}`.toLowerCase();
    if (combined.includes('follow')) return { icon: 'uil-calendar-alt', title: 'Schedule follow-up', docType: 'Follow-up' };
    if (combined.includes('x-ray') || combined.includes('mri') || combined.includes('ct') || combined.includes('ultrasound') || combined.includes('scan')) {
      return { icon: 'uil-image-search', title: 'Scan or imaging needed', docType: 'Imaging Request' };
    }
    if (combined.includes('lab') || combined.includes('test') || combined.includes('cbc') || combined.includes('a1c') || combined.includes('lipid')) {
      return { icon: 'uil-flask', title: 'Lab order needed', docType: 'Lab Order' };
    }
    if (combined.includes('mg') || combined.includes('medication') || combined.includes('prescription') || combined.includes('continue') || combined.includes('start')) {
      return { icon: 'uil-capsule', title: 'Prescription instruction', docType: 'Prescription' };
    }
    return { icon: 'uil-clipboard-notes', title: 'Care instruction', docType: 'Instruction' };
  }

  function formatVitals(vitals) {
    if (!vitals) return '';
    if (typeof vitals === 'string') return vitals;
    return Object.entries(vitals).map(([key, value]) => `${formatLabel(key)}: ${value}`).join(', ');
  }

  function formatLabel(key) {
    return String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function formatStatus(status) {
    return String(status || 'pending').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function getInitials(name) {
    return (name || 'P').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function truncateText(text, maxLength) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1).trim()}…`;
  }

  function toDatetimeLocalValue(date) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function renderError() {
    lastConsultationCard.innerHTML = '<p class="empty-text">Could not load your dashboard.</p>';
    detailsContent.innerHTML = '<p class="details-empty">Please refresh or sign in again.</p>';
  }
});
