document.addEventListener('DOMContentLoaded', () => {
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

    // Schedule start buttons open modal with pre-selection (mock)
    scheduleStartBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        openModal();
      });
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

    modalStartBtn.addEventListener('click', () => {
      if (!selectedPatientId && !newPatientInput.value.trim()) {
        newPatientInput.style.borderColor = '#EF4444';
        return;
      }
      
      closeModal();
      startRecordingUI();
    });
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function startRecordingUI() {
    isRecording = true;
    recordingSeconds = 0;
    recordingTimer.innerText = '00:00';
    recordingOverlay.classList.remove('hidden');

    timerInterval = setInterval(() => {
      recordingSeconds++;
      recordingTimer.innerText = formatTime(recordingSeconds);
    }, 1000);
  }

  function stopRecordingUI() {
    isRecording = false;
    clearInterval(timerInterval);
    recordingOverlay.classList.add('hidden');
  }

  if (overlayStopBtn) {
    overlayStopBtn.addEventListener('click', stopRecordingUI);
  }

  // Cancel Appointment Logic
  const cancelBtns = document.querySelectorAll('.cancel-btn');
  cancelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.target.closest('.list-row');
      if (row) {
        row.style.transform = 'translateX(20px)';
        row.style.opacity = '0';
        setTimeout(() => row.remove(), 300);
      }
    });
  });
});
