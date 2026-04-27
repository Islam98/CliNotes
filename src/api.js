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
     * Upload an audio file to Supabase Storage
     */
    async uploadAudio(consultationId, audioBlobOrFile) {
      const fileName = `${consultationId}/${Date.now()}.webm`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('consultation-audio')
        .upload(fileName, audioBlobOrFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: metadataData, error: metadataError } = await supabase
        .from('audio')
        .insert([{
          consultation_id: consultationId,
          file_path: uploadData.path
        }])
        .select()
        .single();

      if (metadataError) throw metadataError;
      return metadataData;
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
    }
  }
};
