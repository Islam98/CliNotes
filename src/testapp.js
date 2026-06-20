import { getServerUrl } from './app-config.js';
import { appState } from './app-state.js';

const state = {
  mode: 'consultation',
  language: appState.language,
  mediaRecorder: null,
  stream: null,
  chunks: [],
  seconds: 0,
  timer: null,
  mockDoctors: ['Dr. Omar Mah', 'Dr. Layla Hassan'],
  lastRecommendedActions: [],
  lastResult: null,
  lastAudioBlob: null,
  lastAudioExtension: 'webm',
  currentRunBaseName: '',
  testPassword: appState.testPassword,
};

const els = {
  testPasswordOverlay: document.getElementById('testPasswordOverlay'),
  testPasswordForm: document.getElementById('testPasswordForm'),
  testPasswordInput: document.getElementById('testPasswordInput'),
  unlockTestPageBtn: document.getElementById('unlockTestPageBtn'),
  testPasswordError: document.getElementById('testPasswordError'),
  testingBadge: document.getElementById('testingBadge'),
  testingDisclaimer: document.getElementById('testingDisclaimer'),
  englishToggleBtn: document.getElementById('englishToggleBtn'),
  arabicToggleBtn: document.getElementById('arabicToggleBtn'),
  heroEyebrow: document.getElementById('heroEyebrow'),
  heroTitle: document.getElementById('heroTitle'),
  heroDescription: document.getElementById('heroDescription'),
  consultationModeLabel: document.getElementById('consultationModeLabel'),
  labsModeLabel: document.getElementById('labsModeLabel'),
  consultationModeBtn: document.getElementById('consultationModeBtn'),
  labsModeBtn: document.getElementById('labsModeBtn'),
  modeTitle: document.getElementById('modeTitle'),
  modeSubtitle: document.getElementById('modeSubtitle'),
  modePill: document.getElementById('modePill'),
  labsFields: document.getElementById('labsFields'),
  mockDoctorsLabel: document.getElementById('mockDoctorsLabel'),
  mockDoctorsInput: document.getElementById('mockDoctorsInput'),
  addMockDoctorBtn: document.getElementById('addMockDoctorBtn'),
  addDoctorLabel: document.getElementById('addDoctorLabel'),
  mockDoctorList: document.getElementById('mockDoctorList'),
  recordingDot: document.getElementById('recordingDot'),
  recordingLabel: document.getElementById('recordingLabel'),
  recordingTimer: document.getElementById('recordingTimer'),
  startRecordBtn: document.getElementById('startRecordBtn'),
  startRecordLabel: document.getElementById('startRecordLabel'),
  stopRecordBtn: document.getElementById('stopRecordBtn'),
  stopRecordLabel: document.getElementById('stopRecordLabel'),
  uploadConsultationLabel: document.getElementById('uploadConsultationLabel'),
  uploadConsultationText: document.getElementById('uploadConsultationText'),
  uploadConsultationInput: document.getElementById('uploadConsultationInput'),
  diagnosticsTitle: document.getElementById('diagnosticsTitle'),
  diagnosticsList: document.getElementById('diagnosticsList'),
  outputTitle: document.getElementById('outputTitle'),
  outputContent: document.getElementById('outputContent'),
  outputSubtitle: document.getElementById('outputSubtitle'),
  downloadAudioBtn: document.getElementById('downloadAudioBtn'),
  downloadAudioLabel: document.getElementById('downloadAudioLabel'),
  downloadResultsBtn: document.getElementById('downloadResultsBtn'),
  downloadResultsLabel: document.getElementById('downloadResultsLabel'),
};

const copy = {
  en: {
    testingBadge: 'Testing Page',
    testingDisclaimer: 'Not part of the real app. No authentication, patient verification, or database write is performed here.',
    heroEyebrow: 'Pipeline Test Harness',
    heroTitle: 'Test CliNotes recording flows without restrictions',
    heroDescription: 'This page records audio, sends it through the current Soniox and Gemini pipeline, and displays the outputs that would normally appear for doctors and patients.',
    consultationMode: 'Test Doctor Consultation',
    labsMode: 'Test Doctor Discussion',
    consultationTitle: 'Doctor Consultation Test',
    labsTitle: 'Doctor Discussion Test',
    consultationSubtitle: 'Record a mock doctor-patient consultation. No QR verification or patient lookup is required.',
    labsSubtitle: 'Add mock doctor names, record an internal discussion, and inspect the report that would be sent to participating doctors.',
    consultationPill: 'Consultation',
    labsPill: 'Labs Mode',
    mockDoctors: 'Mock participating doctors',
    add: 'Add',
    ready: 'Ready to record',
    recordingConsultation: 'Recording consultation',
    recordingLabs: 'Recording doctor discussion',
    startRecording: 'Start Recording',
    stopRecording: 'Stop & Run Pipeline',
    uploadAudio: 'Upload Consultation Audio',
    diagnostics: 'Diagnostics',
    outputTitle: 'Generated Output',
    outputWaiting: 'Results appear here after Soniox and Gemini finish.',
    downloadAudio: 'Download audio',
    downloadResults: 'Download results',
    emptyOutput: 'Choose a mode, record a short sample, then stop the recording.',
    uploadLabsOnly: 'Audio upload is currently available for patient consultation testing only.',
    uploadedAudio: 'Uploaded audio selected',
    preparingAudio: 'Preparing audio',
    processing: 'Processing through Soniox and Gemini. This can take a minute.',
    pipelineRunning: 'Pipeline is running...',
    pipelineComplete: 'Test pipeline completed.',
    pipelineFailed: 'Pipeline failed.',
    pipelineError: 'Pipeline Error',
    microphoneError: 'Microphone access is required for this test.',
    requestFailed: 'The test pipeline failed.',
    doctorSoap: 'Doctor SOAP Draft',
    recommendedActions: 'Recommended Actions',
    consultationSummary: 'Consultation Summary',
    patientLanguage: 'Patient-Side Simple Language',
    whatYouCameFor: 'What you came for',
    whatWasDiscussed: 'What was discussed',
    whatDoctorFound: 'What the doctor found',
    whatHappensNext: 'What happens next',
    noActionsTitle: 'No recommended actions generated',
    noActionsBody: 'Gemini did not return follow-up, prescription, lab order, or referral actions for this test consultation.',
    followUpTitle: 'Book follow-up consultation',
    followUpDefault: 'Follow-up recommended',
    prescriptionTitle: 'Prescription draft',
    prescriptionDefault: 'Medication draft generated',
    labOrderTitle: 'Lab or imaging order',
    labOrderDefault: 'Order draft generated',
    referralTitle: 'Referral draft',
    referralDefault: 'Referral draft generated',
    timing: 'Timing',
    reason: 'Reason',
    specialty: 'Specialty',
    debrief: 'Debrief',
    detail: 'Detail',
    printable: 'View printable version',
    geminiJson: 'Gemini JSON',
    transcript: 'Transcript',
    noTranscript: 'No transcript returned.',
    soapTitleFallback: 'Clinical Consultation Draft',
    subjective: 'Subjective',
    objective: 'Objective',
    assessment: 'Assessment',
    plan: 'Plan',
    chiefComplaint: 'Chief Complaint',
    medicalHistory: 'Medical History',
    allergies: 'Allergies',
    vitals: 'Vitals',
    noVitalsRecorded: 'No vitals were recorded.',
    bloodPressure: 'Blood pressure',
    heartRate: 'Heart rate',
    temperature: 'Temperature',
    physicalExam: 'Physical Exam',
    diagnoses: 'Diagnoses',
    treatment: 'Treatment',
    followUp: 'Follow Up',
    labReport: 'Participating Doctor Report',
    headline: 'Headline',
    participants: 'Participants',
    summary: 'Summary',
    prominentPoints: 'Prominent Points',
    decisions: 'Decisions',
    actionPlan: 'Action Plan',
    notReturned: 'Not returned.',
    diagnosticSteps: [
      'Recording local microphone audio',
      'Uploading test audio to server',
      'Sending audio to Soniox',
      'Waiting for transcription',
      'Sending transcript to Gemini',
      'Rendering test outputs',
    ],
    printBrand: 'CliNotes Test Page',
    printed: 'Printed',
    doctor: 'Doctor',
    patient: 'Patient',
    consultationDate: 'Consultation Date',
    medication: 'Medication',
    dose: 'Dose',
    frequency: 'Frequency',
    duration: 'Duration',
    instructions: 'Instructions',
    type: 'Type',
    order: 'Order',
    priority: 'Priority',
    noMedications: 'No medications listed.',
    noOrders: 'No orders listed.',
    referralSpecialty: 'Referral Specialty',
    referralReason: 'Reason for Referral',
    referralDebrief: 'Patient Debrief for Next Doctor',
    followupTiming: 'Follow-up Date / Timing',
    doctorSignature: 'Doctor signature',
    clinicStamp: 'Clinic stamp / date',
    printFooter: 'Testing page preview only. Not part of the real app and not written to the database.',
  },
  ar: {
    testingBadge: 'صفحة اختبار',
    testingDisclaimer: 'هذه صفحة اختبار فقط، وليست جزءا من التطبيق الحقيقي. لا يتم تسجيل الدخول فعليا، ولا التحقق من المريض، ولا حفظ أي بيانات في قاعدة البيانات هنا.',
    heroEyebrow: 'اختبار مسار المعالجة',
    heroTitle: 'جرّب تسجيلات CliNotes بحرية ومن دون قيود',
    heroDescription: 'تسجل هذه الصفحة الصوت وترسله عبر مسار Soniox و Gemini الحالي، ثم تعرض النتائج التي تظهر عادة للطبيب والمريض.',
    consultationMode: 'اختبار استشارة طبيب',
    labsMode: 'اختبار نقاش بين الأطباء',
    consultationTitle: 'اختبار استشارة طبيب',
    labsTitle: 'اختبار نقاش بين الأطباء',
    consultationSubtitle: 'سجل استشارة تجريبية بين طبيب ومريض. لا حاجة إلى مسح QR أو البحث عن المريض.',
    labsSubtitle: 'أضف أسماء أطباء افتراضيين، وسجل نقاشا داخليا، ثم راجع التقرير الذي سيرسل إلى الأطباء المشاركين.',
    consultationPill: 'استشارة',
    labsPill: 'نقاش أطباء',
    mockDoctors: 'أطباء مشاركون في الاختبار',
    add: 'إضافة',
    ready: 'جاهز للتسجيل',
    recordingConsultation: 'جار تسجيل الاستشارة',
    recordingLabs: 'جار تسجيل نقاش الأطباء',
    startRecording: 'ابدأ التسجيل',
    stopRecording: 'إيقاف وتشغيل التحليل',
    uploadAudio: 'ارفع تسجيل استشارة',
    diagnostics: 'متابعة التشغيل',
    outputTitle: 'النتائج',
    outputWaiting: 'ستظهر النتائج هنا بعد انتهاء Soniox و Gemini.',
    downloadAudio: 'تنزيل الصوت',
    downloadResults: 'تنزيل النتائج',
    emptyOutput: 'اختر نوع الاختبار، وسجل عينة قصيرة، ثم أوقف التسجيل.',
    uploadLabsOnly: 'رفع التسجيلات متاح حاليا لاختبار استشارات المرضى فقط.',
    uploadedAudio: 'تم اختيار ملف صوتي',
    preparingAudio: 'جار تجهيز الصوت',
    processing: 'جار تمرير الصوت عبر Soniox و Gemini. قد يستغرق ذلك دقيقة تقريبا.',
    pipelineRunning: 'التحليل قيد التشغيل...',
    pipelineComplete: 'اكتمل اختبار التحليل.',
    pipelineFailed: 'التحليل فشل.',
    pipelineError: 'خطأ في التحليل',
    microphoneError: 'يجب السماح باستخدام الميكروفون لتشغيل هذا الاختبار.',
    requestFailed: 'فشل مسار الاختبار.',
    doctorSoap: 'مسودة ملاحظات الطبيب',
    recommendedActions: 'إجراءات مقترحة',
    consultationSummary: 'ملخص الاستشارة',
    patientLanguage: 'شرح مبسط للمريض',
    whatYouCameFor: 'سبب الزيارة',
    whatWasDiscussed: 'ما الذي تمت مناقشته',
    whatDoctorFound: 'ما الذي لاحظه الطبيب',
    whatHappensNext: 'الخطوة التالية',
    noActionsTitle: 'لا توجد إجراءات مقترحة',
    noActionsBody: 'لم يرجع Gemini متابعة أو وصفة أو طلب تحاليل/أشعة أو تحويل إلى تخصص آخر في هذا الاختبار.',
    followUpTitle: 'حجز متابعة',
    followUpDefault: 'توجد متابعة مقترحة',
    prescriptionTitle: 'مسودة روشتة',
    prescriptionDefault: 'تم إنشاء مسودة دواء',
    labOrderTitle: 'طلب تحاليل أو أشعة',
    labOrderDefault: 'تم إنشاء مسودة طلب',
    referralTitle: 'مسودة تحويل',
    referralDefault: 'تم إنشاء مسودة تحويل',
    timing: 'الموعد',
    reason: 'السبب',
    specialty: 'التخصص',
    debrief: 'ملخص للطبيب التالي',
    detail: 'التفاصيل',
    printable: 'اعرض نسخة الطباعة',
    geminiJson: 'JSON من Gemini',
    transcript: 'نص التسجيل',
    noTranscript: 'لم يتم إرجاع نص للتسجيل.',
    soapTitleFallback: 'مسودة استشارة طبية',
    subjective: 'كلام المريض',
    objective: 'الفحص والبيانات',
    assessment: 'تقييم الطبيب',
    plan: 'الخطة',
    chiefComplaint: 'الشكوى الأساسية',
    medicalHistory: 'التاريخ المرضي',
    allergies: 'الحساسية',
    vitals: 'العلامات الحيوية',
    noVitalsRecorded: 'لم يتم تسجيل علامات حيوية.',
    bloodPressure: 'ضغط الدم',
    heartRate: 'معدل النبض',
    temperature: 'درجة الحرارة',
    physicalExam: 'الفحص السريري',
    diagnoses: 'التشخيصات',
    treatment: 'العلاج',
    followUp: 'المتابعة',
    labReport: 'تقرير النقاش للأطباء',
    headline: 'العنوان',
    participants: 'المشاركين',
    summary: 'الملخص',
    prominentPoints: 'أهم النقط',
    decisions: 'القرارات',
    actionPlan: 'خطة العمل',
    notReturned: 'غير متوفر.',
    diagnosticSteps: [
      'تسجيل الصوت من الميكروفون',
      'رفع تسجيل الاختبار إلى الخادم',
      'إرسال الصوت إلى Soniox',
      'استلام نص التسجيل',
      'إرسال النص إلى Gemini',
      'عرض نتائج الاختبار',
    ],
    printBrand: 'صفحة اختبار CliNotes',
    printed: 'تاريخ الطباعة',
    doctor: 'الطبيب',
    patient: 'المريض',
    consultationDate: 'تاريخ الاستشارة',
    medication: 'الدواء',
    dose: 'الجرعة',
    frequency: 'التكرار',
    duration: 'المدة',
    instructions: 'التعليمات',
    type: 'النوع',
    order: 'الطلب',
    priority: 'الأولوية',
    noMedications: 'لا توجد أدوية مضافة.',
    noOrders: 'لا توجد طلبات مضافة.',
    referralSpecialty: 'تخصص الإحالة',
    referralReason: 'سبب الإحالة',
    referralDebrief: 'ملخص المريض للطبيب التالي',
    followupTiming: 'تاريخ / معاد المتابعة',
    doctorSignature: 'توقيع الطبيب',
    clinicStamp: 'ختم العيادة / التاريخ',
    printFooter: 'هذه معاينة من صفحة الاختبار فقط. ليست جزءا من التطبيق الحقيقي ولا يتم حفظها في قاعدة البيانات.',
  }
};

renderStaticText();
renderMode();
renderMockDoctors();
renderDiagnostics();
initializePasswordGate();

els.testPasswordForm.addEventListener('submit', handlePasswordSubmit);
els.englishToggleBtn.addEventListener('click', () => setLanguage('en'));
els.arabicToggleBtn.addEventListener('click', () => setLanguage('ar'));
els.consultationModeBtn.addEventListener('click', () => setMode('consultation'));
els.labsModeBtn.addEventListener('click', () => setMode('labs'));
els.downloadAudioBtn.addEventListener('click', downloadRecordedAudio);
els.downloadResultsBtn.addEventListener('click', downloadDisplayedResults);
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
  resetLastRun();
  renderMode();
  renderDiagnostics();
  els.outputContent.className = 'empty-output';
  els.outputContent.innerHTML = formatBidiText(t('emptyOutput'));
  updateDownloadButtons();
}

async function initializePasswordGate() {
  document.body.classList.add('locked');
  if (!state.testPassword) {
    els.testPasswordOverlay.classList.remove('hidden');
    return;
  }

  try {
    await verifyTestPassword(state.testPassword);
    unlockPage();
  } catch {
    appState.clearTestPassword();
    state.testPassword = '';
    els.testPasswordOverlay.classList.remove('hidden');
  }
}

async function handlePasswordSubmit(event) {
  event.preventDefault();
  const password = els.testPasswordInput.value;
  if (!password) return;

  els.unlockTestPageBtn.disabled = true;
  els.testPasswordError.textContent = '';
  try {
    await verifyTestPassword(password);
    state.testPassword = password;
    appState.testPassword = password;
    unlockPage();
  } catch (error) {
    els.testPasswordError.textContent = error.message || 'Invalid password.';
  } finally {
    els.unlockTestPageBtn.disabled = false;
  }
}

function unlockPage() {
  els.testPasswordOverlay.classList.add('hidden');
  document.body.classList.remove('locked');
}

async function verifyTestPassword(password) {
  const response = await fetch(`${getServerUrl()}/api/test-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Test-App-Password': password,
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Invalid password.');
  }
}

function setLanguage(language) {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') return;
  state.language = language;
  appState.language = language;
  state.lastRecommendedActions = [];
  resetLastRun();
  renderStaticText();
  renderMode();
  renderDiagnostics();
  els.outputContent.className = 'empty-output';
  els.outputContent.textContent = t('emptyOutput');
  updateDownloadButtons();
}

function renderStaticText() {
  document.documentElement.lang = state.language === 'ar' ? 'ar' : 'en';
  els.englishToggleBtn.classList.toggle('active', state.language === 'en');
  els.arabicToggleBtn.classList.toggle('active', state.language === 'ar');
  setBidiContent(els.testingBadge, t('testingBadge'));
  setBidiContent(els.testingDisclaimer, t('testingDisclaimer'));
  setBidiContent(els.heroEyebrow, t('heroEyebrow'));
  setBidiContent(els.heroTitle, t('heroTitle'));
  setBidiContent(els.heroDescription, t('heroDescription'));
  setBidiContent(els.consultationModeLabel, t('consultationMode'));
  setBidiContent(els.labsModeLabel, t('labsMode'));
  setBidiContent(els.mockDoctorsLabel, t('mockDoctors'));
  setBidiContent(els.addDoctorLabel, t('add'));
  setBidiContent(els.startRecordLabel, t('startRecording'));
  setBidiContent(els.stopRecordLabel, t('stopRecording'));
  setBidiContent(els.uploadConsultationText, t('uploadAudio'));
  setBidiContent(els.diagnosticsTitle, t('diagnostics'));
  setBidiContent(els.outputTitle, t('outputTitle'));
  setBidiContent(els.outputSubtitle, t('outputWaiting'));
  setBidiContent(els.downloadAudioLabel, t('downloadAudio'));
  setBidiContent(els.downloadResultsLabel, t('downloadResults'));
  if (els.outputContent.classList.contains('empty-output')) {
    els.outputContent.innerHTML = formatBidiText(t('emptyOutput'));
  }
}

function renderMode() {
  const isLabs = state.mode === 'labs';
  els.consultationModeBtn.classList.toggle('inactive', isLabs);
  els.labsModeBtn.classList.toggle('inactive', !isLabs);
  els.labsFields.classList.toggle('hidden', !isLabs);
  els.uploadConsultationLabel.classList.toggle('hidden', isLabs);
  setBidiContent(els.modeTitle, isLabs ? t('labsTitle') : t('consultationTitle'));
  setBidiContent(els.modeSubtitle, isLabs ? t('labsSubtitle') : t('consultationSubtitle'));
  setBidiContent(els.modePill, isLabs ? t('labsPill') : t('consultationPill'));
  if (!els.recordingDot.classList.contains('active')) {
    setBidiContent(els.recordingLabel, t('ready'));
  }
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
    setBidiContent(els.recordingLabel, state.mode === 'labs' ? t('recordingLabs') : t('recordingConsultation'));
    els.startRecordBtn.disabled = true;
    els.stopRecordBtn.disabled = false;
    renderDiagnostics(0);
  } catch (error) {
    alert(t('microphoneError'));
    console.error(error);
  }
}

async function handleConsultationUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  if (state.mode !== 'consultation') {
    alert(t('uploadLabsOnly'));
    return;
  }

  setBidiContent(els.recordingLabel, t('uploadedAudio'));
  els.recordingTimer.textContent = '--:--';
  els.startRecordBtn.disabled = true;
  els.stopRecordBtn.disabled = true;
  els.uploadConsultationLabel.classList.add('disabled');

  await runPipeline(file, { originalFilename: file.name });
  els.recordingTimer.textContent = '00:00';
  els.uploadConsultationLabel.classList.remove('disabled');
}

function stopRecording() {
  if (!state.mediaRecorder || state.mediaRecorder.state === 'inactive') return;
  setBidiContent(els.recordingLabel, t('preparingAudio'));
  els.stopRecordBtn.disabled = true;
  state.mediaRecorder.stop();
  clearInterval(state.timer);
}

async function runPipeline(audioBlob, { originalFilename = '' } = {}) {
  try {
    renderDiagnostics(1);
    state.lastResult = null;
    state.lastAudioBlob = audioBlob;
    state.lastAudioExtension = getAudioExtension(audioBlob, originalFilename);
    state.currentRunBaseName = createRunBaseName(state.mode);
    updateDownloadButtons();
    els.outputContent.className = 'empty-output';
    els.outputContent.innerHTML = formatBidiText(t('processing'));
    setBidiContent(els.outputSubtitle, t('pipelineRunning'));

    setTimeout(() => renderDiagnostics(2), 400);
    setTimeout(() => renderDiagnostics(3), 1200);
    setTimeout(() => renderDiagnostics(4), 2400);

    const result = await submitAudio(audioBlob, { originalFilename });

    renderDiagnostics(5, true);
    setBidiContent(els.outputSubtitle, t('pipelineComplete'));
    renderOutput(result);
    updateDownloadButtons();
  } catch (error) {
    setBidiContent(els.outputSubtitle, t('pipelineFailed'));
    els.outputContent.className = '';
    els.outputContent.innerHTML = `
      <section class="output-section">
        <h3>${escapeHtml(t('pipelineError'))}</h3>
        <div class="display-tile"><p>${escapeHtml(error.message || 'Unknown error')}</p></div>
      </section>
    `;
    updateDownloadButtons();
  } finally {
    els.recordingDot.classList.remove('active');
    setBidiContent(els.recordingLabel, t('ready'));
    els.startRecordBtn.disabled = false;
    els.stopRecordBtn.disabled = true;
  }
}

async function submitAudio(audioBlob, { originalFilename = '' } = {}) {
  const serverUrl = getServerUrl();
  const languageQuery = `language=${encodeURIComponent(state.language)}`;
  const endpoint = state.mode === 'labs'
    ? `${serverUrl}/api/test/lab-discussion?participants=${encodeURIComponent(state.mockDoctors.join(','))}&${languageQuery}`
    : `${serverUrl}/api/test/consultation?${languageQuery}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': audioBlob.type || 'application/octet-stream',
      'X-Audio-Filename': encodeURIComponent(originalFilename || `clinotes-recording.${getAudioExtension(audioBlob)}`),
      'X-Audio-Mime': audioBlob.type || 'application/octet-stream',
      'X-Test-App-Password': state.testPassword,
    },
    body: audioBlob,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  if (!response.ok) throw new Error(data.error || t('requestFailed'));
  return data;
}

function renderOutput(result) {
  state.lastResult = result;
  els.outputContent.className = '';
  els.outputContent.innerHTML = state.mode === 'labs'
    ? renderLabOutput(result)
    : renderConsultationOutput(result);
}

function updateDownloadButtons() {
  els.downloadAudioBtn.disabled = !state.lastAudioBlob;
  els.downloadResultsBtn.disabled = !state.lastResult;
}

function resetLastRun() {
  state.lastResult = null;
  state.lastAudioBlob = null;
  state.lastAudioExtension = 'webm';
  state.currentRunBaseName = '';
}

function downloadRecordedAudio() {
  if (!state.lastAudioBlob) return;
  downloadBlob(state.lastAudioBlob, `${getCurrentRunBaseName()}-audio.${state.lastAudioExtension}`);
}

function downloadDisplayedResults() {
  if (!state.lastResult) return;
  const timestamp = new Date();
  const modeLabel = state.mode === 'labs' ? t('labsTitle') : t('consultationTitle');
  const html = `<!DOCTYPE html>
<html lang="${state.language === 'ar' ? 'ar' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(t('printBrand'))} - ${escapeHtml(modeLabel)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; background: #F7F9FC; color: #111827; font-family: Arial, sans-serif; }
    main { max-width: 980px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 18px; overflow: hidden; }
    header { padding: 28px 32px; border-bottom: 1px solid #E5E7EB; background: #EFF6FF; }
    .brand { color: #2F6FED; font-size: 13px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
    h1 { margin: 8px 0 8px; font-size: 30px; line-height: 1.1; }
    .meta { color: #475569; font-size: 13px; font-weight: 700; }
    .content { padding: 26px 32px 34px; }
    .output-section { border-bottom: 1px solid #E5E7EB; padding: 20px 0; }
    .output-section:first-child { padding-top: 0; }
    .output-section:last-child { border-bottom: none; padding-bottom: 0; }
    .output-section h3 { margin: 0 0 12px; color: #111827; font-size: 18px; font-weight: 900; }
    .doctor-soap-draft { background: #FFFFFF; border: 1px solid #DDE7F3; border-radius: 14px; padding: 18px; }
    .soap-title { color: #0F172A; font-size: 22px; font-weight: 900; margin-bottom: 16px; }
    .soap-columns, .patient-language-grid, .lab-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .soap-column { display: grid; gap: 10px; align-content: start; }
    .soap-column h4 { margin: 10px 0 2px; padding: 9px 11px; border-radius: 10px; background: #EFF6FF; color: #1D4ED8; font-size: 14px; font-weight: 900; }
    .soap-column h4:first-child { margin-top: 0; }
    .soap-field { padding: 10px 11px; border: 1px solid #E5E7EB; border-radius: 10px; background: #F8FAFC; }
    .soap-field label, .display-tile strong { display: block; margin-bottom: 6px; color: #0F172A; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .soap-field div, .display-tile p, .display-tile li { margin: 0; color: #334155; font-size: 14px; line-height: 1.55; font-weight: 400; white-space: pre-wrap; }
    .display-tile { border: 1px solid #E5E7EB; border-radius: 12px; background: #FAFBFC; padding: 12px; }
    .recommended-actions-preview { display: grid; gap: 10px; }
    .test-recommended-action { border: 1px solid #E5E7EB; border-radius: 14px; padding: 14px; background: #F8FAFC; }
    .print-test-action-btn, .recommended-action-icon { display: none; }
    .recommended-action-details { display: grid; gap: 8px; margin: 10px 0 0; }
    .recommended-action-details div { border-top: 1px solid #E5E7EB; padding-top: 8px; }
    .recommended-action-details dt { color: #64748B; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .recommended-action-details dd { margin: 3px 0 0; color: #334155; line-height: 1.5; }
    .output-json, .transcript-box { max-height: none; overflow: visible; border-radius: 12px; padding: 14px; font-size: 12px; line-height: 1.55; white-space: pre-wrap; }
    .output-json { background: #0F172A; color: #E5E7EB; direction: ltr; unicode-bidi: plaintext; }
    .transcript-box { background: #F8FAFC; color: #111827; border: 1px solid #E5E7EB; direction: ltr; unicode-bidi: plaintext; }
    .mixed-arabic-text { direction: rtl; unicode-bidi: isolate; }
    .latin-run { direction: ltr; unicode-bidi: isolate; display: inline-block; }
    @media (max-width: 760px) { body { padding: 14px; } .soap-columns, .patient-language-grid, .lab-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand">${escapeHtml(t('printBrand'))}</div>
      <h1>${escapeHtml(modeLabel)}</h1>
      <div class="meta">${escapeHtml(t('printed'))}: ${escapeHtml(timestamp.toLocaleString())} · ${escapeHtml(state.lastResult.gemini_model || 'gemini-3.1-flash-lite')}</div>
    </header>
    <section class="content">
      ${els.outputContent.innerHTML}
    </section>
  </main>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${getCurrentRunBaseName()}-results.html`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createRunBaseName(mode) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `clinotes-test-${mode}-${timestamp}`;
}

function getCurrentRunBaseName() {
  if (!state.currentRunBaseName) {
    state.currentRunBaseName = createRunBaseName(state.mode);
  }
  return state.currentRunBaseName;
}

function getAudioExtension(audioBlob, originalFilename = '') {
  const originalExtension = String(originalFilename || '').split('.').pop();
  if (originalExtension && originalExtension !== originalFilename && /^[a-z0-9]{2,5}$/i.test(originalExtension)) {
    return originalExtension.toLowerCase();
  }
  const mime = String(audioBlob?.type || '').split(';')[0].toLowerCase();
  return {
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
  }[mime] || 'webm';
}

function renderConsultationOutput(result) {
  const doctor = result.doctor_display || {};
  const patient = result.patient_display || {};
  const recommendedActions = extractRecommendedActions(result.analysis_json);
  state.lastRecommendedActions = recommendedActions;
  return `
    <section class="output-section">
      <h3>${escapeHtml(t('consultationSummary'))}</h3>
      <div class="display-tile"><p>${formatBidiText(result.analysis_json?.summary_text || t('notReturned'))}</p></div>
    </section>
    <section class="output-section">
      <h3>${escapeHtml(t('doctorSoap'))}</h3>
      ${renderDoctorSoapDraft(doctor)}
    </section>
    <section class="output-section">
      <h3>${escapeHtml(t('recommendedActions'))}</h3>
      ${renderRecommendedActions(recommendedActions)}
    </section>
    <section class="output-section">
      <h3>${escapeHtml(t('patientLanguage'))}</h3>
      <div class="patient-language-grid">
        ${tile(t('whatYouCameFor'), patient.what_you_came_for)}
        ${tile(t('whatWasDiscussed'), patient.what_was_discussed)}
        ${tile(t('whatDoctorFound'), patient.what_the_doctor_found)}
        ${tile(t('whatHappensNext'), patient.what_happens_next)}
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
      title: t('followUpTitle'),
      detail: actions.follow_up.timing || actions.follow_up.reason || t('followUpDefault'),
      data: actions.follow_up,
      body: [
        [t('timing'), actions.follow_up.timing],
        [t('reason'), actions.follow_up.reason]
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
      title: t('prescriptionTitle'),
      detail: medications.map(med => med.name).filter(Boolean).join(', ') || t('prescriptionDefault'),
      data: actions.prescription,
      body: medications.map(med => [
        med.name || t('medication'),
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
      title: t('labOrderTitle'),
      detail: orders.map(order => order.name).filter(Boolean).join(', ') || t('labOrderDefault'),
      data: actions.lab_order,
      body: orders.map(order => [
        order.name || t('order'),
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
      title: t('referralTitle'),
      detail: actions.referral.specialty || actions.referral.reason || t('referralDefault'),
      data: actions.referral,
      body: [
        [t('specialty'), actions.referral.specialty],
        [t('reason'), actions.referral.reason],
        [t('debrief'), actions.referral.debrief]
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
          <strong>${escapeHtml(t('noActionsTitle'))}</strong>
          <p>${escapeHtml(t('noActionsBody'))}</p>
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
            <strong>${formatBidiText(action.title)}</strong>
            <p>${formatBidiText(action.detail)}</p>
            ${renderRecommendedActionDetails(action.body)}
            <button type="button" class="print-test-action-btn" data-action-key="${escapeHtml(action.key)}">
              <i class="uil uil-print"></i> ${escapeHtml(t('printable'))}
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
          .latin-run { direction: ltr; unicode-bidi: isolate; display: inline-block; }
          .mixed-arabic-text { direction: rtl; unicode-bidi: isolate; }
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
              <div class="brand">${escapeHtml(t('printBrand'))}</div>
              <h1>${formatBidiText(action.title)}</h1>
            </div>
            <div class="print-date">
              <span class="label">${escapeHtml(t('printed'))}</span>
              ${escapeHtml(printedAt)}
            </div>
          </header>
          <section class="print-body">
            <div class="meta-grid">
              <div class="meta-item"><span class="label">${escapeHtml(t('doctor'))}</span><strong class="value">TEST Doc</strong></div>
              <div class="meta-item"><span class="label">${escapeHtml(t('patient'))}</span><strong class="value">TEST Patient</strong></div>
              <div class="meta-item"><span class="label">${escapeHtml(t('consultationDate'))}</span><strong class="value">${escapeHtml(printedAt)}</strong></div>
            </div>
            ${body}
            <div class="signature-row">
              <div class="signature-line">${escapeHtml(t('doctorSignature'))}</div>
              <div class="signature-line">${escapeHtml(t('clinicStamp'))}</div>
            </div>
            <p class="footer-note">${escapeHtml(t('printFooter'))}</p>
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
        <thead><tr><th>${escapeHtml(t('medication'))}</th><th>${escapeHtml(t('dose'))}</th><th>${escapeHtml(t('frequency'))}</th><th>${escapeHtml(t('duration'))}</th><th>${escapeHtml(t('instructions'))}</th></tr></thead>
        <tbody>
          ${medications.map(med => `
            <tr>
              <td>${formatBidiText(med.name || '')}</td>
              <td>${formatBidiText(med.dose || '')}</td>
              <td>${formatBidiText(med.frequency || '')}</td>
              <td>${formatBidiText(med.duration || '')}</td>
              <td>${formatBidiText(med.instructions || '')}</td>
            </tr>
          `).join('') || `<tr><td colspan="5">${escapeHtml(t('noMedications'))}</td></tr>`}
        </tbody>
      </table>
    `;
  }

  if (action.type === 'lab_order') {
    const orders = Array.isArray(data.orders) ? data.orders : [];
    return `
      <table>
        <thead><tr><th>${escapeHtml(t('type'))}</th><th>${escapeHtml(t('order'))}</th><th>${escapeHtml(t('reason'))}</th><th>${escapeHtml(t('priority'))}</th></tr></thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td>${formatBidiText(order.type || '')}</td>
              <td>${formatBidiText(order.name || '')}</td>
              <td>${formatBidiText(order.reason || '')}</td>
              <td>${formatBidiText(order.priority || 'Routine')}</td>
            </tr>
          `).join('') || `<tr><td colspan="4">${escapeHtml(t('noOrders'))}</td></tr>`}
        </tbody>
      </table>
    `;
  }

  if (action.type === 'referral') {
    return `
      <section class="section"><h2>${escapeHtml(t('referralSpecialty'))}</h2><p>${formatBidiText(data.specialty || '')}</p></section>
      <section class="section"><h2>${escapeHtml(t('referralReason'))}</h2><p>${formatBidiText(data.reason || '')}</p></section>
      <section class="section"><h2>${escapeHtml(t('referralDebrief'))}</h2><p>${formatBidiText(data.debrief || '')}</p></section>
    `;
  }

  return `
    <section class="section"><h2>${escapeHtml(t('followupTiming'))}</h2><p>${formatBidiText(data.timing || action.detail || '')}</p></section>
    <section class="section"><h2>${escapeHtml(t('reason'))}</h2><p>${formatBidiText(data.reason || t('followUpDefault'))}</p></section>
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
          <dd>${formatBidiText(value || t('notReturned'))}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}

function renderLabOutput(result) {
  const display = result.doctor_display || {};
  return `
    <section class="output-section">
      <h3>${escapeHtml(t('labReport'))}</h3>
      <div class="lab-grid">
        ${tile(t('headline'), display.title)}
        ${tile(t('participants'), (display.participants || []).join(', '))}
        ${tile(t('summary'), display.summary)}
        ${tile(t('prominentPoints'), listText(display.prominent_points))}
        ${tile(t('decisions'), listText(display.decisions))}
        ${tile(t('actionPlan'), listText(display.action_plan))}
      </div>
    </section>
    ${renderJsonAndTranscript(result)}
  `;
}

function renderJsonAndTranscript(result) {
  return `
    <section class="output-section">
      <h3>${escapeHtml(t('transcript'))}</h3>
      <pre class="transcript-box">${formatBidiText(result.transcript_text || t('noTranscript'))}</pre>
    </section>
    <section class="output-section">
      <h3>${escapeHtml(t('geminiJson'))}</h3>
      <pre class="output-json">${escapeHtml(JSON.stringify(result.analysis_json || {}, null, 2))}</pre>
    </section>
  `;
}

function renderDoctorSoapDraft(doctor) {
  const treatment = (doctor.plan || [])
    .filter(item => !isFollowUpPlanItem(item))
    .map(item => `${item.label}: ${item.value}`)
    .join('\n');
  const followUp = (doctor.plan || [])
    .find(item => isFollowUpPlanItem(item))?.value || '';

  return `
    <div class="doctor-soap-draft">
      <div class="soap-title">${formatBidiText(doctor.title || t('soapTitleFallback'))}</div>
      <div class="soap-columns">
        <div class="soap-column">
          <h4>${escapeHtml(t('subjective'))}</h4>
          ${soapField(t('chiefComplaint'), doctor.subjective?.chief_complaint)}
          ${soapField(t('medicalHistory'), doctor.subjective?.history)}
          ${soapField(t('allergies'), doctor.subjective?.allergies)}
          <h4>${escapeHtml(t('objective'))}</h4>
          ${soapField(t('vitals'), formatVitals(doctor.objective?.vitals))}
          ${soapField(t('physicalExam'), doctor.objective?.examination)}
        </div>
        <div class="soap-column">
          <h4>${escapeHtml(t('assessment'))}</h4>
          ${soapField(t('diagnoses'), (doctor.assessment?.diagnoses || []).join(', '))}
          <h4>${escapeHtml(t('plan'))}</h4>
          ${soapField(t('treatment'), treatment)}
          ${soapField(t('followUp'), followUp)}
        </div>
      </div>
    </div>
  `;
}

function isFollowUpPlanItem(item = {}) {
  const label = String(item.label || '').toLowerCase();
  const value = String(item.value || '').toLowerCase();
  return label.includes('follow')
    || label.includes('متابعة')
    || label.includes('مراجعة')
    || value.includes('follow-up')
    || value.includes('follow up');
}

function soapField(label, value) {
  return `
    <div class="soap-field">
      <label>${escapeHtml(label)}</label>
      <div>${formatBidiText(value || '')}</div>
    </div>
  `;
}

function renderDiagnostics(activeIndex = -1, completeAll = false) {
  els.diagnosticsList.innerHTML = t('diagnosticSteps').map((step, index) => {
    const done = completeAll || index < activeIndex;
    const active = !completeAll && index === activeIndex;
    const icon = done ? 'uil-check-circle' : active ? 'uil-sync uil-spin' : 'uil-circle';
    return `<div class="diagnostic-row ${done ? 'done' : ''} ${active ? 'active' : ''}"><i class="uil ${icon}"></i>${formatBidiText(step)}</div>`;
  }).join('');
}

function tickTimer() {
  state.seconds += 1;
  const minutes = String(Math.floor(state.seconds / 60)).padStart(2, '0');
  const seconds = String(state.seconds % 60).padStart(2, '0');
  els.recordingTimer.textContent = `${minutes}:${seconds}`;
}

function tile(label, value) {
  return `<div class="display-tile"><strong>${escapeHtml(label)}</strong><p>${formatBidiText(value || t('notReturned'))}</p></div>`;
}

function listText(value) {
  if (!Array.isArray(value)) return value || '';
  return value.map(item => {
    if (typeof item === 'string') return item;
    return [item.label, item.owner, item.value].filter(Boolean).join(' - ');
  }).join(' ');
}

function formatVitals(vitals) {
  const normalized = normalizeVitals(vitals);
  if (!hasVitalsData(normalized)) return t('noVitalsRecorded');
  const labels = {
    blood_pressure: t('bloodPressure'),
    heart_rate: t('heartRate'),
    temperature: t('temperature'),
  };
  return Object.entries(normalized)
    .filter(([, value]) => String(value || '').trim())
    .map(([key, value]) => `${labels[key] || key.replace(/_/g, ' ')}: ${value}`)
    .join(', ');
}

function hasVitalsData(vitals) {
  return Object.values(normalizeVitals(vitals)).some(value => String(value || '').trim());
}

function normalizeVitals(vitals) {
  if (!vitals || typeof vitals !== 'object' || Array.isArray(vitals)) return {};
  return {
    blood_pressure: vitals.blood_pressure || vitals.bp || vitals.BP || '',
    heart_rate: vitals.heart_rate || vitals.pulse || '',
    temperature: vitals.temperature || vitals.temp || '',
  };
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value === null || value === undefined ? '' : String(value);
  return div.innerHTML;
}

function formatBidiText(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (state.language !== 'ar') return escapeHtml(text);

  const latinRunPattern = /(\[[^\]\n]*[A-Za-z][^\]\n]*\]|[A-Za-z][A-Za-z0-9+#./:%-]*(?:\s+[A-Za-z0-9+#./:%-]+)*)/g;
  const formatted = text.split(latinRunPattern).map(part => {
    if (!part) return '';
    if (/[A-Za-z]/.test(part)) {
      return `<bdi dir="ltr" class="latin-run">${escapeHtml(part)}</bdi>&rlm;`;
    }
    return escapeHtml(part);
  }).join('');
  return `<span class="mixed-arabic-text" dir="rtl">${formatted}</span>`;
}

function setBidiContent(element, value) {
  if (!element) return;
  element.innerHTML = formatBidiText(value);
}

function t(key) {
  return copy[state.language]?.[key] ?? copy.en[key] ?? key;
}
