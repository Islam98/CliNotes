document.addEventListener('DOMContentLoaded', () => {
  const consultationItems = document.querySelectorAll('.consultation-item');
  const detailsContent = document.getElementById('details-content');

  // Mock data for consultations
  const consultationData = {
    '1': {
      cameFor: 'You came in for your annual physical examination and to review the results of your recent blood tests.',
      discussed: 'We reviewed your blood work, which looked great overall. We discussed your current blood pressure levels, which are slightly elevated but well-managed with your current medication.',
      found: 'Heart rate and lungs are normal. Blood pressure is 128/82. Cholesterol levels have improved since your last visit.',
      nextSteps: 'Continue taking your medication as prescribed. Let\'s schedule a follow-up in 6 months to check your blood pressure again.'
    },
    '2': {
      cameFor: 'You visited for a routine follow-up regarding your hypertension management.',
      discussed: 'We discussed your recent home blood pressure readings. You mentioned occasional dizziness in the mornings.',
      found: 'Your blood pressure in the clinic was 135/85. Heart rhythm is regular. No signs of fluid retention.',
      nextSteps: 'We will keep the current Lisinopril dosage. Please make sure to stay hydrated. If dizziness persists, message the clinic.'
    }
  };

  consultationItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active from all
      consultationItems.forEach(i => i.classList.remove('active'));
      // Add active to clicked
      item.classList.add('active');

      // Update details content with smooth transition
      const id = item.dataset.id;
      const data = consultationData[id];

      if (data) {
        detailsContent.style.opacity = '0';
        
        setTimeout(() => {
          detailsContent.innerHTML = `
            <div class="detail-section">
              <h3 class="detail-label">What you came in for</h3>
              <p class="detail-text">${data.cameFor}</p>
            </div>
            <div class="detail-section">
              <h3 class="detail-label">What was discussed</h3>
              <p class="detail-text">${data.discussed}</p>
            </div>
            <div class="detail-section">
              <h3 class="detail-label">What the doctor found</h3>
              <p class="detail-text">${data.found}</p>
            </div>
            <div class="detail-section">
              <h3 class="detail-label">What happens next</h3>
              <p class="detail-text">${data.nextSteps}</p>
            </div>
          `;
          detailsContent.style.opacity = '1';
        }, 250); // 250ms transition
      }
    });
  });

  // Docs Tabs Logic
  const docTabs = document.querySelectorAll('.doc-tab');
  docTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      docTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // In a real app, this would filter the documents list
    });
  });
});
