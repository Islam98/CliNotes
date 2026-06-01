import { supabase } from './supabase.js';

export const api = {
  // ==============================
  // AUTHENTICATION
  // ==============================
  auth: {
    /**
     * Sign up a new user and pass metadata to the database trigger
     */
    async signUp(email, password, role, name, extraData = {}) {
      if (!email || !password || !role || !name) {
        throw new Error("All basic fields (First Name, Last Name, Email, Password) must be filled.");
      }

      if (role === 'doctor' && !extraData.specialty) {
        throw new Error("Specialty is required for doctors.");
      }
      if (role === 'patient' && (!extraData.age || !extraData.gender)) {
        throw new Error("Age and Gender are required for patients.");
      }

      // Password Strength Validation
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long.");
      }
      if (!/\d/.test(password)) {
        throw new Error("Password must contain at least one number.");
      }
      if (!/[a-zA-Z]/.test(password)) {
        throw new Error("Password must contain at least one letter.");
      }

      // 1. Create user in Supabase Auth and pass metadata. 
      // A secure database trigger handles inserting into `profiles`, `doctor`, and `patient_profile`.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: role,
            name: name,
            doctorId: extraData.doctorId,
            specialty: extraData.specialty,
            age: extraData.age,
            gender: extraData.gender
          }
        }
      });

      if (error) throw error;
      
      const session = data.session;

      if (!session) {
        throw new Error("Signup successful, but email confirmation is required. Please check your inbox or disable email confirmations in Supabase settings.");
      }

      return data;
    },

    /**
     * Sign in existing user
     */
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    },

    /**
     * Sign out current user
     */
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },

    /**
     * Get current session
     */
    async getSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    /**
     * Helper to get the role of the currently logged in user
     */
    async getCurrentUserRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
        
      if (error) throw error;
      return data?.role;
    }
  },

  // ==============================
  // DATA ACCESS & STORAGE
  // ==============================
  data: {
    /**
     * Get a patient's profile details
     */
    async getPatientProfile(patientId) {
      const { data, error } = await supabase
        .from('patient_profile')
        .select('*')
        .eq('id', patientId)
        .single();
      
      if (error) throw error;
      return data;
    },

    /**
     * Get the current patient's own profile.
     */
    async getCurrentPatientProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      return this.getPatientProfile(user.id);
    },

    /**
     * Get all consultations for the current user.
     */
    async getConsultations() {
      const { data, error } = await supabase
        .from('consultation')
        .select(`
          *,
          doctor:doctor_id(name, doctor_id),
          patient:patient_id(name)
        `)
        .order('date_time', { ascending: false });
        
      if (error) throw error;
      return data;
    },

    /**
     * Get all bookings for the current doctor.
     */
    async getBookings() {
      const { data, error } = await supabase
        .from('booking')
        .select(`
          *,
          patient:patient_id(id, name)
        `)
        .order('appointment_time', { ascending: true });
        
      if (error) throw error;
      return data;
    },

    /**
     * Get bookings for the current patient.
     */
    async getPatientBookings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('booking')
        .select(`
          *,
          doctor:doctor_id(id, name, specialty)
        `)
        .eq('patient_id', user.id)
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      return data;
    },

    /**
     * List doctors available for patient booking.
     */
    async getAvailableDoctors() {
      const { data, error } = await supabase
        .from('doctor')
        .select('id, name, specialty')
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },

    /**
     * Create a booking as the current patient.
     */
    async createPatientBooking(doctorId, appointmentTime, reasonText = '') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('booking')
        .insert([{
          doctor_id: doctorId,
          patient_id: user.id,
          appointment_time: appointmentTime,
          reason_text: reasonText,
          status: 'scheduled'
        }])
        .select(`
          *,
          doctor:doctor_id(id, name, specialty)
        `)
        .single();

      if (error) throw error;
      return data;
    },

    async getDoctorBookedSlots(doctorId, date) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/doctors/${doctorId}/booked-slots?date=${encodeURIComponent(date)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load booked slots.');
      return data;
    },
    
    /**
     * Create a new consultation
     */
    async createConsultation(patientId) {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) throw new Error("Not authenticated");
       
       const { data, error } = await supabase
         .from('consultation')
         .insert([{ 
            doctor_id: user.id, 
            patient_id: patientId 
         }])
         .select()
         .single();
         
       if (error) throw error;
       return data;
    },

    /**
     * Get the AI summary for a specific consultation
     */
    async getConsultationSummary(consultationId) {
      const { data, error } = await supabase
        .from('ai_summary')
        .select('*')
        .eq('consultation_id', consultationId)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error; 
      return data;
    },

    /**
     * Upload an audio file to Supabase Storage (Proxied to bypass RLS)
     */
    async uploadAudio(consultationId, audioBlobOrFile) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      
      const response = await fetch(`${serverUrl}/api/upload-audio/${consultationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': audioBlobOrFile.type || 'audio/webm'
        },
        body: audioBlobOrFile
      });
      
      if (!response.ok) {
        let errorMsg = 'Upload failed';
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch(e) {}
        throw new Error(errorMsg);
      }
      
      return await response.json();
    },

    /**
     * Get a signed, temporary URL for a private audio file
     */
    async getAudioUrl(filePath) {
      const { data, error } = await supabase.storage
        .from('consultation-audio')
        .createSignedUrl(filePath, 3600); 
        
      if (error) throw error;
      return data.signedUrl;
    },

    /**
     * Search patients by name (partial match, case-insensitive)
     */
    async searchPatients(query) {
      const { data, error } = await supabase
        .from('patient_profile')
        .select('id, name, age, gender')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },

    /**
     * Get all consultations for a specific patient with AI summaries and recommendations.
     * Used by doctors viewing a patient profile.
     */
    async getPatientConsultations(patientId) {
      const { data, error } = await supabase
        .from('consultation')
        .select(`
          *,
          doctor:doctor_id(name, specialty),
          ai_summary(summary_text, structured_data),
          doctor_recommendation(recommendations_text)
        `)
        .eq('patient_id', patientId)
        .order('date_time', { ascending: false });

      if (error) throw error;
      return data;
    },

    /**
     * Get consultations for the current patient.
     */
    async getMyConsultations() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      return this.getPatientConsultations(user.id);
    },

    /**
     * Get the current doctor's profile info
     */
    async getDoctorInfo() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('doctor')
        .select('name, specialty')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    /**
     * Trigger Soniox transcription for a consultation's audio.
     * Calls the Express server endpoint which handles the Soniox API.
     */
    async triggerTranscription(consultationId) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Transcription request failed.');
      }

      return response.json();
    },

    /**
     * Get the transcript for a consultation (polls the Express server).
     */
    async getTranscriptStatus(consultationId) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/transcribe/${consultationId}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        const err = await response.json();
        throw new Error(err.error || 'Failed to get transcript.');
      }

      return response.json();
    },

    /**
     * Get transcript directly from Supabase (for patient profile view)
     */
    async getConsultationTranscript(consultationId) {
      const { data, error } = await supabase
        .from('transcript')
        .select('*')
        .eq('consultation_id', consultationId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    /**
     * Update consultation status
     */
    async updateConsultationStatus(consultationId, status) {
      const { data, error } = await supabase
        .from('consultation')
        .update({ status })
        .eq('id', consultationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    /**
     * Update booking status
     */
    async updateBookingStatus(patientId, status) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('booking')
        .update({ status })
        .eq('patient_id', patientId)
        .eq('doctor_id', user.id)
        .eq('status', 'scheduled')
        .select();
      
      if (error) throw error;
      return data;
    },

    /**
     * Create a new booking (for testing)
     */
    async createBooking(patientId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('booking')
        .insert([{
          doctor_id: user.id,
          patient_id: patientId,
          appointment_time: new Date().toISOString(),
          status: 'scheduled'
        }])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },

    /**
     * Update AI Summary structured_data
     */
    async updateAISummary(consultationId, structuredData) {
      const { data, error } = await supabase
        .from('ai_summary')
        .update({ structured_data: structuredData })
        .eq('consultation_id', consultationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async generatePatientSummary(structuredData) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/patient-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ structuredData }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate patient summary.');
      return data;
    },

    /**
     * Delete consultation completely
     */
    async deleteConsultation(consultationId) {
      const { error } = await supabase
        .from('consultation')
        .delete()
        .eq('id', consultationId);
      
      if (error) throw error;
      return true;
    },

    async verifyLabDoctor(email, password) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/labs/verify-doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not verify doctor credentials.');
      return data;
    },

    async createLabDiscussion(title, participantIds) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/labs/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, participantIds }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create lab discussion.');
      return data;
    },

    async uploadLabDiscussionAudio(discussionId, audioBlobOrFile) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/labs/discussions/${discussionId}/audio`, {
        method: 'POST',
        headers: { 'Content-Type': audioBlobOrFile.type || 'audio/webm' },
        body: audioBlobOrFile,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Lab discussion audio upload failed.');
      return data;
    },

    async triggerLabDiscussionTranscription(discussionId) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/labs/discussions/${discussionId}/transcribe`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Lab discussion transcription failed.');
      return data;
    },

    async getLabDiscussions() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/labs/doctor-discussions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load lab discussions.');
      return data;
    },

    async approveLabDiscussion(discussionId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/labs/discussions/${discussionId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not approve lab discussion.');
      return data;
    },

    async createPatientAppleWalletPass(patientId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      const response = await fetch(`${serverUrl}/api/patients/${patientId}/apple-wallet-pass`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        let message = 'Could not create Apple Wallet pass.';
        try {
          const data = await response.json();
          message = data.error || message;
        } catch {}
        throw new Error(message);
      }

      return response.blob();
    }
  }
};
