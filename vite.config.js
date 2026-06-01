import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        doctor: resolve(__dirname, 'doctor.html'),
        patient: resolve(__dirname, 'patient.html'),
        patientProfile: resolve(__dirname, 'patient-profile.html'),
        labs: resolve(__dirname, 'labs.html'),
        testapp: resolve(__dirname, 'testapp.html'),
      },
    },
  },
});
