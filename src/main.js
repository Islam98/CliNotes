import './style.css'
import { api } from './api.js'

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const roleButtons = document.querySelectorAll('.role-btn');
  const loginForm = document.getElementById('login-form');
  const submitBtn = document.getElementById('submit-btn');
  const formError = document.getElementById('form-error');
  
  const toggleLoginBtn = document.getElementById('toggle-login');
  const toggleSignupBtn = document.getElementById('toggle-signup');
  const loginOnlyElements = document.querySelectorAll('.login-only');
  const signupOnlyElements = document.querySelectorAll('.signup-only');
  const signupDoctorElements = document.querySelectorAll('.signup-fields-doctor');
  const signupPatientElements = document.querySelectorAll('.signup-fields-patient');

  let currentRole = 'doctor';
  let isSignup = false;

  const roleLabels = {
    doctor: 'Doctor',
    patient: 'Patient',
    labs: 'Labs'
  };

  // Role Selection
  roleButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentRole = btn.dataset.role;
      updateFormUI();
    });
  });

  // Toggle Login/Signup
  toggleLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isSignup = false;
    toggleLoginBtn.classList.add('active');
    toggleSignupBtn.classList.remove('active');
    updateFormUI();
  });

  toggleSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isSignup = true;
    toggleSignupBtn.classList.add('active');
    toggleLoginBtn.classList.remove('active');
    updateFormUI();
  });

  function updateFormUI() {
    hideError();

    // Show/hide based on mode
    loginOnlyElements.forEach(el => el.style.display = isSignup ? 'none' : 'flex');
    signupOnlyElements.forEach(el => el.style.display = isSignup ? 'flex' : 'none');

    // Show/hide role specific fields in signup mode
    if (isSignup) {
      if (currentRole === 'doctor') {
        signupDoctorElements.forEach(el => el.style.display = 'block');
        signupPatientElements.forEach(el => el.style.display = 'none');
      } else if (currentRole === 'patient') {
        signupDoctorElements.forEach(el => el.style.display = 'none');
        signupPatientElements.forEach(el => el.style.display = 'block');
      } else {
        signupDoctorElements.forEach(el => el.style.display = 'none');
        signupPatientElements.forEach(el => el.style.display = 'none');
      }
      submitBtn.innerHTML = `Sign Up as ${roleLabels[currentRole] || currentRole}`;
    } else {
      signupDoctorElements.forEach(el => el.style.display = 'none');
      signupPatientElements.forEach(el => el.style.display = 'none');
      submitBtn.innerHTML = 'Sign In to Dashboard';
    }
  }

  // Password Visibility Toggle
  const togglePwdBtn = document.getElementById('toggle-pwd');
  const pwdInput = document.getElementById('password');

  if (togglePwdBtn && pwdInput) {
    togglePwdBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = pwdInput.getAttribute('type') === 'password' ? 'text' : 'password';
      pwdInput.setAttribute('type', type);
      
      const icon = togglePwdBtn.querySelector('i');
      if (type === 'text') {
        icon.classList.remove('uil-eye-slash');
        icon.classList.add('uil-eye');
      } else {
        icon.classList.remove('uil-eye');
        icon.classList.add('uil-eye-slash');
      }
    });
  }

  // Error Modal Logic
  const errorModal = document.getElementById('errorModal');
  const errorModalMessage = document.getElementById('errorModalMessage');
  const closeErrorModal = document.getElementById('closeErrorModal');
  const ackErrorModal = document.getElementById('ackErrorModal');

  function showError(msg) {
    if (errorModal && errorModalMessage) {
      errorModalMessage.innerText = msg;
      errorModal.classList.remove('hidden');
    } else {
      alert(msg);
    }
  }

  function hideError() {
    if (errorModal) {
      errorModal.classList.add('hidden');
    }
  }

  if (closeErrorModal) closeErrorModal.addEventListener('click', hideError);
  if (ackErrorModal) ackErrorModal.addEventListener('click', hideError);

  // Reset state when coming back to page via back button
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      submitBtn.innerHTML = isSignup ? `Sign Up as ${currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}` : 'Sign In to Dashboard';
      submitBtn.style.backgroundColor = '';
      submitBtn.style.opacity = '1';
      submitBtn.disabled = false;
    }
  });

  // Form Submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="uil uil-spinner-alt uil-spin"></i> Processing...';
    submitBtn.style.opacity = '0.8';
    submitBtn.disabled = true;

    try {
      if (isSignup) {
        if (currentRole === 'labs') {
          throw new Error("Labs accounts are not available for self sign-up yet.");
        }

        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        
        if (!firstName || !lastName) {
          throw new Error("Both First Name and Last Name must be provided.");
        }
        
        const fullName = `${firstName} ${lastName}`;
        const extraData = {};
        
        if (currentRole === 'doctor') {
          extraData.specialty = document.getElementById('specialty').value;
          extraData.doctorId = 'DR-' + Math.floor(1000 + Math.random() * 9000); 
        } else if (currentRole === 'patient') {
          extraData.age = parseInt(document.getElementById('age').value);
          extraData.gender = document.getElementById('gender').value;
        }

        await api.auth.signUp(email, password, currentRole, fullName, extraData);
        submitBtn.innerHTML = '<i class="uil uil-check"></i> Sign Up Successful!';
      } else {
        await api.auth.signIn(email, password);
        const fetchedRole = await api.auth.getCurrentUserRole();

        if (fetchedRole !== currentRole) {
          await api.auth.signOut();
          throw new Error(`No ${roleLabels[currentRole] || currentRole} account exists for these credentials.`);
        }

        submitBtn.innerHTML = '<i class="uil uil-check"></i> Sign In Successful!';
      }

      submitBtn.style.backgroundColor = 'var(--secondary-color)';
      
      const fetchedRole = await api.auth.getCurrentUserRole();
      const redirectRole = fetchedRole || currentRole;

      setTimeout(() => {
        if (redirectRole === 'patient') {
          window.location.href = '/patient.html';
        } else if (redirectRole === 'labs') {
          window.location.href = '/labs.html';
        } else {
          window.location.href = '/doctor.html';
        }
      }, 1000);

    } catch (error) {
      console.error(error);
      showError(error.message || "An error occurred.");
      submitBtn.innerHTML = originalText;
      submitBtn.style.backgroundColor = '';
      submitBtn.style.opacity = '1';
      submitBtn.disabled = false;
    }
  });
});
