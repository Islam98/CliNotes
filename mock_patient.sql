-- Insert a mock authenticated user (PT-9999 equivalent)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'pt9999@clinotes.test',
  crypt('Testpassword123', gen_salt('bf')),
  NOW(),
  '{"role": "patient", "name": "Test Patient", "age": 30, "gender": "Other"}'
);
