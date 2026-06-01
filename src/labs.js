import { api } from './api.js';

const participants = [];
let mediaRecorder = null;
let audioChunks = [];
let recordingSeconds = 0;
let timerInterval = null;
let currentDiscussionId = null;

const participantsList = document.getElementById('participantsList');
const participantCount = document.getElementById('participantCount');
const addDoctorForm = document.getElementById('addDoctorForm');
const startBtn = document.getElementById('startDiscussionBtn');
const stopBtn = document.getElementById('stopDiscussionBtn');
const recordingPanel = document.getElementById('recordingPanel');
const recordingTimer = document.getElementById('recordingTimer');
const recordingStatus = document.getElementById('recordingStatus');
const toast = document.getElementById('labsToast');

addDoctorForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = document.getElementById('doctorEmail').value.trim();
  const password = document.getElementById('doctorPassword').value;
  const button = addDoctorForm.querySelector('button');

  button.disabled = true;
  button.innerHTML = '<i class="uil uil-spinner-alt uil-spin"></i> Verifying...';

  try {
    const doctor = await api.data.verifyLabDoctor(email, password);
    if (participants.some(p => p.id === doctor.id)) {
      showToast('Doctor is already in this discussion.');
      return;
    }
    participants.push(doctor);
    addDoctorForm.reset();
    renderParticipants();
  } catch (error) {
    showToast(error.message || 'Could not add doctor.');
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="uil uil-user-plus"></i> Add to Discussion';
  }
});

startBtn.addEventListener('click', async () => {
  if (participants.length === 0) {
    showToast('Add at least one doctor first.');
    return;
  }

  try {
    const discussion = await api.data.createLabDiscussion(
      'Internal Clinical Discussion',
      participants.map(p => p.id)
    );
    currentDiscussionId = discussion.id;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach(track => track.stop());
      await processDiscussion(audioBlob);
    };

    mediaRecorder.start(1000);
    startTimer();
    recordingPanel.classList.remove('hidden');
    startBtn.disabled = true;
  } catch (error) {
    showToast(error.message || 'Could not start recording.');
  }
});

stopBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    recordingStatus.innerText = 'Saving and processing discussion';
    stopBtn.disabled = true;
    mediaRecorder.stop();
  }
});

async function processDiscussion(audioBlob) {
  try {
    stopTimer();
    await api.data.uploadLabDiscussionAudio(currentDiscussionId, audioBlob);
    await api.data.triggerLabDiscussionTranscription(currentDiscussionId);
    showToast('Discussion sent for transcription and AI analysis.');
  } catch (error) {
    showToast(error.message || 'Could not process discussion.');
  } finally {
    recordingPanel.classList.add('hidden');
    startBtn.disabled = false;
    stopBtn.disabled = false;
    recordingStatus.innerText = 'Recording discussion';
    currentDiscussionId = null;
  }
}

function renderParticipants() {
  participantCount.innerText = `${participants.length} added`;
  if (participants.length === 0) {
    participantsList.innerHTML = '<p class="empty-copy">Add doctors using their CliNotes credentials.</p>';
    return;
  }

  participantsList.innerHTML = participants.map(doctor => `
    <div class="participant-row">
      <div class="participant-avatar">${escapeHtml(getInitials(doctor.name))}</div>
      <div>
        <strong>${escapeHtml(doctor.name)}</strong>
        <span>${escapeHtml(doctor.specialty || 'Doctor')}</span>
      </div>
    </div>
  `).join('');
}

function startTimer() {
  recordingSeconds = 0;
  recordingTimer.innerText = '00:00';
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    recordingSeconds++;
    const minutes = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
    const seconds = String(recordingSeconds % 60).padStart(2, '0');
    recordingTimer.innerText = `${minutes}:${seconds}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function showToast(message) {
  toast.innerText = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function getInitials(name) {
  return (name || 'DR').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
