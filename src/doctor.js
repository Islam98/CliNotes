import { api } from './api.js';
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Authentication check
  try {
    const session = await api.auth.getSession();
    if (!session) {
      window.location.href = '/';
      return;
    }

    const role = await api.auth.getCurrentUserRole();
    if (role !== 'doctor') {
      window.location.href = '/patient.html';
      return;
    }
  } catch (e) {
    window.location.href = '/';
    return;
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function getInitials(name) {
    return (name || 'PT').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  function isToday(value) {
    const date = new Date(value);
    const today = new Date();
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  }

  function setMetric(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = String(value);
  }

  function normalizePlanItems(plan) {
    if (!plan) return [];

    if (Array.isArray(plan)) {
      return plan
        .map(item => ({
          label: item.label || item.type || 'Plan',
          value: item.value || item.description || item
        }))
        .filter(item => item.value);
    }

    return Object.entries(plan).flatMap(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      return values.filter(Boolean).map(item => ({
        label: key,
        value: item
      }));
    });
  }

  function getRecommendedActionMeta(label, value, fallbackIcon = 'uil-clipboard-notes') {
    const normalized = String(label || '').toLowerCase();
    const detail = String(value || '').toLowerCase();
    const combined = `${normalized} ${detail}`;

    if (combined.includes('follow')) {
      return { icon: 'uil-calendar-alt', tone: 'follow-up', title: 'Schedule follow-up' };
    }
    if (combined.includes('x-ray') || combined.includes('xray') || combined.includes('mri') || combined.includes('ct') || combined.includes('ultrasound') || combined.includes('scan') || combined.includes('imaging')) {
      return { icon: 'uil-image-search', tone: 'imaging', title: 'Prepare imaging request' };
    }
    if (combined.includes('test') || combined.includes('lab') || combined.includes('cbc') || combined.includes('hba1c') || combined.includes('a1c') || combined.includes('lipid') || combined.includes('tsh')) {
      return { icon: 'uil-flask', tone: 'lab', title: 'Prepare lab order' };
    }
    if (combined.includes('medication') || combined.includes('prescription') || combined.includes('treatment') || combined.includes('start ') || combined.includes('continue ') || combined.includes('mg')) {
      return { icon: 'uil-capsule', tone: 'medication', title: 'Review prescription draft' };
    }
    if (combined.includes('refer')) {
      return { icon: 'uil-share-alt', tone: 'referral', title: 'Prepare referral' };
    }
    return { icon: fallbackIcon, tone: 'general', title: 'Review recommended action' };
  }

  function getGeneratedRecommendedActions(consultation) {
    const structured = consultation.ai_summary?.[0]?.structured_data || {};
    const actions = structured.recommended_actions || {};
    const patientName = consultation.patient?.name || 'Unknown Patient';
    const doctorName = consultation.doctor?.name || 'Doctor';
    const date = new Date(consultation.date_time);
    const base = {
      consultationId: consultation.id,
      patientId: consultation.patient_id,
      patientName,
      doctorName,
      consultationDate: date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
    };

    const statusOf = action => action?.status || 'pending';
    const isPending = action => action?.needed && statusOf(action) === 'pending';
    const result = [];

    if (isPending(actions.follow_up)) {
      result.push({
        ...base,
        type: 'follow_up',
        key: 'follow_up',
        icon: 'uil-calendar-alt',
        tone: 'follow-up',
        title: 'Book follow-up consultation',
        detail: actions.follow_up.timing || actions.follow_up.reason || 'Follow-up recommended',
        data: actions.follow_up
      });
    }

    if (isPending(actions.prescription) && Array.isArray(actions.prescription.medications) && actions.prescription.medications.length) {
      result.push({
        ...base,
        type: 'prescription',
        key: 'prescription',
        icon: 'uil-capsule',
        tone: 'medication',
        title: 'Review prescription draft',
        detail: actions.prescription.medications.map(m => m.name).filter(Boolean).join(', ') || 'Medication draft ready',
        data: actions.prescription
      });
    }

    if (isPending(actions.lab_order) && Array.isArray(actions.lab_order.orders) && actions.lab_order.orders.length) {
      result.push({
        ...base,
        type: 'lab_order',
        key: 'lab_order',
        icon: 'uil-flask',
        tone: 'lab',
        title: 'Review lab or imaging order',
        detail: actions.lab_order.orders.map(o => o.name).filter(Boolean).join(', ') || 'Order draft ready',
        data: actions.lab_order
      });
    }

    if (isPending(actions.referral)) {
      result.push({
        ...base,
        type: 'referral',
        key: 'referral',
        icon: 'uil-share-alt',
        tone: 'referral',
        title: 'Review referral draft',
        detail: actions.referral.specialty || actions.referral.reason || 'Referral draft ready',
        data: actions.referral
      });
    }

    return result;
  }

  function buildRecommendedActionRow({ icon, tone, title, detail, actionHtml = '' }) {
    return `
      <div class="recommended-action-row ${tone ? `action-${tone}` : ''}">
        <div class="recommended-action-icon"><i class="uil ${icon}"></i></div>
        <div class="recommended-action-content">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(detail)}</span>
        </div>
        ${actionHtml ? `<div class="recommended-action-control">${actionHtml}</div>` : ''}
      </div>
    `;
  }

  function getLabDiscussionTitle(discussion) {
    return discussion?.structured_data?.title || discussion?.title || 'Lab Discussion';
  }

  function renderLabReportSection(title, items) {
    const values = Array.isArray(items) ? items.filter(Boolean) : [items].filter(Boolean);
    if (!values.length) return '';

    const formatItem = (item) => {
      if (typeof item === 'string') return item;
      if (item?.label || item?.value) {
        return [item.label, item.owner, item.value].filter(Boolean).join(' • ');
      }
      if (typeof item === 'object') {
        return Object.entries(item)
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join(' • ');
      }
      return String(item);
    };

    return `
      <section class="lab-report-section">
        <h4>${escapeHtml(title)}</h4>
        <ul>
          ${values.map(item => `<li>${escapeHtml(formatItem(item))}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  let latestLabDiscussions = [];
  let latestConsultations = [];

  async function renderPatientPreview(patientId, visitReason = '') {
    const preview = document.getElementById('patientPreviewContainer');
    if (!preview) return;

    preview.innerHTML = '<div class="search-loading"><i class="uil uil-spinner-alt uil-spin"></i> Loading context...</div>';

    try {
      const [patient, consultations] = await Promise.all([
        api.data.getPatientProfile(patientId),
        api.data.getPatientConsultations(patientId)
      ]);

      const latest = consultations?.[0] || null;
      const structured = latest?.ai_summary?.[0]?.structured_data || {};
      const diagnoses = structured?.assessment?.diagnoses || [];
      const diagnosisList = Array.isArray(diagnoses) ? diagnoses : [diagnoses].filter(Boolean);
      const plan = Array.isArray(structured?.plan)
        ? structured.plan.map(item => item.value || item.description || item).filter(Boolean).slice(0, 2).join(' · ')
        : Object.values(structured?.plan || {}).flat().filter(Boolean).slice(0, 2).join(' · ');

      const meta = [patient.age ? `Age ${patient.age}` : '', patient.gender || ''].filter(Boolean).join(' • ') || 'Patient';
      const lastVisit = latest
        ? new Date(latest.date_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No previous visits';

      preview.innerHTML = `
        <div class="patient-preview">
          <div class="preview-header">
            <div class="preview-avatar">${escapeHtml(getInitials(patient.name))}</div>
            <div class="preview-title">
              <strong>${escapeHtml(patient.name || 'Unknown Patient')}</strong>
              <span>${escapeHtml(meta)}</span>
            </div>
          </div>
          <div class="preview-section">
            <span>Visit Reason</span>
            <p>${escapeHtml(visitReason || 'No pre-visit reason provided.')}</p>
          </div>
          <div class="preview-section">
            <span>Last Visit</span>
            <p>${escapeHtml(lastVisit)}</p>
          </div>
          <div class="preview-section">
            <span>Active Diagnoses</span>
            ${diagnosisList.length ? `
              <div class="preview-tags">
                ${diagnosisList.slice(0, 4).map(d => `<span class="preview-tag">${escapeHtml(d)}</span>`).join('')}
              </div>
            ` : '<p>No diagnoses recorded yet.</p>'}
          </div>
          <div class="preview-section">
            <span>Recent Plan</span>
            <p>${escapeHtml(plan || 'No recent plan recorded.')}</p>
          </div>
          <div class="preview-actions">
            <button class="secondary-btn" onclick="window.location.href='/patient-profile.html?id=${patientId}'"><i class="uil uil-user-square"></i> View Profile</button>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Failed to load patient context:', err);
      preview.innerHTML = '<div class="empty-state-grey" style="color: #9CA3AF; text-align: center; padding: 32px 16px; font-style: italic;">Context unavailable</div>';
    }
  }

  // Fetch and render data
  async function loadDoctorData() {
    try {
      const consultations = await api.data.getConsultations();
      let labDiscussions = [];
      try {
        labDiscussions = await api.data.getLabDiscussions();
      } catch (labErr) {
        console.warn('Lab discussions unavailable:', labErr);
      }
      latestLabDiscussions = labDiscussions || [];
      
      const scheduleContainer = document.querySelector('.schedule-card .list-body');
      const historyContainer = document.querySelector('.history-card .list-body');
      const draftsContainer = document.querySelector('.drafts-card .list-body');
      const recommendedActionsContainer = document.querySelector('.recommended-actions-card .list-body');
      const labDiscussionsContainer = document.querySelector('.lab-discussions-card .list-body');
      
      scheduleContainer.innerHTML = '';
      historyContainer.innerHTML = '';
      draftsContainer.innerHTML = '';
      if(recommendedActionsContainer) recommendedActionsContainer.innerHTML = '';
      if (labDiscussionsContainer) labDiscussionsContainer.innerHTML = '';

      const bookings = await api.data.getBookings();
      const scheduledBookings = (bookings || []).filter(booking => booking.status === 'scheduled' && isToday(booking.appointment_time));
      const consultationList = consultations || [];
      latestConsultations = consultationList;

      setMetric('scheduledCount', scheduledBookings.length);
      setMetric('processingCount', consultationList.filter(c => c.status === 'processing').length);
      setMetric('readyCount', consultationList.filter(c => c.status === 'processed').length);
      setMetric('reviewedCount', consultationList.filter(c => c.status === 'reviewed' && isToday(c.date_time)).length);

      if (scheduledBookings.length === 0) {
        scheduleContainer.innerHTML = '<p style="padding:16px;">No consultations scheduled.</p>';
      } else {
        scheduledBookings.forEach(booking => {
          const date = new Date(booking.appointment_time);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const ptName = booking.patient?.name || 'Unknown Patient';

          scheduleContainer.innerHTML += `
            <div class="list-row schedule-row" data-patient-id="${booking.patient_id}" data-reason="${escapeHtml(booking.reason_text || '')}" style="cursor: pointer;">
              <div class="row-info">
                <span class="time">${escapeHtml(timeStr)}</span>
                <div class="patient-details">
                  <div class="name">${escapeHtml(ptName)}</div>
                  <span class="type">Consultation</span>
                </div>
              </div>
              <div class="row-actions">
                <button class="secondary-btn view-patient-btn" data-id="${booking.patient_id}"><i class="uil uil-user-square"></i> View</button>
                <button class="warning-btn no-show-booking-btn" data-id="${booking.patient_id}" title="Mark No-show"><i class="uil uil-user-times"></i></button>
                <button class="cancel-btn cancel-booking-btn" data-id="${booking.patient_id}" title="Cancel Booking"><i class="uil uil-times"></i></button>
                <span class="badge status-ready">Scheduled</span>
                <button class="primary-btn start-from-schedule-btn" data-id="${booking.patient_id}"><i class="uil uil-record-audio"></i> Start</button>
              </div>
            </div>
          `;
        });
      }

      let recommendedActionCount = 0;

      consultationList.forEach(cons => {
        const date = new Date(cons.date_time);
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const ptName = cons.patient?.name || 'Unknown Patient';

        if ((cons.status === 'processed' || cons.status === 'reviewed') && recommendedActionsContainer && recommendedActionCount < 6) {
          getGeneratedRecommendedActions(cons).forEach(action => {
            if (recommendedActionCount >= 6) return;
            recommendedActionsContainer.innerHTML += buildRecommendedActionRow({
              icon: action.icon,
              tone: action.tone,
              title: action.title,
              detail: `${ptName} • ${String(action.detail)}`,
              actionHtml: `
                <button class="text-btn recommended-action-open-btn" data-consultation-id="${cons.id}" data-action-key="${action.key}">Open</button>
                <button class="text-btn recommended-action-discard-btn" data-consultation-id="${cons.id}" data-action-key="${action.key}">Discard</button>
              `
            });
            recommendedActionCount++;
          });
        }

        if (cons.status === 'processed') {
          // Drafts - Ready
          draftsContainer.innerHTML += `
            <div class="list-row draft-row">
              <div class="row-info">
                <div class="avatar-sm">${escapeHtml(getInitials(ptName))}</div>
                <div class="draft-details">
                  <span class="name">${escapeHtml(ptName)}</span>
                  <span class="date">${dateStr} • AI Processing Complete</span>
                </div>
              </div>
              <div class="row-actions">
                <button class="cancel-btn discard-cons-btn" data-id="${cons.id}" style="margin-right: 8px;" title="Discard Notes"><i class="uil uil-times"></i></button>
                <span class="badge status-ready">Ready for Review</span>
                <button class="primary-btn review-btn" data-id="${cons.id}">Review</button>
              </div>
            </div>
          `;
        } else if (cons.status === 'processing') {
          // Drafts - Processing
          draftsContainer.innerHTML += `
            <div class="list-row draft-row">
              <div class="row-info" style="width: 100%;">
                <div class="avatar-sm" style="background: #E5E7EB; color: #6B7280;">${escapeHtml(getInitials(ptName))}</div>
                <div class="draft-details" style="flex: 1;">
                  <span class="name">${escapeHtml(ptName)}</span>
                  <span class="date">${dateStr} • Uploading, transcribing, or analyzing...</span>
                  <div style="height: 4px; width: 100%; background: #E2E8F0; border-radius: 2px; margin-top: 8px; overflow: hidden;">
                    <div style="height: 100%; width: 50%; background: #3B82F6; animation: slide 2s infinite alternate;"></div>
                  </div>
                </div>
              </div>
              <div class="row-actions">
                <button class="cancel-btn discard-cons-btn" data-id="${cons.id}" style="margin-right: 8px;" title="Discard Consultation"><i class="uil uil-times"></i></button>
                <span class="badge" style="background: #F3F4F6; color: #6B7280;">Processing</span>
              </div>
            </div>
          `;
        } else if (cons.status === 'reviewed') {
          // History
          historyContainer.innerHTML += `
             <div class="list-row history-row">
              <div class="row-info">
                <span class="date-tag">${dateStr}</span>
                <span class="name">${escapeHtml(ptName)}</span>
              </div>
              <div class="history-actions">
                <button class="secondary-btn" onclick="window.location.href='/patient-profile.html?id=${cons.patient_id}'"><i class="uil uil-file-alt"></i> View Summary</button>
              </div>
            </div>
          `;
        }
      });

      latestLabDiscussions.forEach(discussion => {
        if (!discussion?.id) return;

        const created = new Date(discussion.created_at);
        const dateStr = created.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const title = getLabDiscussionTitle(discussion);
        const prominentPoints = discussion.structured_data?.prominent_points || [];
        const firstPoint = Array.isArray(prominentPoints) && prominentPoints.length
          ? prominentPoints[0]
          : discussion.summary_text || 'Internal clinical discussion';

        if (discussion.status === 'processed' && !discussion.approved_at) {
          draftsContainer.innerHTML += `
            <div class="list-row draft-row lab-draft-row">
              <div class="row-info">
                <div class="avatar-sm lab-avatar"><i class="uil uil-flask"></i></div>
                <div class="draft-details">
                  <span class="name">${escapeHtml(title)}</span>
                  <span class="date">${dateStr} • Lab discussion report ready</span>
                </div>
              </div>
              <div class="row-actions">
                <button class="cancel-btn delete-lab-discussion-btn" data-id="${discussion.id}" title="Discard Lab Discussion"><i class="uil uil-times"></i></button>
                <span class="badge status-ready">Ready for Review</span>
                <button class="primary-btn lab-review-btn" data-id="${discussion.id}">Review</button>
              </div>
            </div>
          `;
        } else if (discussion.status === 'processing') {
          draftsContainer.innerHTML += `
            <div class="list-row draft-row lab-draft-row">
              <div class="row-info" style="width: 100%;">
                <div class="avatar-sm lab-avatar muted"><i class="uil uil-flask"></i></div>
                <div class="draft-details" style="flex: 1;">
                  <span class="name">${escapeHtml(title)}</span>
                  <span class="date">${dateStr} • Transcription and summary in progress...</span>
                  <div style="height: 4px; width: 100%; background: #E2E8F0; border-radius: 2px; margin-top: 8px; overflow: hidden;">
                    <div style="height: 100%; width: 50%; background: #3B82F6; animation: slide 2s infinite alternate;"></div>
                  </div>
                </div>
              </div>
              <div class="row-actions">
                <span class="badge" style="background: #F3F4F6; color: #6B7280;">Processing</span>
              </div>
            </div>
          `;
        }

        if (labDiscussionsContainer && (discussion.approved_at || discussion.status === 'reviewed')) {
          labDiscussionsContainer.innerHTML += `
            <div class="list-row lab-discussion-row">
              <div class="row-info">
                <span class="date-tag">${dateStr}</span>
                <div class="lab-discussion-summary">
                  <span class="name">${escapeHtml(title)}</span>
                  <span>${escapeHtml(firstPoint)}</span>
                </div>
              </div>
              <div class="history-actions">
                <button class="secondary-btn lab-review-btn" data-id="${discussion.id}"><i class="uil uil-file-search-alt"></i> View Report</button>
                <button class="cancel-btn delete-lab-discussion-btn" data-id="${discussion.id}" title="Remove Lab Discussion"><i class="uil uil-trash-alt"></i></button>
              </div>
            </div>
          `;
        }
      });
      
      // Update badge counts
      const draftsBadge = document.querySelector('.drafts-card .count-badge');
      if (draftsBadge) {
        const clinicalDraftCount = consultationList.filter(c => c.status === 'processing' || c.status === 'processed').length;
        const labDraftCount = latestLabDiscussions.filter(d => d.status === 'processing' || (d.status === 'processed' && !d.approved_at)).length;
        const count = clinicalDraftCount + labDraftCount;
        draftsBadge.innerText = `${count} Pending`;
      }

      if (!draftsContainer.innerHTML.trim()) {
        draftsContainer.innerHTML = '<p style="padding:16px;">No drafts pending.</p>';
      }

      if (!historyContainer.innerHTML.trim()) {
        historyContainer.innerHTML = '<p style="padding:16px;">No completed consultations.</p>';
      }

      if (labDiscussionsContainer && !labDiscussionsContainer.innerHTML.trim()) {
        labDiscussionsContainer.innerHTML = '<p style="padding:16px;">No reviewed lab discussions yet.</p>';
      }
      
      if (recommendedActionsContainer && recommendedActionCount === 0) {
        recommendedActionsContainer.innerHTML = '<p style="padding:16px; color:#6B7280; font-style:italic;">No recommended actions yet.</p>';
      }
      
      // Schedule row selection and actions
      document.querySelectorAll('.schedule-row').forEach(row => {
        row.addEventListener('click', () => {
          document.querySelectorAll('.schedule-row').forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');
          renderPatientPreview(row.getAttribute('data-patient-id'), row.getAttribute('data-reason'));
        });
      });

      document.querySelectorAll('.start-from-schedule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ptId = e.target.closest('.start-from-schedule-btn').getAttribute('data-id');
          openModal({ expectedPatientId: ptId });
        });
      });

      document.querySelectorAll('.view-patient-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ptId = e.target.closest('.view-patient-btn').getAttribute('data-id');
          window.location.href = `/patient-profile.html?id=${ptId}`;
        });
      });

      document.querySelectorAll('.prepare-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const patientId = e.target.closest('.prepare-action-btn').getAttribute('data-patient-id');
          window.location.href = `/patient-profile.html?id=${patientId}`;
        });
      });

      document.querySelectorAll('.recommended-action-open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const button = e.target.closest('.recommended-action-open-btn');
          window.openRecommendedActionModal(button.dataset.consultationId, button.dataset.actionKey);
        });
      });

      document.querySelectorAll('.recommended-action-discard-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const button = e.target.closest('.recommended-action-discard-btn');
          if (!confirm('Discard this recommended action?')) return;
          await updateRecommendedActionStatus(button.dataset.consultationId, button.dataset.actionKey, 'discarded');
          await loadDoctorData();
        });
      });

      // AI Summary Review Modal Events
      document.querySelectorAll('.review-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const consultationId = e.target.getAttribute('data-id');
          window.openReviewModal(consultationId);
        });
      });

      document.querySelectorAll('.lab-review-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const discussionId = e.target.closest('.lab-review-btn').getAttribute('data-id');
          window.openLabReviewModal(discussionId);
        });
      });

      document.querySelectorAll('.delete-lab-discussion-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const discussionId = e.target.closest('.delete-lab-discussion-btn').getAttribute('data-id');
          if (!confirm('Remove this internal lab discussion?')) return;
          try {
            await api.data.deleteLabDiscussion(discussionId);
            await loadDoctorData();
          } catch (err) {
            console.error('Failed to remove lab discussion:', err);
            alert('Could not remove lab discussion.');
          }
        });
      });

      // Discard Consultation Button
      document.querySelectorAll('.discard-cons-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const btnEl = e.target.closest('.discard-cons-btn');
          const consultationId = btnEl.getAttribute('data-id');
          if (confirm("Are you sure you want to discard this consultation? This cannot be undone.")) {
            try {
              await api.data.deleteConsultation(consultationId);
              loadDoctorData();
            } catch (err) {
              console.error("Failed to discard", err);
              alert("Could not discard consultation.");
            }
          }
        });
      });

      // Cancel Booking Button
      document.querySelectorAll('.cancel-booking-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation(); // prevent clicking patient row
          const btnEl = e.target.closest('.cancel-booking-btn');
          const ptId = btnEl.getAttribute('data-id');
          if (confirm("Cancel this scheduled appointment?")) {
            try {
              await api.data.updateBookingStatus(ptId, 'cancelled');
              loadDoctorData();
            } catch (err) {
              console.error("Failed to cancel", err);
              alert("Could not cancel appointment.");
            }
          }
        });
      });

      // No-show Booking Button
      document.querySelectorAll('.no-show-booking-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const btnEl = e.target.closest('.no-show-booking-btn');
          const ptId = btnEl.getAttribute('data-id');
          if (confirm("Mark this scheduled appointment as no-show?")) {
            try {
              await api.data.updateBookingStatus(ptId, 'no_show');
              loadDoctorData();
            } catch (err) {
              console.error("Failed to mark no-show", err);
              alert("Could not mark appointment as no-show.");
            }
          }
        });
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Set up polling for processing items
  setInterval(() => {
    // Only poll if there are items processing
    const hasProcessing = Array.from(document.querySelectorAll('.draft-row .badge'))
      .some(badge => badge.innerText === 'Processing');
    if (hasProcessing) {
      loadDoctorData();
    }
  }, 10000); // Check every 10 seconds

  await loadDoctorData();

  // Test Schedule Button Logic
  const testScheduleBtn = document.getElementById('testScheduleBtn');
  if (testScheduleBtn) {
    testScheduleBtn.addEventListener('click', async () => {
      try {
        testScheduleBtn.disabled = true;
        testScheduleBtn.innerHTML = '<i class="uil uil-spinner-alt uil-spin"></i> Scheduling...';
        // Test patient ID from supabase/seeds/mock_patient.sql
        await api.data.createBooking('99999999-9999-9999-9999-999999999999');
        await loadDoctorData();
      } catch (err) {
        console.error("Failed to create test schedule:", err);
        alert("Failed to create test schedule. Is the mock patient in the database?");
      } finally {
        testScheduleBtn.disabled = false;
        testScheduleBtn.innerHTML = '<i class="uil uil-plus-circle"></i> Test Schedule';
      }
    });
  }

  const fabBtn = document.getElementById('momentCaptureBtn');
  const toast = document.getElementById('captureToast');
  const undoBtn = toast ? toast.querySelector('.undo-btn') : null;

  let toastTimeout;

  if (fabBtn) {
    fabBtn.addEventListener('click', () => {
      // Small scale click effect
      fabBtn.style.transform = 'scale(0.9)';
      setTimeout(() => fabBtn.style.transform = '', 150);

      // Show toast
      if(toast) {
        toast.classList.add('show');
        
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
          toast.classList.remove('show');
        }, 4000);
      }
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      toast.classList.remove('show');
      console.log('Capture undone');
      clearTimeout(toastTimeout);
    });
  }

  // Start Consultation Modal Flow
  const startBtn = document.getElementById('startConsultationBtn');
  const patientModal = document.getElementById('patientSelectionModal');
  const closeModalBtn = document.getElementById('closePatientModalBtn');
  const modalStartBtn = document.getElementById('modalStartRecordBtn');
  
  const recordingOverlay = document.getElementById('recordingOverlay');
  const recordingTimer = document.getElementById('recordingTimer');
  const overlayStopBtn = document.getElementById('overlayStopBtn');
  
  let isRecording = false;
  let timerInterval = null;
  let recordingSeconds = 0;
  
  let html5QrCodeScanner = null;
  let scannedPatientId = null;
  let expectedPatientId = null;

  function normalizePatientQrValue(value) {
    const raw = String(value || '').trim();
    if (raw === 'PT-9999') return '99999999-9999-9999-9999-999999999999';
    if (raw.startsWith('clinotes:patient:')) return raw.replace('clinotes:patient:', '').trim();
    return raw;
  }

  function openModal(options = {}) {
    patientModal.classList.remove('hidden');
    document.getElementById('qr-reader').style.display = 'block';
    
    document.getElementById('qr-success').classList.add('hidden');
    document.getElementById('modalFooter').classList.add('hidden');
    document.getElementById('patientModalContent').style.backgroundColor = 'white';
    document.getElementById('scannedPatientName').innerText = options.expectedPatientId
      ? 'Scan the scheduled patient card'
      : 'Patient Identified';
    scannedPatientId = null;
    expectedPatientId = options.expectedPatientId || null;

    if (window.Html5QrcodeScanner) {
      if (!html5QrCodeScanner) {
        html5QrCodeScanner = new window.Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false // verbose
        );
      }
      
      html5QrCodeScanner.render(
        (decodedText) => {
          if (!decodedText || decodedText.trim().length < 4) return; // Prevent false positives
          handleSuccessfulPatientSelection(decodedText);
        },
        (errorMessage) => {
          // parse errors ignore
        }
      );
    } else {
      alert('QR scanner library is unavailable. Please refresh and try again.');
    }
  }

  function handleSuccessfulPatientSelection(patientIdStr) {
    const normalizedPatientId = normalizePatientQrValue(patientIdStr);

    if (expectedPatientId && normalizedPatientId !== expectedPatientId) {
      alert('This QR card does not match the scheduled patient. Please scan the correct patient card.');
      scannedPatientId = null;
      return;
    }

    scannedPatientId = normalizedPatientId;
    if (html5QrCodeScanner) {
      try { html5QrCodeScanner.clear(); } catch(e) {}
    }
    
    document.getElementById('qr-reader').style.display = 'none';
    document.getElementById('qr-success').classList.remove('hidden');
    document.getElementById('modalFooter').classList.remove('hidden');
    document.getElementById('patientModalContent').style.backgroundColor = '#ECFDF5';
    
    document.getElementById('scannedPatientName').innerText = "Loading...";
    supabase.from('patient_profile')
      .select('name')
      .eq('id', normalizedPatientId)
      .single()
      .then(({data, error}) => {
        if (data && data.name) {
          document.getElementById('scannedPatientName').innerText = data.name;
        } else {
          document.getElementById('scannedPatientName').innerText = "Unknown Patient";
        }
      }).catch(() => {
        document.getElementById('scannedPatientName').innerText = "Unknown Patient";
      });
  }

  function closeModal() {
    patientModal.classList.add('hidden');
    scannedPatientId = null;
    expectedPatientId = null;
    if (html5QrCodeScanner) {
      try {
        html5QrCodeScanner.clear();
      } catch(e) {}
    }
  }

  if (startBtn && patientModal) {
    startBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);

    patientModal.addEventListener('click', (e) => {
      if (e.target === patientModal) closeModal();
    });

    modalStartBtn.addEventListener('click', async () => {
      if (!scannedPatientId) return;
      let finalPatientId = scannedPatientId;
      
      try {
        if (expectedPatientId) {
          await api.data.updateBookingStatus(finalPatientId, 'completed');
        }
        const newCons = await api.data.createConsultation(finalPatientId);
        currentConsultationId = newCons.id;
        await loadDoctorData();
      } catch(e) {
        console.error("Error creating consultation", e);
        alert("Failed to create consultation. Please ensure the Patient ID is a valid user ID.");
        return; // Abort recording if DB insert fails
      }
      
      closeModal();
      startRecordingUI();
    });
  }

  let mediaRecorder;
  let audioChunks = [];
  let currentConsultationId = null;

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async function startRecordingUI() {
    try {
      // 1. Request microphone BEFORE showing UI
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. Microphone granted, show UI
      isRecording = true;
      recordingSeconds = 0;
      recordingTimer.innerText = '00:00';
      recordingOverlay.classList.remove('hidden');

      timerInterval = setInterval(() => {
        recordingSeconds++;
        recordingTimer.innerText = formatTime(recordingSeconds);
      }, 1000);

      // 3. Setup Recorder
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        if (currentConsultationId) {
          try {
            overlayStopBtn.innerHTML = '<i class="uil uil-spinner-alt uil-spin"></i> Saving...';
            overlayStopBtn.disabled = true;
            
            // Mark consultation as processing before starting
            await api.data.updateConsultationStatus(currentConsultationId, 'processing');
            loadDoctorData(); // Refresh so it shows up in drafts as processing
            
            await api.data.uploadAudio(currentConsultationId, audioBlob);

            // Trigger Soniox transcription in the background
            try {
              console.log('[CliNotes] Triggering Soniox transcription...');
              const transcribeResult = await api.data.triggerTranscription(currentConsultationId);
              console.log('[CliNotes] Transcription started:', transcribeResult);

              // Show transcription toast
              if (toast) {
                toast.querySelector('span').textContent = '🎙️ Transcription in progress...';
                toast.classList.add('show');
                clearTimeout(toastTimeout);
                toastTimeout = setTimeout(() => toast.classList.remove('show'), 6000);
              }
            } catch (transcribeErr) {
              console.warn('[CliNotes] Transcription trigger failed (non-blocking):', transcribeErr.message);
              // Non-blocking — the recording was saved successfully even if transcription fails
            }
          } catch (e) {
            console.error("Failed to upload audio:", e);
            alert(`Upload failed: ${e.message}`);
          } finally {
            overlayStopBtn.innerHTML = '<i class="uil uil-stop-circle"></i> Stop Recording';
            overlayStopBtn.disabled = false;
            recordingOverlay.classList.add('hidden');
            loadDoctorData(); 
          }
        } else {
          recordingOverlay.classList.add('hidden');
        }
      };

      mediaRecorder.start(1000);
    } catch (err) {
      console.error("Microphone access denied or not available:", err);
      alert("Microphone access is required to record a consultation.");
    }
  }

  function stopRecordingUI(skipSave = false) {
    isRecording = false;
    clearInterval(timerInterval);
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      recordingOverlay.classList.add('hidden');
    }
  }

  if (overlayStopBtn) {
    overlayStopBtn.addEventListener('click', () => stopRecordingUI(false));
  }

  // Logout Logic
  const logoutBtn = document.querySelector('.avatar'); // Assuming avatar acts as dropdown or button for now
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to log out?')) {
        await api.auth.signOut();
        window.location.href = '/';
      }
    });
  }

  // ─── Patient Search ───
  const searchInput = document.getElementById('patientSearchInput');
  const searchDropdown = document.getElementById('searchDropdown');
  const searchResults = document.getElementById('searchResults');
  let searchTimeout = null;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();

      if (query.length < 2) {
        searchDropdown.classList.add('hidden');
        return;
      }

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        try {
          searchResults.innerHTML = '<div class="search-loading"><i class="uil uil-spinner-alt uil-spin"></i> Searching...</div>';
          searchDropdown.classList.remove('hidden');

          const patients = await api.data.searchPatients(query);

          if (!patients || patients.length === 0) {
            searchResults.innerHTML = '<div class="search-empty"><i class="uil uil-user-times"></i> No patients found</div>';
            return;
          }

          searchResults.innerHTML = patients.map(p => {
            const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const meta = [p.age ? `Age ${p.age}` : '', p.gender || ''].filter(Boolean).join(' • ');
            return `
              <a href="/patient-profile.html?id=${p.id}" class="search-result-item">
                <div class="search-avatar">${initials}</div>
                <div class="search-info">
                  <span class="search-name">${p.name}</span>
                  <span class="search-meta">${meta || 'Patient'}</span>
                </div>
                <i class="uil uil-arrow-right"></i>
              </a>
            `;
          }).join('');

        } catch (err) {
          console.error('Search error:', err);
          searchResults.innerHTML = '<div class="search-empty"><i class="uil uil-exclamation-triangle"></i> Search failed</div>';
        }
      }, 300); // 300ms debounce
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchWrapper')) {
        searchDropdown.classList.add('hidden');
      }
    });

    // Close on Escape
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchDropdown.classList.add('hidden');
        searchInput.blur();
      }
    });
  }

  // --- AI Summary Review Modal Logic ---
  const aiReviewModal = document.getElementById('aiReviewModal');
  const closeReviewModalBtn = document.getElementById('closeReviewModalBtn');
  const editReviewModalBtn = document.getElementById('editReviewModalBtn');
  const approveReviewModalBtn = document.getElementById('approveReviewModalBtn');
  const aiReviewForm = document.getElementById('aiReviewForm');
  const labReviewModal = document.getElementById('labReviewModal');
  const closeLabReviewModalBtn = document.getElementById('closeLabReviewModalBtn');
  const closeLabReviewFooterBtn = document.getElementById('closeLabReviewFooterBtn');
  const approveLabReviewBtn = document.getElementById('approveLabReviewBtn');
  const labReviewContent = document.getElementById('labReviewContent');
  const recommendedActionModal = document.getElementById('recommendedActionModal');
  const recommendedActionTitle = document.getElementById('recommendedActionTitle');
  const recommendedActionContent = document.getElementById('recommendedActionContent');
  const closeRecommendedActionModalBtn = document.getElementById('closeRecommendedActionModalBtn');
  const discardRecommendedActionBtn = document.getElementById('discardRecommendedActionBtn');
  const approveRecommendedActionBtn = document.getElementById('approveRecommendedActionBtn');
  const printRecommendedActionBtn = document.getElementById('printRecommendedActionBtn');
  
  let currentReviewData = null;
  let isEditingReview = false;
  let currentLabDiscussionId = null;
  let currentRecommendedAction = null;
  
  if (aiReviewModal) {
    closeReviewModalBtn.addEventListener('click', () => {
      aiReviewModal.classList.add('hidden');
    });
    
    editReviewModalBtn.addEventListener('click', () => {
      isEditingReview = !isEditingReview;
      
      const inputs = aiReviewForm.querySelectorAll('input, textarea');
      inputs.forEach(input => {
        if (isEditingReview) {
          input.removeAttribute('readonly');
          input.style.border = '2px solid #3B82F6';
          input.style.backgroundColor = '#FFFFFF';
        } else {
          input.setAttribute('readonly', 'true');
          input.style.border = '1px solid transparent';
          input.style.backgroundColor = 'transparent';
        }
      });
      
      if (isEditingReview) {
        editReviewModalBtn.innerHTML = '<i class="uil uil-save"></i> Finish Editing';
      } else {
        editReviewModalBtn.innerHTML = '<i class="uil uil-edit"></i> Edit Notes';
      }
    });
    
    approveReviewModalBtn.addEventListener('click', async () => {
      const consultationId = approveReviewModalBtn.getAttribute('data-id');
      if (!consultationId) return;
      
      // Re-build JSON from inputs
      try {
        const getVal = id => document.getElementById(id)?.value || '';
        const getArr = id => getVal(id).split(',').map(s => s.trim()).filter(Boolean);
        
        currentReviewData.title = getVal('review_title');
        currentReviewData.subjective = currentReviewData.subjective || {};
        currentReviewData.subjective.chief_complaint = getVal('review_cc');
        currentReviewData.subjective.history = getVal('review_hx');
        currentReviewData.subjective.allergies = getArr('review_allergies');
        
        currentReviewData.objective = currentReviewData.objective || {};
        currentReviewData.objective.vitals = getVal('review_vitals');
        currentReviewData.objective.physical_exam = getVal('review_pe');
        
        currentReviewData.assessment = currentReviewData.assessment || {};
        currentReviewData.assessment.diagnoses = getArr('review_dx');
        
        currentReviewData.plan = currentReviewData.plan || {};
        currentReviewData.plan.treatment = getArr('review_tx');
        currentReviewData.plan.follow_up = getVal('review_fu');

        if (!currentReviewData.patient_summary) {
          try {
            currentReviewData.patient_summary = await api.data.generatePatientSummary(currentReviewData);
          } catch (summaryErr) {
            console.warn('Patient-friendly summary generation failed:', summaryErr);
          }
        }
        
        // Save to DB
        await api.data.updateAISummary(consultationId, currentReviewData);
        await api.data.updateConsultationStatus(consultationId, 'reviewed');
        
        aiReviewModal.classList.add('hidden');
        await loadDoctorData(); // Refresh lists
      } catch (e) {
        alert("Failed to save changes.");
        console.error(e);
      }
    });
  }

  function closeLabReviewModal() {
    if (labReviewModal) labReviewModal.classList.add('hidden');
    currentLabDiscussionId = null;
  }

  if (labReviewModal) {
    closeLabReviewModalBtn?.addEventListener('click', closeLabReviewModal);
    closeLabReviewFooterBtn?.addEventListener('click', closeLabReviewModal);
    labReviewModal.addEventListener('click', (e) => {
      if (e.target === labReviewModal) closeLabReviewModal();
    });

    approveLabReviewBtn?.addEventListener('click', async () => {
      if (!currentLabDiscussionId) return;

      try {
        approveLabReviewBtn.disabled = true;
        approveLabReviewBtn.innerHTML = '<i class="uil uil-spinner-alt uil-spin"></i> Approving...';
        await api.data.approveLabDiscussion(currentLabDiscussionId);
        closeLabReviewModal();
        await loadDoctorData();
      } catch (err) {
        console.error('Failed to approve lab discussion:', err);
        alert('Could not approve this lab discussion report.');
      } finally {
        approveLabReviewBtn.disabled = false;
        approveLabReviewBtn.innerHTML = '<i class="uil uil-check"></i> Approve Discussion';
      }
    });
  }

  window.openLabReviewModal = function(discussionId) {
    if (!labReviewModal || !labReviewContent) return;

    const discussion = latestLabDiscussions.find(item => item.id === discussionId);
    if (!discussion) {
      alert('Lab discussion report not found.');
      return;
    }

    currentLabDiscussionId = discussionId;
    const structured = discussion.structured_data || {};
    const title = getLabDiscussionTitle(discussion);
    const created = discussion.created_at
      ? new Date(discussion.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';

    labReviewContent.innerHTML = `
      <div class="lab-report-hero">
        <div>
          <span>Internal Doctor Discussion</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(created)}</p>
        </div>
        <span class="badge ${discussion.approved_at || discussion.status === 'reviewed' ? 'status-ready' : ''}">
          ${discussion.approved_at || discussion.status === 'reviewed' ? 'Reviewed' : 'Draft'}
        </span>
      </div>

      <section class="lab-report-section lab-report-summary">
        <h4>Summary</h4>
        <p>${escapeHtml(discussion.summary_text || 'No summary generated yet.')}</p>
      </section>

      <div class="lab-report-grid">
        ${renderLabReportSection('Prominent Points', structured.prominent_points)}
        ${renderLabReportSection('Decisions', structured.decisions)}
        ${renderLabReportSection('Open Questions', structured.open_questions)}
        ${renderLabReportSection('Action Plan', structured.action_plan)}
      </div>

      <details class="lab-transcript-details">
        <summary>Transcript</summary>
        <p>${escapeHtml(discussion.transcript_text || 'Transcript unavailable.')}</p>
      </details>
    `;

    if (approveLabReviewBtn) {
      const isReviewed = Boolean(discussion.approved_at || discussion.status === 'reviewed');
      approveLabReviewBtn.classList.toggle('hidden', isReviewed);
    }

    labReviewModal.classList.remove('hidden');
  };

  function getConsultationById(consultationId) {
    return latestConsultations.find(consultation => consultation.id === consultationId);
  }

  async function updateRecommendedActionStatus(consultationId, actionKey, status, extraData = {}) {
    const consultation = getConsultationById(consultationId);
    const structured = consultation?.ai_summary?.[0]?.structured_data;
    if (!structured?.recommended_actions?.[actionKey]) throw new Error('Recommended action not found.');

    structured.recommended_actions[actionKey] = {
      ...structured.recommended_actions[actionKey],
      ...extraData,
      status
    };

    await api.data.updateAISummary(consultationId, structured);
  }

  function toDateTimeLocalValue(date) {
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function defaultFollowUpDateTime(timingText = '') {
    const date = inferFollowUpDate(timingText);
    date.setHours(9, 0, 0, 0);
    return toDateTimeLocalValue(date);
  }

  function inferFollowUpDate(timingText = '') {
    const text = String(timingText || '').toLowerCase();
    const date = new Date();
    date.setHours(9, 0, 0, 0);

    const isoMatch = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (isoMatch) {
      const parsed = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    const slashMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
    if (slashMatch) {
      const year = slashMatch[3] ? Number(slashMatch[3]) : date.getFullYear();
      const parsed = new Date(year, Number(slashMatch[2]) - 1, Number(slashMatch[1]));
      if (!Number.isNaN(parsed.getTime()) && parsed >= startOfToday()) return parsed;
    }

    if (text.includes('tomorrow')) {
      date.setDate(date.getDate() + 1);
      return date;
    }
    if (text.includes('next week')) {
      date.setDate(date.getDate() + 7);
      return date;
    }
    if (text.includes('next month')) {
      date.setMonth(date.getMonth() + 1);
      return date;
    }

    const relativeMatch = text.match(/(?:in|after|within|خلال|بعد)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s*(day|days|week|weeks|month|months|year|years|يوم|أيام|اسبوع|أسبوع|اسابيع|أسابيع|شهر|شهور|اشهر|أشهر|سنة|سنوات)/);
    if (relativeMatch) {
      const amount = parseNumberWord(relativeMatch[1]);
      const unit = relativeMatch[2];
      if (unit.includes('day') || unit.includes('يوم') || unit.includes('أيام')) {
        date.setDate(date.getDate() + amount);
      } else if (unit.includes('week') || unit.includes('اسبوع') || unit.includes('أسبوع')) {
        date.setDate(date.getDate() + (amount * 7));
      } else if (unit.includes('month') || unit.includes('شهر') || unit.includes('شهور') || unit.includes('اشهر') || unit.includes('أشهر')) {
        date.setMonth(date.getMonth() + amount);
      } else if (unit.includes('year') || unit.includes('سنة') || unit.includes('سنوات')) {
        date.setFullYear(date.getFullYear() + amount);
      }
      return date;
    }

    date.setDate(date.getDate() + 7);
    return date;
  }

  function parseNumberWord(value) {
    const number = Number(value);
    if (!Number.isNaN(number)) return number;
    return {
      a: 1,
      an: 1,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10
    }[value] || 1;
  }

  function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function actionField(label, value, name, rows = 1) {
    const tag = rows > 1 ? 'textarea' : 'input';
    const escaped = escapeHtml(value || '');
    return `
      <label class="action-form-field">
        <span>${escapeHtml(label)}</span>
        ${tag === 'textarea'
          ? `<textarea data-action-field="${name}" rows="${rows}">${escaped}</textarea>`
          : `<input data-action-field="${name}" value="${escaped}">`}
      </label>
    `;
  }

  function renderRecommendedActionForm(action) {
    const data = action.data || {};
    const meta = actionDocumentMeta(action);

    if (action.type === 'follow_up') {
      return `
        <div class="followup-confirm-card">
          <span>Automatic Follow-up</span>
          <h2>${escapeHtml(action.patientName)}</h2>
          <label>
            <strong>Follow-up date and time</strong>
            <input type="datetime-local" data-action-field="appointment_time" value="${defaultFollowUpDateTime(data.timing || data.reason)}">
          </label>
          <input type="hidden" data-action-field="reason" value="${escapeHtml(data.reason || 'Follow-up consultation')}">
        </div>
      `;
    }

    if (action.type === 'prescription') {
      const medications = data.medications || [];
      return `
        <div class="action-document-shell prescription-shell">
          ${actionDocumentHero('Prescription Draft', action.patientName, 'uil-capsule')}
          ${meta}
          <div class="action-table" data-action-list="medications">
            <div class="action-table-head"><span>Medication</span><span>Dose</span><span>Frequency</span><span>Duration</span><span>Instructions</span></div>
            ${medications.map((med, index) => `
              <div class="action-table-row">
                <input data-list-index="${index}" data-list-field="name" value="${escapeHtml(med.name || '')}">
                <input data-list-index="${index}" data-list-field="dose" value="${escapeHtml(med.dose || '')}">
                <input data-list-index="${index}" data-list-field="frequency" value="${escapeHtml(med.frequency || '')}">
                <input data-list-index="${index}" data-list-field="duration" value="${escapeHtml(med.duration || '')}">
                <input data-list-index="${index}" data-list-field="instructions" value="${escapeHtml(med.instructions || '')}">
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (action.type === 'lab_order') {
      const orders = data.orders || [];
      return `
        <div class="action-document-shell lab-order-shell">
          ${actionDocumentHero('Lab / Imaging Order', action.patientName, 'uil-flask')}
          ${meta}
          <div class="action-table" data-action-list="orders">
            <div class="action-table-head lab-order-head"><span>Type</span><span>Order</span><span>Reason</span><span>Priority</span></div>
            ${orders.map((order, index) => `
              <div class="action-table-row lab-order-row">
                <input data-list-index="${index}" data-list-field="type" value="${escapeHtml(order.type || '')}">
                <input data-list-index="${index}" data-list-field="name" value="${escapeHtml(order.name || '')}">
                <input data-list-index="${index}" data-list-field="reason" value="${escapeHtml(order.reason || '')}">
                <input data-list-index="${index}" data-list-field="priority" value="${escapeHtml(order.priority || 'Routine')}">
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="action-document-shell referral-shell">
        ${actionDocumentHero('Referral Draft', action.patientName, 'uil-share-alt')}
        ${meta}
        <div class="action-form-grid">
          ${actionField('Referral Specialty', data.specialty, 'specialty')}
          ${actionField('Reason', data.reason, 'reason', 3)}
          ${actionField('Patient Debrief for Next Doctor', data.debrief, 'debrief', 5)}
        </div>
      </div>
    `;
  }

  function actionDocumentHero(title, patientName, icon) {
    return `
      <div class="action-document-hero">
        <div>
          <span>${escapeHtml(title)}</span>
          <h2>${escapeHtml(patientName)}</h2>
        </div>
        <div class="action-document-icon"><i class="uil ${icon}"></i></div>
      </div>
    `;
  }

  function actionDocumentMeta(action) {
    return `
      <div class="action-document-meta">
        <div><span>Doctor</span><strong>${escapeHtml(action.doctorName)}</strong></div>
        <div><span>Patient</span><strong>${escapeHtml(action.patientName)}</strong></div>
        <div><span>Consultation Date</span><strong>${escapeHtml(action.consultationDate)}</strong></div>
      </div>
    `;
  }

  function collectRecommendedActionEdits(action) {
    const content = recommendedActionContent;
    if (action.type === 'prescription') {
      return {
        ...action.data,
        medications: Array.from(content.querySelectorAll('.action-table-row')).map(row => ({
          name: row.querySelector('[data-list-field="name"]')?.value || '',
          dose: row.querySelector('[data-list-field="dose"]')?.value || '',
          frequency: row.querySelector('[data-list-field="frequency"]')?.value || '',
          duration: row.querySelector('[data-list-field="duration"]')?.value || '',
          instructions: row.querySelector('[data-list-field="instructions"]')?.value || ''
        })).filter(med => med.name)
      };
    }
    if (action.type === 'lab_order') {
      return {
        ...action.data,
        orders: Array.from(content.querySelectorAll('.action-table-row')).map(row => ({
          type: row.querySelector('[data-list-field="type"]')?.value || '',
          name: row.querySelector('[data-list-field="name"]')?.value || '',
          reason: row.querySelector('[data-list-field="reason"]')?.value || '',
          priority: row.querySelector('[data-list-field="priority"]')?.value || 'Routine'
        })).filter(order => order.name)
      };
    }

    const values = {};
    content.querySelectorAll('[data-action-field]').forEach(input => {
      values[input.dataset.actionField] = input.value;
    });
    return { ...action.data, ...values };
  }

  function printRecommendedAction(action, data) {
    const title = action.title;
    const theme = getRecommendedActionTheme(action.type);
    const body = renderRecommendedActionPrintBody(action, data, theme);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
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
        <body>${body}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function renderRecommendedActionPrintBody(action, data, theme) {
    const printedAt = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    return `
      <main class="print-page">
        <header class="print-header">
          <div>
            <div class="brand">CliNotes</div>
            <h1>${escapeHtml(action.title)}</h1>
          </div>
          <div class="print-date">
            <span class="label">Printed</span>
            ${escapeHtml(printedAt)}
          </div>
        </header>
        <section class="print-body">
          <div class="meta-grid">
            <div class="meta-item"><span class="label">Doctor</span><strong class="value">${escapeHtml(action.doctorName)}</strong></div>
            <div class="meta-item"><span class="label">Patient</span><strong class="value">${escapeHtml(action.patientName)}</strong></div>
            <div class="meta-item"><span class="label">Consultation Date</span><strong class="value">${escapeHtml(action.consultationDate)}</strong></div>
          </div>
          ${renderRecommendedActionPrintDetails(action, data)}
          <div class="signature-row">
            <div class="signature-line">Doctor signature</div>
            <div class="signature-line">Clinic stamp / date</div>
          </div>
          <p class="footer-note">Generated from a reviewed CliNotes consultation draft. Please verify all clinical details before external use.</p>
        </section>
      </main>
    `;
  }

  function renderRecommendedActionPrintDetails(action, data) {
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

    return `
      <section class="section"><h2>Referral Specialty</h2><p>${escapeHtml(data.specialty || '')}</p></section>
      <section class="section"><h2>Reason for Referral</h2><p>${escapeHtml(data.reason || '')}</p></section>
      <section class="section"><h2>Patient Debrief for Next Doctor</h2><p>${escapeHtml(data.debrief || '')}</p></section>
    `;
  }

  function getRecommendedActionTheme(type) {
    return {
      follow_up: { color: '#10B981', soft: '#ECFDF5', modalClass: 'followup-action-modal' },
      prescription: { color: '#EA580C', soft: '#FFF7ED', modalClass: 'prescription-action-modal' },
      lab_order: { color: '#2563EB', soft: '#EFF6FF', modalClass: 'lab-order-action-modal' },
      referral: { color: '#BE185D', soft: '#FDF2F8', modalClass: 'referral-action-modal' }
    }[type] || { color: '#2F6FED', soft: '#EFF6FF', modalClass: '' };
  }

  if (recommendedActionModal) {
    const closeActionModal = () => {
      recommendedActionModal.classList.add('hidden');
      currentRecommendedAction = null;
    };
    closeRecommendedActionModalBtn?.addEventListener('click', closeActionModal);
    recommendedActionModal.addEventListener('click', (event) => {
      if (event.target === recommendedActionModal) closeActionModal();
    });
    printRecommendedActionBtn?.addEventListener('click', () => {
      if (!currentRecommendedAction) return;
      printRecommendedAction(currentRecommendedAction, collectRecommendedActionEdits(currentRecommendedAction));
    });
    discardRecommendedActionBtn?.addEventListener('click', async () => {
      if (!currentRecommendedAction) return;
      await updateRecommendedActionStatus(currentRecommendedAction.consultationId, currentRecommendedAction.key, 'discarded');
      closeActionModal();
      await loadDoctorData();
    });
    approveRecommendedActionBtn?.addEventListener('click', async () => {
      if (!currentRecommendedAction) return;
      const editedData = collectRecommendedActionEdits(currentRecommendedAction);
      try {
        approveRecommendedActionBtn.disabled = true;
        if (currentRecommendedAction.type === 'follow_up') {
          await api.data.createDoctorBooking(
            currentRecommendedAction.patientId,
            new Date(editedData.appointment_time || defaultFollowUpDateTime(currentRecommendedAction.data?.timing || currentRecommendedAction.data?.reason)).toISOString(),
            editedData.reason || 'Follow-up consultation'
          );
        } else {
          printRecommendedAction(currentRecommendedAction, editedData);
        }
        await updateRecommendedActionStatus(currentRecommendedAction.consultationId, currentRecommendedAction.key, 'approved', editedData);
        closeActionModal();
        await loadDoctorData();
      } catch (err) {
        console.error('Recommended action approval failed:', err);
        alert(err.message || 'Could not approve recommended action.');
      } finally {
        approveRecommendedActionBtn.disabled = false;
      }
    });
  }

  window.openRecommendedActionModal = function(consultationId, actionKey) {
    const consultation = getConsultationById(consultationId);
    const action = getGeneratedRecommendedActions(consultation).find(item => item.key === actionKey);
    if (!action || !recommendedActionModal || !recommendedActionContent) return;
    currentRecommendedAction = action;
    recommendedActionTitle.innerText = action.title;
    recommendedActionContent.innerHTML = renderRecommendedActionForm(action);
    const modalContent = recommendedActionModal.querySelector('.modal-content');
    modalContent?.classList.remove('followup-action-modal', 'prescription-action-modal', 'lab-order-action-modal', 'referral-action-modal');
    const theme = getRecommendedActionTheme(action.type);
    if (theme.modalClass) modalContent?.classList.add(theme.modalClass);
    printRecommendedActionBtn.classList.toggle('hidden', action.type === 'follow_up');
    discardRecommendedActionBtn.classList.toggle('hidden', action.type === 'follow_up');
    approveRecommendedActionBtn.innerHTML = action.type === 'follow_up'
      ? '<i class="uil uil-calendar-alt"></i> Confirm Follow-up'
      : '<i class="uil uil-check"></i> Approve & Print';
    recommendedActionModal.classList.remove('hidden');
  };

  window.openReviewModal = async function(consultationId) {
    if (!aiReviewModal || !aiReviewForm) return;
    
    // Fetch the specific consultation and its AI summary
    try {
      const { data, error } = await supabase
        .from('consultation')
        .select(`
          *,
          ai_summary(structured_data)
        `)
        .eq('id', consultationId)
        .single();
        
      if (error) throw error;
      
      if (data && data.ai_summary && data.ai_summary[0] && data.ai_summary[0].structured_data) {
        currentReviewData = data.ai_summary[0].structured_data;
        isEditingReview = false;
        editReviewModalBtn.innerHTML = '<i class="uil uil-edit"></i> Edit Notes';
        
        const s = currentReviewData;
        const sub = s.subjective || {};
        const obj = s.objective || {};
        const ast = s.assessment || {};
        const pln = s.plan || {};
        
        // Helper to generate a text area
        const field = (id, label, val, isArr = false) => {
          const displayVal = isArr ? (val || []).join(', ') : (val || '');
          const rows = displayVal.length > 80 ? 3 : 1;
          return `
            <div style="margin-bottom: 16px;">
              <label style="font-size: 13px; font-weight: 700; color: #64748B; text-transform: uppercase;">${label}</label>
              <textarea id="${id}" readonly style="width: 100%; min-height: 40px; border: 1px solid transparent; background: transparent; font-family: inherit; font-size: 15px; color: #334155; padding: 8px; border-radius: 8px; resize: vertical;" rows="${rows}">${displayVal}</textarea>
            </div>
          `;
        };
        
        aiReviewForm.innerHTML = `
          <div style="margin-bottom: 24px;">
            <input id="review_title" readonly value="${s.title || ''}" style="width: 100%; font-size: 20px; font-weight: 800; border: 1px solid transparent; background: transparent; padding: 8px; color: #0f172a; border-radius: 8px;" />
          </div>
          
          <div style="display: flex; gap: 24px;">
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <h4 style="color: #3B82F6; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 12px;">Subjective</h4>
              ${field('review_cc', 'Chief Complaint', sub.chief_complaint)}
              ${field('review_hx', 'Medical History', sub.history)}
              ${field('review_allergies', 'Allergies', sub.allergies, true)}
              
              <h4 style="color: #3B82F6; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 12px; margin-top: 16px;">Objective</h4>
              ${hasVitalsData(obj.vitals) ? field('review_vitals', 'Vitals', formatVitalsForReview(obj.vitals)) : ''}
              ${field('review_pe', 'Physical Exam', obj.physical_exam)}
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <h4 style="color: #3B82F6; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 12px;">Assessment</h4>
              ${field('review_dx', 'Diagnoses', ast.diagnoses, true)}
              
              <h4 style="color: #3B82F6; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 12px; margin-top: 16px;">Plan</h4>
              ${field('review_tx', 'Treatment', pln.treatment, true)}
              ${field('review_fu', 'Follow Up', pln.follow_up)}
            </div>
          </div>
        `;
        
        approveReviewModalBtn.setAttribute('data-id', consultationId);
        aiReviewModal.classList.remove('hidden');
      } else {
        alert("AI Summary not found.");
      }
    } catch (e) {
      console.error("Failed to load summary for review:", e);
      alert("Failed to load summary.");
    }
  };

  function hasVitalsData(vitals) {
    return Object.values(normalizeVitals(vitals)).some(value => String(value || '').trim());
  }

  function formatVitalsForReview(vitals) {
    return Object.entries(normalizeVitals(vitals))
      .filter(([, value]) => String(value || '').trim())
      .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
      .join(', ');
  }

  function normalizeVitals(vitals) {
    if (!vitals || typeof vitals !== 'object' || Array.isArray(vitals)) return {};
    return {
      blood_pressure: vitals.blood_pressure || vitals.bp || vitals.BP || '',
      heart_rate: vitals.heart_rate || vitals.pulse || '',
      temperature: vitals.temperature || vitals.temp || '',
    };
  }
});
