-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('consultation-audio', 'consultation-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Grant permissions on storage schema
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
