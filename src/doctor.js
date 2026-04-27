import { api } from './api.js';

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

  // Fetch and render data
  async function loadDoctorData() {
    try {
      const consultations = await api.data.getConsultations();
      
      const scheduleContainer = document.querySelector('.schedule-card .list-body');
      const historyContainer = document.querySelector('.history-card .list-body');
      const draftsContainer = document.querySelector('.drafts-card .list-body');
      
      scheduleContainer.innerHTML = '';
      historyContainer.innerHTML = '';
      draftsContainer.innerHTML = '';

      if (!consultations || consultations.length === 0) {
        scheduleContainer.innerHTML = '<p style="padding:16px;">No consultations scheduled.</p>';
        historyContainer.innerHTML = '<p style="padding:16px;">No history.</p>';
        draftsContainer.innerHTML = '<p style="padding:16px;">No drafts pending.</p>';
        return;
      }

      consultations.forEach(cons => {
        const date = new Date(cons.date_time);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const ptName = cons.patient?.name || 'Unknown Patient';

        if (cons.status === 'pending') {
          // Schedule
          scheduleContainer.innerHTML += `
            <div class="list-row schedule-row">
              <div class="row-info">
                <span class="time">${timeStr}</span>
                <div class="patient-details">
                  <div class="name">${ptName}</div>
                  <span class="type">Consultation</span>
                </div>
              </div>
              <div class="row-actions">
                <span class="badge status-ready">Scheduled</span>
                <button class="action-btn start-from-schedule-btn" data-id="${cons.patient_id}">Start</button>
              </div>
            </div>
          `;
        } else if (cons.status === 'processed') {
          // Drafts
          draftsContainer.innerHTML += `
            <div class="list-row draft-row">
              <div class="row-info">
                <div class="avatar-sm">${ptName.substring(0, 2).toUpperCase()}</div>
                <div class="draft-details">
                  <span class="name">${ptName}</span>
                  <span class="date">${dateStr} • AI Processing Complete</span>
                </div>
              </div>
              <div class="row-actions">
                <span class="badge status-ready">Ready for Review</span>
                <button class="primary-btn">Review</button>
              </div>
            </div>
          `;
        } else {
          // History
          historyContainer.innerHTML += `
             <div class="list-row history-row">
              <div class="row-info">
                <span class="date-tag">${dateStr}</span>
                <span class="name">${ptName}</span>
              </div>
              <div class="history-actions">
                <button class="secondary-btn"><i class="uil uil-file-alt"></i> View Summary</button>
              </div>
            </div>
          `;
        }
      });
      
      // Re-attach start buttons events
      document.querySelectorAll('.start-from-schedule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          openModal();
          const newPatientInput = document.getElementById('newPatientIdInput');
          if (newPatientInput) {
             newPatientInput.value = e.target.dataset.id;
             selectedPatientId = e.target.dataset.id;
          }
        });
      });

    } catch (e) {
      console.error(e);
    }
  }

  await loadDoctorData();

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
  const newPatientInput = document.getElementById('newPatientIdInput');
  const suggestionCards = document.querySelectorAll('.patient-suggestion-card');
  const scheduleStartBtns = document.querySelectorAll('.start-from-schedule-btn');

  const recordingOverlay = document.getElementById('recordingOverlay');
  const recordingTimer = document.getElementById('recordingTimer');
  const overlayStopBtn = document.getElementById('overlayStopBtn');
  
  let selectedPatientId = null;
  let isRecording = false;
  let timerInterval = null;
  let recordingSeconds = 0;

  function openModal() {
    patientModal.classList.remove('hidden');
  }

  function closeModal() {
    patientModal.classList.add('hidden');
    // Reset selections
    selectedPatientId = null;
    newPatientInput.value = '';
    suggestionCards.forEach(c => c.classList.remove('selected'));
  }

  if (startBtn && patientModal) {
    startBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);

    // Click outside to close
    patientModal.addEventListener('click', (e) => {
      if (e.target === patientModal) closeModal();
    });

    suggestionCards.forEach(card => {
      card.addEventListener('click', () => {
        suggestionCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedPatientId = card.dataset.id;
        newPatientInput.value = ''; // clear input if suggestion used
      });
    });

    newPatientInput.addEventListener('input', () => {
      if (newPatientInput.value.trim().length > 0) {
        suggestionCards.forEach(c => c.classList.remove('selected'));
        selectedPatientId = newPatientInput.value.trim();
      }
    });

    modalStartBtn.addEventListener('click', async () => {
      if (!selectedPatientId && !newPatientInput.value.trim()) {
        newPatientInput.style.borderColor = '#EF4444';
        return;
      }
      let finalPatientId = selectedPatientId || newPatientInput.value.trim();
      
      // Temporary override for testing mock patient
      if (finalPatientId === 'PT-9999') {
        finalPatientId = '99999999-9999-9999-9999-999999999999';
      }
      
      try {
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
            
            await api.data.uploadAudio(currentConsultationId, audioBlob);
          } catch (e) {
            console.error("Failed to upload audio:", e);
            alert("Storage upload failed. Please ensure Supabase Storage RLS policies allow authenticated inserts.");
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

      mediaRecorder.start();
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
});
