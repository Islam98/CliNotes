import { appState } from './app-state.js';

const dictionaries = {
  en: {
    english: 'English',
    arabic: 'العربية',
    signInDashboard: 'Sign In to Dashboard',
    signUpAs: 'Sign Up as {role}',
    doctor: 'Doctor',
    patient: 'Patient',
    labs: 'Labs',
    scheduledToday: 'Scheduled Today',
    processing: 'Processing',
    readyForReview: 'Ready for Review',
    reviewedToday: 'Reviewed Today',
    startNewConsultation: 'Start New Consultation',
    todaysSchedule: "Today's Schedule",
    selectPatientContext: 'Select a patient for context',
    patientContext: 'Patient Context',
    selectScheduledPatient: 'Select a scheduled patient to view context',
    draftNotesReview: 'Draft Notes for Review',
    recommendedActions: 'Recommended Actions',
    labDiscussions: 'Lab Discussions',
    reviewedInternalDiscussions: 'Reviewed internal discussions',
    completedConsultations: 'Completed Consultations',
    bookConsultation: 'Book Consultation',
    myRecords: 'My Records',
    actionsRequired: 'Actions Required',
    documents: 'Documents',
    latestConsultation: 'Latest Consultation',
    consultationDetails: 'Consultation Details',
    startDiscussion: 'Start Discussion',
    startLabsDiscussion: 'Start Labs Discussion',
    addToDiscussion: 'Add to Discussion',
    participatingDoctors: 'Participating Doctors',
    dashboard: 'Dashboard',
    welcomeBack: 'Welcome back',
    signInSubtitle: 'Please enter your details to sign in.',
    login: 'Login',
    signUp: 'Sign Up',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    password: 'Password',
    specialty: 'Specialty',
    age: 'Age',
    gender: 'Gender',
    patientDashboardSubtitle: 'Here’s a summary of your recent health activity',
    upcomingConsultation: 'Upcoming Consultation',
    lastVisit: 'Last Visit',
    lastConsultation: 'Last Consultation',
    viewTranscript: 'View Transcript',
    documentsFiles: 'Documents & Files',
    consultationHistory: 'Consultation History',
    consultations: 'Consultations',
    internalDoctorDiscussion: 'Internal Doctor Discussion',
    labsHero: 'Record clinical discussions between doctors, transcribe them, and generate a reviewable report for every participant.',
    addDoctor: 'Add Doctor',
    doctorEmail: 'Doctor email',
    visitReason: 'Visit Reason',
    keyPoints: 'Key Points',
    suggestedFocusToday: 'Suggested Focus Today',
    viewProfile: 'View Profile',
    noVisitReason: 'No pre-visit reason provided.',
    noPatientContext: 'No patient context available yet.',
  },
  ar: {
    english: 'English',
    arabic: 'العربية',
    signInDashboard: 'تسجيل الدخول',
    signUpAs: 'إنشاء حساب كـ {role}',
    doctor: 'طبيب',
    patient: 'مريض',
    labs: 'النقاشات',
    scheduledToday: 'مواعيد اليوم',
    processing: 'قيد المعالجة',
    readyForReview: 'جاهز للمراجعة',
    reviewedToday: 'تمت مراجعته اليوم',
    startNewConsultation: 'بدء استشارة جديدة',
    todaysSchedule: 'جدول اليوم',
    selectPatientContext: 'اختر مريضا لعرض السياق',
    patientContext: 'سياق المريض',
    selectScheduledPatient: 'اختر مريضا من الجدول لعرض السياق',
    draftNotesReview: 'مسودات الملاحظات للمراجعة',
    recommendedActions: 'الإجراءات المقترحة',
    labDiscussions: 'نقاشات الأطباء',
    reviewedInternalDiscussions: 'نقاشات داخلية تمت مراجعتها',
    completedConsultations: 'الاستشارات المكتملة',
    bookConsultation: 'حجز استشارة',
    myRecords: 'سجلاتي',
    actionsRequired: 'إجراءات مطلوبة',
    documents: 'المستندات',
    latestConsultation: 'آخر استشارة',
    consultationDetails: 'تفاصيل الاستشارة',
    startDiscussion: 'بدء نقاش',
    startLabsDiscussion: 'بدء نقاش الأطباء',
    addToDiscussion: 'إضافة للنقاش',
    participatingDoctors: 'الأطباء المشاركون',
    dashboard: 'لوحة التحكم',
    welcomeBack: 'مرحبا بعودتك',
    signInSubtitle: 'أدخل بياناتك لتسجيل الدخول.',
    login: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    specialty: 'التخصص',
    age: 'العمر',
    gender: 'الجنس',
    patientDashboardSubtitle: 'ملخص لنشاطك الصحي الأخير',
    upcomingConsultation: 'الاستشارة القادمة',
    lastVisit: 'آخر زيارة',
    lastConsultation: 'آخر استشارة',
    viewTranscript: 'عرض النص',
    documentsFiles: 'المستندات والملفات',
    consultationHistory: 'سجل الاستشارات',
    consultations: 'الاستشارات',
    internalDoctorDiscussion: 'نقاش داخلي بين الأطباء',
    labsHero: 'سجل النقاشات السريرية بين الأطباء، ثم حوّلها إلى نص وتقرير قابل للمراجعة لكل المشاركين.',
    addDoctor: 'إضافة طبيب',
    doctorEmail: 'بريد الطبيب',
    visitReason: 'سبب الزيارة',
    keyPoints: 'نقاط مهمة',
    suggestedFocusToday: 'تركيز مقترح اليوم',
    viewProfile: 'عرض الملف',
    noVisitReason: 'لم يتم إدخال سبب للزيارة قبل الموعد.',
    noPatientContext: 'لا يوجد سياق متاح للمريض حتى الآن.',
  },
};

export function getAppLanguage() {
  return appState.language;
}

export function setAppLanguage(language) {
  const nextLanguage = language === 'ar' ? 'ar' : 'en';
  appState.language = nextLanguage;
  document.documentElement.lang = nextLanguage;
  applyStaticTranslations();
  return nextLanguage;
}

export function t(key, replacements = {}) {
  const value = dictionaries[getAppLanguage()]?.[key] ?? dictionaries.en[key] ?? key;
  return Object.entries(replacements).reduce(
    (text, [name, replacement]) => text.replaceAll(`{${name}}`, replacement),
    value
  );
}

export function applyStaticTranslations(root = document) {
  const language = getAppLanguage();
  document.documentElement.lang = language;
  root.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
}

export function mountLanguageToggle() {
  if (document.getElementById('appLanguageToggle')) return;

  const toggle = document.createElement('div');
  toggle.id = 'appLanguageToggle';
  toggle.className = 'app-language-toggle';
  toggle.innerHTML = `
    <button type="button" data-language="en">English</button>
    <button type="button" data-language="ar">العربية</button>
  `;

  const target = document.querySelector('.top-bar-right')
    || document.querySelector('.patient-actions')
    || document.querySelector('.labs-topbar')
    || document.querySelector('.profile-actions')
    || document.querySelector('.auth-card')
    || document.body;
  target.appendChild(toggle);

  const render = () => {
    const language = getAppLanguage();
    toggle.querySelectorAll('button').forEach(button => {
      button.classList.toggle('active', button.dataset.language === language);
    });
  };

  toggle.addEventListener('click', event => {
    const button = event.target.closest('button[data-language]');
    if (!button) return;
    setAppLanguage(button.dataset.language);
    window.dispatchEvent(new CustomEvent('clinotes-language-change', { detail: { language: getAppLanguage() } }));
    render();
  });

  render();
}
