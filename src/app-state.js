const LANGUAGE_KEY = 'clinotes_language';
const TEST_PASSWORD_KEY = 'clinotes_test_password';

export const appState = {
  get language() {
    return localStorage.getItem(LANGUAGE_KEY) === 'ar' ? 'ar' : 'en';
  },

  set language(value) {
    localStorage.setItem(LANGUAGE_KEY, value === 'ar' ? 'ar' : 'en');
  },

  get testPassword() {
    return sessionStorage.getItem(TEST_PASSWORD_KEY) || '';
  },

  set testPassword(value) {
    if (value) {
      sessionStorage.setItem(TEST_PASSWORD_KEY, value);
    } else {
      sessionStorage.removeItem(TEST_PASSWORD_KEY);
    }
  },

  clearTestPassword() {
    sessionStorage.removeItem(TEST_PASSWORD_KEY);
  },
};
