const state = {
  mode: 'consultation',
  language: 'en',
  mediaRecorder: null,
  stream: null,
  chunks: [],
  seconds: 0,
  timer: null,
  mockDoctors: ['Dr. Omar Mah', 'Dr. Layla Hassan'],
  lastRecommendedActions: [],
};

const els = {
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
    testingDisclaimer: 'هذه ليست جزءا من التطبيق الحقيقي. لا يتم إجراء تسجيل دخول أو تحقق من المريض أو كتابة في قاعدة البيانات هنا.',
    heroEyebrow: 'اختبار مسار المعالجة',
    heroTitle: 'اختبر تسجيلات CliNotes بدون قيود',
    heroDescription: 'تسجل هذه الصفحة الصوت وترسله عبر مسار Soniox و Gemini الحالي، ثم تعرض المخرجات التي تظهر عادة للطبيب والمريض.',
    consultationMode: 'اختبار استشارة طبيب',
    labsMode: 'اختبار نقاش أطباء',
    consultationTitle: 'اختبار استشارة طبيب',
    labsTitle: 'اختبار نقاش أطباء',
    consultationSubtitle: 'سجل استشارة تجريبية بين طبيب ومريض. لا حاجة لمسح QR أو التحقق من المريض.',
    labsSubtitle: 'أضف أسماء أطباء تجريبية، وسجل نقاشا داخليا، ثم راجع التقرير الذي سيرسل للأطباء المشاركين.',
    consultationPill: 'استشارة',
    labsPill: 'وضع المختبرات',
    mockDoctors: 'الأطباء المشاركون تجريبيا',
    add: 'إضافة',
    ready: 'جاهز للتسجيل',
    recordingConsultation: 'جار تسجيل الاستشارة',
    recordingLabs: 'جار تسجيل نقاش الأطباء',
    startRecording: 'بدء التسجيل',
    stopRecording: 'إيقاف وتشغيل المسار',
    uploadAudio: 'رفع تسجيل استشارة',
    diagnostics: 'التشخيصات',
    outputTitle: 'المخرجات الناتجة',
    outputWaiting: 'ستظهر النتائج هنا بعد انتهاء Soniox و Gemini.',
    emptyOutput: 'اختر الوضع، سجل عينة قصيرة، ثم أوقف التسجيل.',
    uploadLabsOnly: 'رفع الصوت متاح حاليا لاختبار استشارات المرضى فقط.',
    uploadedAudio: 'تم اختيار ملف صوتي',
    preparingAudio: 'جار تجهيز الصوت',
    processing: 'جار تمرير الصوت عبر Soniox و Gemini. قد يستغرق ذلك دقيقة.',
    pipelineRunning: 'المسار قيد التشغيل...',
    pipelineComplete: 'اكتمل مسار الاختبار.',
    pipelineFailed: 'فشل المسار.',
    pipelineError: 'خطأ في المسار',
    microphoneError: 'يلزم السماح بالميكروفون لهذا الاختبار.',
    requestFailed: 'فشل مسار الاختبار.',
    doctorSoap: 'مسودة SOAP للطبيب',
    recommendedActions: 'الإجراءات المقترحة',
    patientLanguage: 'شرح مبسط للمريض',
    whatYouCameFor: 'سبب الزيارة',
    whatWasDiscussed: 'ما تمت مناقشته',
    whatDoctorFound: 'ما وجده الطبيب',
    whatHappensNext: 'الخطوات التالية',
    noActionsTitle: 'لم يتم توليد إجراءات مقترحة',
    noActionsBody: 'لم يرجع Gemini إجراءات متابعة أو وصفة أو طلب مختبر أو إحالة لهذه الاستشارة التجريبية.',
    followUpTitle: 'حجز متابعة',
    followUpDefault: 'تم اقتراح متابعة',
    prescriptionTitle: 'مسودة وصفة',
    prescriptionDefault: 'تم توليد مسودة دواء',
    labOrderTitle: 'طلب مختبر أو تصوير',
    labOrderDefault: 'تم توليد مسودة طلب',
    referralTitle: 'مسودة إحالة',
    referralDefault: 'تم توليد مسودة إحالة',
    timing: 'التوقيت',
    reason: 'السبب',
    specialty: 'التخصص',
    debrief: 'ملخص للطبيب التالي',
    detail: 'تفصيل',
    printable: 'عرض النسخة القابلة للطباعة',
    geminiJson: 'JSON من Gemini',
    transcript: 'النص المفرغ',
    noTranscript: 'لم يتم إرجاع نص مفرغ.',
    soapTitleFallback: 'مسودة استشارة سريرية',
    subjective: 'ذاتي',
    objective: 'موضوعي',
    assessment: 'التقييم',
    plan: 'الخطة',
    chiefComplaint: 'الشكوى الرئيسية',
    medicalHistory: 'التاريخ المرضي',
    allergies: 'الحساسية',
    vitals: 'العلامات الحيوية',
    physicalExam: 'الفحص السريري',
    diagnoses: 'التشخيصات',
    treatment: 'العلاج',
    followUp: 'المتابعة',
    labReport: 'تقرير الطبيب المشارك',
    headline: 'العنوان',
    participants: 'المشاركون',
    summary: 'الملخص',
    prominentPoints: 'النقاط الأبرز',
    decisions: 'القرارات',
    actionPlan: 'خطة العمل',
    notReturned: 'غير متوفر.',
    diagnosticSteps: [
      'تسجيل صوت الميكروفون محليا',
      'رفع صوت الاختبار إلى الخادم',
      'إرسال الصوت إلى Soniox',
      'انتظار التفريغ الصوتي',
      'إرسال النص إلى Gemini',
      'عرض مخرجات الاختبار',
    ],
    printBrand: 'صفحة اختبار CliNotes',
    printed: 'تمت الطباعة',
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
    noMedications: 'لا توجد أدوية مدرجة.',
    noOrders: 'لا توجد طلبات مدرجة.',
    referralSpecialty: 'تخصص الإحالة',
    referralReason: 'سبب الإحالة',
    referralDebrief: 'ملخص المريض للطبيب التالي',
    followupTiming: 'تاريخ / توقيت المتابعة',
    doctorSignature: 'توقيع الطبيب',
    clinicStamp: 'ختم العيادة / التاريخ',
    printFooter: 'معاينة من صفحة الاختبار فقط. ليست جزءا من التطبيق الحقيقي ولا يتم حفظها في قاعدة البيانات.',
  }
};

renderStaticText();
renderMode();
renderMockDoctors();
renderDiagnostics();

els.englishToggleBtn.addEventListener('click', () => setLanguage('en'));
els.arabicToggleBtn.addEventListener('click', () => setLanguage('ar'));
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
  els.outputContent.innerHTML = formatBidiText(t('emptyOutput'));
}

function setLanguage(language) {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') return;
  state.language = language;
  state.lastRecommendedActions = [];
  renderStaticText();
  renderMode();
  renderDiagnostics();
  els.outputContent.className = 'empty-output';
  els.outputContent.textContent = t('emptyOutput');
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

  await runPipeline(file);
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

async function runPipeline(audioBlob) {
  try {
    renderDiagnostics(1);
    els.outputContent.className = 'empty-output';
    els.outputContent.innerHTML = formatBidiText(t('processing'));
    setBidiContent(els.outputSubtitle, t('pipelineRunning'));

    setTimeout(() => renderDiagnostics(2), 400);
    setTimeout(() => renderDiagnostics(3), 1200);
    setTimeout(() => renderDiagnostics(4), 2400);

    const result = await submitAudio(audioBlob);

    renderDiagnostics(5, true);
    setBidiContent(els.outputSubtitle, t('pipelineComplete'));
    renderOutput(result);
  } catch (error) {
    setBidiContent(els.outputSubtitle, t('pipelineFailed'));
    els.outputContent.className = '';
    els.outputContent.innerHTML = `
      <section class="output-section">
        <h3>${escapeHtml(t('pipelineError'))}</h3>
        <div class="display-tile"><p>${escapeHtml(error.message || 'Unknown error')}</p></div>
      </section>
    `;
  } finally {
    els.recordingDot.classList.remove('active');
    setBidiContent(els.recordingLabel, t('ready'));
    els.startRecordBtn.disabled = false;
    els.stopRecordBtn.disabled = true;
  }
}

async function submitAudio(audioBlob) {
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
  const languageQuery = `language=${encodeURIComponent(state.language)}`;
  const endpoint = state.mode === 'labs'
    ? `${serverUrl}/api/test/lab-discussion?participants=${encodeURIComponent(state.mockDoctors.join(','))}&${languageQuery}`
    : `${serverUrl}/api/test/consultation?${languageQuery}`;

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

  if (!response.ok) throw new Error(data.error || t('requestFailed'));
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
      <h3>${escapeHtml(t('geminiJson'))}</h3>
      <pre class="output-json">${escapeHtml(JSON.stringify(result.analysis_json || {}, null, 2))}</pre>
    </section>
    <section class="output-section">
      <h3>${escapeHtml(t('transcript'))}</h3>
      <pre class="transcript-box">${formatBidiText(result.transcript_text || t('noTranscript'))}</pre>
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
  if (!vitals) return '';
  if (typeof vitals === 'string') return vitals;
  return Object.entries(vitals).map(([key, value]) => `${key}: ${value}`).join(', ');
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
