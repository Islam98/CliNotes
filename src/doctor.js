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

      const bookings = await api.data.getBookings();

      if (!bookings || bookings.length === 0) {
        scheduleContainer.innerHTML = '<p style="padding:16px;">No consultations scheduled.</p>';
      } else {
        bookings.forEach(booking => {
          const date = new Date(booking.appointment_time);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const ptName = booking.patient?.name || 'Unknown Patient';

          if (booking.status === 'scheduled') {
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
                  <button class="action-btn start-from-schedule-btn" data-id="${booking.patient_id}">Start</button>
                </div>
              </div>
            `;
          }
        });
      }

      if (!consultations || consultations.length === 0) {
        historyContainer.innerHTML = '<p style="padding:16px;">No history.</p>';
        draftsContainer.innerHTML = '<p style="padding:16px;">No drafts pending.</p>';
        return;
      }

      consultations.forEach(cons => {
        const date = new Date(cons.date_time);
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const ptName = cons.patient?.name || 'Unknown Patient';

        if (cons.status === 'processed') {
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
                <button class="primary-btn review-btn" onclick="window.location.href='/patient-profile.html?id=${cons.patient_id}'">Review</button>
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
  
  const recordingOverlay = document.getElementById('recordingOverlay');
  const recordingTimer = document.getElementById('recordingTimer');
  const overlayStopBtn = document.getElementById('overlayStopBtn');
  
  let isRecording = false;
  let timerInterval = null;
  let recordingSeconds = 0;
  
  let html5QrCodeScanner = null;
  let scannedPatientId = null;

  function openModal() {
    patientModal.classList.remove('hidden');
    document.getElementById('qr-reader').style.display = 'block';
    const manualEntry = document.getElementById('manual-patient-entry');
    if (manualEntry) manualEntry.style.display = 'block';
    
    document.getElementById('qr-success').classList.add('hidden');
    document.getElementById('modalFooter').classList.add('hidden');
    document.getElementById('patientModalContent').style.backgroundColor = 'white';
    scannedPatientId = null;

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
    }
  }

  function handleSuccessfulPatientSelection(patientIdStr) {
    scannedPatientId = patientIdStr;
    if (html5QrCodeScanner) {
      try { html5QrCodeScanner.clear(); } catch(e) {}
    }
    
    document.getElementById('qr-reader').style.display = 'none';
    document.getElementById('manual-patient-entry').style.display = 'none';
    document.getElementById('qr-success').classList.remove('hidden');
    document.getElementById('modalFooter').classList.remove('hidden');
    document.getElementById('patientModalContent').style.backgroundColor = '#ECFDF5';
    
    let queryId = patientIdStr;
    if (queryId === 'PT-9999') {
       queryId = '99999999-9999-9999-9999-999999999999';
    }

    document.getElementById('scannedPatientName').innerText = "Loading...";
    supabase.from('patient_profile')
      .select('name')
      .eq('id', queryId)
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

  // Wire up manual patient ID input
  const manualSubmitBtn = document.getElementById('manualPatientSubmitBtn');
  const manualInput = document.getElementById('manualPatientIdInput');
  if (manualSubmitBtn && manualInput) {
    manualSubmitBtn.addEventListener('click', () => {
      const val = manualInput.value.trim();
      if (val.length >= 4) {
        handleSuccessfulPatientSelection(val);
      }
    });
  }

  function closeModal() {
    patientModal.classList.add('hidden');
    scannedPatientId = null;
    if (html5QrCodeScanner) {
      try {
        html5QrCodeScanner.clear();
      } catch(e) {}
    }
  }

  if (startBtn && patientModal) {
    startBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);

    patientModal.addEventListener('click', (e) => {
      if (e.target === patientModal) closeModal();
    });

    modalStartBtn.addEventListener('click', async () => {
      if (!scannedPatientId) return;
      let finalPatientId = scannedPatientId;
      
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
});
