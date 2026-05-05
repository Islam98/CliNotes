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

  // Accordion Logic (Global function to handle inline toggling)
  window.toggleCard = function(headerElement) {
    const card = headerElement.closest('.consultation-card');
    const body = card.querySelector('.consultation-body');
    const isExpanded = card.classList.contains('expanded');

    // Close all other expanded cards to maintain interaction rule "Only one consultation expanded at a time"
    document.querySelectorAll('.consultation-card.expanded').forEach(expandedCard => {
      if (expandedCard !== card) {
        expandedCard.classList.remove('expanded');
        expandedCard.querySelector('.consultation-body').style.display = 'none';
      }
    });

    if (isExpanded) {
      // Collapse
      card.classList.remove('expanded');
      body.style.display = 'none';
    } else {
      // Expand
      card.classList.add('expanded');
      // Use smooth fadeIn animation
      body.style.display = 'block';
      body.style.opacity = '0';
      setTimeout(() => {
        body.style.transition = 'opacity 250ms ease';
        body.style.opacity = '1';
      }, 10);
    }
  };

  // Mock Initialization for UI visual feedback
  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('id') || 'PT-9999';

  // We are currently rendering mock HTML just to display the UI, 
  // but we can simulate loading the title.
  document.getElementById('breadcrumbName').innerText = 'Test Patient';
  document.getElementById('patientFullName').innerText = 'Test Patient';
  document.getElementById('patientInitials').innerText = 'TP';
  document.getElementById('patientMeta').innerText = 'Age: 30 • Gender: Other';

  // Logout Logic
  const logoutBtn = document.querySelector('.doctor-avatar'); 
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to log out?')) {
        await api.auth.signOut();
        window.location.href = '/';
      }
    });
  }
});
