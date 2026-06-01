import { api } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const state = {
    profile: null,
    consultations: [],
    selectedConsultation: null,
    doctors: [],
    booking: getEmptyBookingState()
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
  const viewPatientCardBtn = document.getElementById('viewPatientCardBtn');
  const bookingModal = document.getElementById('bookingModal');
  const closeBookingModalBtn = document.getElementById('closeBookingModalBtn');
  const cancelBookingModalBtn = document.getElementById('cancelBookingModalBtn');
  const bookingForm = document.getElementById('bookingForm');
  const bookingStepLabel = document.getElementById('bookingStepLabel');
  const bookingProgress = document.getElementById('bookingProgress');
  const bookingStepContent = document.getElementById('bookingStepContent');
  const bookingBackBtn = document.getElementById('bookingBackBtn');
  const autoAssignBtn = document.getElementById('autoAssignBtn');
  const bookingNextBtn = document.getElementById('bookingNextBtn');
  const viewTranscriptBtn = document.getElementById('viewTranscriptBtn');
  const transcriptModal = document.getElementById('transcriptModal');
  const closeTranscriptModalBtn = document.getElementById('closeTranscriptModalBtn');
  const transcriptContent = document.getElementById('transcriptContent');
  const patientCardModal = document.getElementById('patientCardModal');
  const closePatientCardModalBtn = document.getElementById('closePatientCardModalBtn');
  const patientCardContent = document.getElementById('patientCardContent');

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

    state.consultations = (consultations || []).filter(consultation => consultation.status === 'reviewed');
    state.selectedConsultation = state.consultations[0] || null;
    state.doctors = doctors || [];
    state.profile = profile;

    renderHeader(profile);
    renderStats(state.consultations, bookings || []);
    renderLastConsultation(state.selectedConsultation);
    renderConsultationDetails(state.selectedConsultation);
    renderActionsRequired(state.consultations);
    renderDocuments(state.consultations);
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
    const patientSummary = getPatientFriendlySummary(structured);
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
        <p class="last-summary-text">${escapeHtml(truncateText(patientSummary.what_was_discussed || summary?.summary_text || 'Your doctor has not posted a summary for this visit yet.', 150))}</p>
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
    const patientSummary = getPatientFriendlySummary(structured);

    detailsContent.innerHTML = `
      <div class="patient-summary-grid">
        ${patientSummaryTile('uil-comment-medical', 'What you came for', patientSummary.what_you_came_for)}
        ${patientSummaryTile('uil-comments', 'What was discussed', patientSummary.what_was_discussed)}
        ${patientSummaryTile('uil-stethoscope', 'What the doctor found', patientSummary.what_the_doctor_found)}
        ${patientSummaryTile('uil-arrow-circle-right', 'What happens next', patientSummary.what_happens_next)}
      </div>
    `;
  }

  function getPatientFriendlySummary(structured) {
    const patientSummary = structured.patient_summary || structured.patientSummary || {};
    const subjective = structured.subjective || {};
    const objective = structured.objective || {};
    const assessment = structured.assessment || {};
    const diagnoses = Array.isArray(assessment.diagnoses)
      ? assessment.diagnoses
      : [assessment.diagnoses].filter(Boolean);
    const planItems = normalizePlanItems(structured.plan);

    return {
      what_you_came_for: patientSummary.what_you_came_for || subjective.chief_complaint || 'The main reason for this visit was not clearly recorded.',
      what_was_discussed: patientSummary.what_was_discussed || subjective.history || 'Your doctor reviewed your symptoms and health concerns during the visit.',
      what_the_doctor_found: patientSummary.what_the_doctor_found || objective.examination || objective.physical_exam || formatVitals(objective.vitals) || diagnoses.join(', ') || 'No specific findings were recorded in the final note.',
      what_happens_next: patientSummary.what_happens_next || planItems.map(item => item.value).filter(Boolean).slice(0, 2).join(' ') || 'No specific next steps were recorded yet.'
    };
  }

  function patientSummaryTile(icon, label, text) {
    return `
      <section class="patient-summary-tile">
        <div class="patient-summary-icon"><i class="uil ${icon}"></i></div>
        <div>
          <h3>${escapeHtml(label)}</h3>
          <p>${escapeHtml(text || 'Not recorded.')}</p>
        </div>
      </section>
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

  function openBookingModal() {
    state.booking = getEmptyBookingState();
    bookingModal.classList.remove('hidden');
    renderBookingStep();
  }

  function closeBookingModal() {
    bookingModal.classList.add('hidden');
    bookingForm.reset();
    state.booking = getEmptyBookingState();
  }

  bookBtn.addEventListener('click', openBookingModal);
  viewPatientCardBtn.addEventListener('click', openPatientCardModal);
  closeBookingModalBtn.addEventListener('click', closeBookingModal);
  cancelBookingModalBtn.addEventListener('click', closeBookingModal);
  bookingModal.addEventListener('click', event => {
    if (event.target === bookingModal) closeBookingModal();
  });

  bookingForm.addEventListener('submit', event => {
    event.preventDefault();
  });

  bookingBackBtn.addEventListener('click', () => {
    if (state.booking.step === 0) return;
    state.booking.step -= 1;
    renderBookingStep();
  });

  bookingNextBtn.addEventListener('click', async () => {
    if (!canAdvanceBooking()) return;

    if (state.booking.step < 3) {
      state.booking.step += 1;
      renderBookingStep();
      return;
    }

    await submitBooking();
  });

  autoAssignBtn.addEventListener('click', () => {
    autoAssignNextFreeDoctor();
    renderBookingStep();
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

  closePatientCardModalBtn.addEventListener('click', () => patientCardModal.classList.add('hidden'));
  patientCardModal.addEventListener('click', event => {
    if (event.target === patientCardModal) patientCardModal.classList.add('hidden');
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

  function renderBookingStep() {
    const steps = ['Specialty', 'Doctor', 'Time', 'Confirm'];
    bookingStepLabel.innerText = steps[state.booking.step];
    bookingProgress.innerHTML = steps.map((step, index) => `
      <span class="booking-progress-step ${index === state.booking.step ? 'active' : ''} ${index < state.booking.step ? 'done' : ''}">${step}</span>
    `).join('');

    bookingBackBtn.style.display = state.booking.step === 0 ? 'none' : '';
    autoAssignBtn.style.display = state.booking.step <= 2 ? '' : 'none';
    bookingNextBtn.innerText = state.booking.step === 3 ? 'Book Consultation' : 'Next';

    if (state.booking.step === 0) renderSpecialtyStep();
    if (state.booking.step === 1) renderDoctorStep();
    if (state.booking.step === 2) renderSlotStep();
    if (state.booking.step === 3) renderConfirmStep();
  }

  function openPatientCardModal() {
    const profile = state.profile;
    if (!profile?.id) {
      alert('Patient profile is not available yet.');
      return;
    }

    const name = profile.name || 'Patient';
    const qrValue = profile.id;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(qrValue)}`;

    patientCardContent.innerHTML = `
      <div class="patient-pass">
        <div class="patient-pass-header">
          <div>
            <span>CliNotes</span>
            <h2>${escapeHtml(name)}</h2>
          </div>
          <div class="patient-pass-mark">CN</div>
        </div>
        <div class="patient-pass-label">
          <span>Patient Card</span>
          <strong>Scan before consultation</strong>
        </div>
        <div class="patient-pass-qr">
          <img src="${qrUrl}" alt="QR code for ${escapeHtml(name)}">
        </div>
      </div>
      <div class="wallet-actions">
        <button class="wallet-btn apple-wallet-btn" id="addAppleWalletBtn">
          <i class="uil uil-apple"></i>
          Add to Apple Wallet
        </button>
        <button class="wallet-btn google-wallet-btn" id="addGoogleWalletBtn" disabled title="Google Wallet support is not available through the current WalletWallet API.">
          <i class="uil uil-google"></i>
          Add to Google Wallet
        </button>
      </div>
      <p class="wallet-note">Doctors scan this QR code before recording a consultation.</p>
    `;

    patientCardModal.classList.remove('hidden');

    document.getElementById('addAppleWalletBtn').addEventListener('click', async () => {
      await downloadAppleWalletPass(profile);
    });
  }

  async function downloadAppleWalletPass(profile) {
    const button = document.getElementById('addAppleWalletBtn');
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="uil uil-spinner-alt uil-spin"></i> Creating pass...';

    try {
      const blob = await api.data.createPatientAppleWalletPass(profile.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'clinotes-patient-card.pkpass';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Apple Wallet pass failed:', err);
      alert(err.message || 'Could not create Apple Wallet pass.');
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  function renderSpecialtyStep() {
    const specialties = getSpecialties();

    bookingStepContent.innerHTML = `
      <div class="booking-step-copy">
        <strong>What type of care do you need?</strong>
        <span>Choose a specialty, or use automatic assignment for the earliest available doctor.</span>
      </div>
      <div class="selection-grid specialty-grid">
        ${specialties.map(specialty => `
          <button type="button" class="selection-card ${state.booking.specialty === specialty ? 'selected' : ''}" data-specialty="${escapeHtml(specialty)}">
            <i class="uil ${getSpecialtyIcon(specialty)}"></i>
            <strong>${escapeHtml(specialty)}</strong>
            <span>${state.doctors.filter(doctor => getDoctorSpecialty(doctor) === specialty).length} doctor${state.doctors.filter(doctor => getDoctorSpecialty(doctor) === specialty).length === 1 ? '' : 's'}</span>
          </button>
        `).join('')}
      </div>
    `;

    bookingStepContent.querySelectorAll('.selection-card[data-specialty]').forEach(card => {
      card.addEventListener('click', () => {
        state.booking.specialty = card.dataset.specialty;
        state.booking.doctorId = '';
        state.booking.date = '';
        state.booking.slot = '';
        state.booking.bookedSlots = [];
        state.booking.loadedAvailabilityKey = '';
        renderBookingStep();
      });
    });
  }

  function renderDoctorStep() {
    const doctors = getDoctorsForSelectedSpecialty();

    bookingStepContent.innerHTML = `
      <div class="booking-step-copy">
        <strong>Select a doctor</strong>
        <span>${escapeHtml(state.booking.specialty)} doctors available for booking.</span>
      </div>
      <div class="selection-list">
        ${doctors.length ? doctors.map(doctor => `
          <button type="button" class="doctor-card ${state.booking.doctorId === doctor.id ? 'selected' : ''}" data-doctor-id="${doctor.id}">
            <div class="doctor-avatar-small">${escapeHtml(getInitials(doctor.name))}</div>
            <div>
              <strong>${escapeHtml(doctor.name)}</strong>
              <span>${escapeHtml(getDoctorSpecialty(doctor))}</span>
            </div>
          </button>
        `).join('') : '<p class="empty-text">No doctors found for this specialty.</p>'}
      </div>
    `;

    bookingStepContent.querySelectorAll('.doctor-card').forEach(card => {
      card.addEventListener('click', () => {
        state.booking.doctorId = card.dataset.doctorId;
        state.booking.date = '';
        state.booking.slot = '';
        state.booking.bookedSlots = [];
        state.booking.loadedAvailabilityKey = '';
        renderBookingStep();
      });
    });
  }

  function renderSlotStep() {
    const doctor = getSelectedDoctor();
    if (doctor && !state.booking.date) {
      state.booking.date = getDateInputValue(new Date());
    }

    const availabilityKey = doctor && state.booking.date ? `${doctor.id}:${state.booking.date}` : '';
    const isLoadingSlots = availabilityKey && state.booking.loadedAvailabilityKey !== availabilityKey;
    if (isLoadingSlots) {
      loadBookedSlotsForSelection(availabilityKey);
    }

    const slots = generateSlots(doctor);

    bookingStepContent.innerHTML = `
      <div class="booking-step-copy">
        <strong>Choose a day and time</strong>
        <span>${doctor ? escapeHtml(`Dr. ${doctor.name} • one-hour slots from 09:00 to 17:00`) : 'Select a doctor first'}</span>
      </div>
      <div class="date-picker-row">
        <label class="form-label" for="bookingDate">Consultation date</label>
        <input id="bookingDate" class="form-control" type="date" min="${getDateInputValue(new Date())}" value="${escapeHtml(state.booking.date)}">
      </div>
      <div class="slot-grid">
        ${isLoadingSlots ? '<p class="empty-text">Checking availability...</p>' : slots.map(slot => `
          <button type="button" class="slot-card ${state.booking.slot === slot.value ? 'selected' : ''}" data-slot="${slot.value}" ${slot.booked ? 'disabled' : ''}>
            <strong>${escapeHtml(slot.time)}</strong>
            <span>${slot.booked ? 'Booked' : 'Available'}</span>
          </button>
        `).join('')}
      </div>
    `;

    const dateInput = document.getElementById('bookingDate');
    dateInput.addEventListener('change', () => {
      state.booking.date = dateInput.value;
      state.booking.slot = '';
      state.booking.bookedSlots = [];
      state.booking.loadedAvailabilityKey = '';
      renderBookingStep();
    });

    bookingStepContent.querySelectorAll('.slot-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.disabled) return;
        state.booking.slot = card.dataset.slot;
        renderBookingStep();
      });
    });
  }

  function renderConfirmStep() {
    const doctor = getSelectedDoctor();
    const slot = state.booking.slot ? new Date(state.booking.slot) : null;

    bookingStepContent.innerHTML = `
      <div class="booking-step-copy">
        <strong>Confirm details</strong>
        <span>Add a short reason so the doctor can prepare before the visit.</span>
      </div>
      <div class="booking-review">
        <div><span>Specialty</span><strong>${escapeHtml(state.booking.specialty)}</strong></div>
        <div><span>Doctor</span><strong>${escapeHtml(doctor ? doctor.name : 'Automatic assignment')}</strong></div>
        <div><span>Time</span><strong>${escapeHtml(slot ? slot.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not selected')}</strong></div>
      </div>
      <label class="form-label" for="visitReason">Why are you coming in?</label>
      <textarea id="visitReason" class="form-control" rows="4" placeholder="Briefly describe your symptoms or concern.">${escapeHtml(state.booking.reason)}</textarea>
    `;

    const reasonInput = document.getElementById('visitReason');
    reasonInput.addEventListener('input', () => {
      state.booking.reason = reasonInput.value;
    });
  }

  function canAdvanceBooking() {
    if (state.booking.step === 0 && !state.booking.specialty) {
      alert('Please choose a specialty or use automatic assignment.');
      return false;
    }
    if (state.booking.step === 1 && !state.booking.doctorId) {
      alert('Please choose a doctor or use automatic assignment.');
      return false;
    }
    if (state.booking.step === 2 && !state.booking.slot) {
      alert('Please choose a free slot.');
      return false;
    }
    return true;
  }

  async function submitBooking() {
    bookingNextBtn.disabled = true;
    bookingNextBtn.innerHTML = '<i class="uil uil-spinner-alt uil-spin"></i> Booking...';

    try {
      await api.data.createPatientBooking(
        state.booking.doctorId,
        new Date(state.booking.slot).toISOString(),
        state.booking.reason.trim()
      );
      closeBookingModal();
      await loadDashboard();
    } catch (err) {
      console.error('Booking failed:', err);
      alert(err.message || 'Could not book consultation.');
    } finally {
      bookingNextBtn.disabled = false;
      bookingNextBtn.innerHTML = 'Book Consultation';
    }
  }

  function autoAssignNextFreeDoctor() {
    const doctors = state.booking.specialty ? getDoctorsForSelectedSpecialty() : state.doctors;
    const doctor = doctors[0];
    if (!doctor) {
      alert('No doctors are available for automatic assignment.');
      return;
    }

    state.booking.specialty = getDoctorSpecialty(doctor);
    state.booking.doctorId = doctor.id;
    state.booking.date = getDateInputValue(new Date());
    state.booking.slot = '';
    state.booking.step = 2;
  }

  function getSpecialties() {
    const specialties = [...new Set(state.doctors.map(getDoctorSpecialty).filter(Boolean))];
    return specialties.length ? specialties : ['General Practice'];
  }

  function getDoctorsForSelectedSpecialty() {
    return state.doctors.filter(doctor => getDoctorSpecialty(doctor) === state.booking.specialty);
  }

  function getSelectedDoctor() {
    return state.doctors.find(doctor => doctor.id === state.booking.doctorId);
  }

  function getDoctorSpecialty(doctor) {
    return doctor?.specialty || 'General Practice';
  }

  function getSpecialtyIcon(specialty) {
    const value = String(specialty).toLowerCase();
    if (value.includes('cardio')) return 'uil-heartbeat';
    if (value.includes('neuro')) return 'uil-brain';
    if (value.includes('pediatric')) return 'uil-baby-carriage';
    if (value.includes('internal')) return 'uil-medical-square';
    return 'uil-stethoscope';
  }

  function generateSlots(doctor) {
    if (!doctor) return [];
    const slots = [];
    if (!state.booking.date) return slots;

    const bookedTimes = new Set((state.booking.bookedSlots || []).map(value => {
      const date = new Date(value);
      return `${String(date.getHours()).padStart(2, '0')}:00`;
    }));

    for (let hour = 9; hour < 17; hour++) {
      const slot = new Date(`${state.booking.date}T${String(hour).padStart(2, '0')}:00:00`);
      const time = `${String(hour).padStart(2, '0')}:00`;
      slots.push({
        value: slot.toISOString(),
        time,
        booked: bookedTimes.has(time) || slot < new Date()
      });
    }

    return slots;
  }

  async function loadBookedSlotsForSelection(availabilityKey) {
    const doctor = getSelectedDoctor();
    const date = state.booking.date;
    if (!doctor || !date) return;

    state.booking.loadedAvailabilityKey = availabilityKey;
    try {
      state.booking.bookedSlots = await api.data.getDoctorBookedSlots(doctor.id, date);
    } catch (err) {
      console.error('Failed to load booked slots:', err);
      state.booking.bookedSlots = [];
      alert('Could not load booked slots for this date.');
    } finally {
      if (state.booking.step === 2 && state.booking.doctorId === doctor.id && state.booking.date === date) {
        renderBookingStep();
      }
    }
  }

  function getEmptyBookingState() {
    return {
      step: 0,
      specialty: '',
      doctorId: '',
      date: '',
      slot: '',
      reason: '',
      bookedSlots: [],
      loadedAvailabilityKey: ''
    };
  }

  function getDateInputValue(date) {
    const value = new Date(date);
    value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
    return value.toISOString().slice(0, 10);
  }

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

  function renderError() {
    lastConsultationCard.innerHTML = '<p class="empty-text">Could not load your dashboard.</p>';
    detailsContent.innerHTML = '<p class="details-empty">Please refresh or sign in again.</p>';
  }
});
